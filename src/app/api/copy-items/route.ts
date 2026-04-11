import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { getPrisma } from "@/lib/prisma";
import { getWorkspaceByIdIfMember } from "@/lib/workspace";

const isImageDataUrl = (value: string) =>
  /^data:image\/[a-zA-Z]+;base64,/.test(value);

const isRemoteImageUrl = (value: string) =>
  /^https?:\/\/.+\.(png|jpe?g|gif|webp|avif|svg)(\?.*)?$/i.test(value);

const isImageContent = (value: string) =>
  isImageDataUrl(value) || isRemoteImageUrl(value);

const isVideoDataUrl = (value: string) =>
  /^data:video\/[a-zA-Z]+;base64,/.test(value);

const isRemoteVideoUrl = (value: string) =>
  /^https?:\/\/.+\.(mp4|webm|ogg|mov|avi|mkv|m4v)(\?.*)?$/i.test(value);

const isVideoContent = (value: string) =>
  isVideoDataUrl(value) || isRemoteVideoUrl(value);

const isRemoteFileUrl = (value: string) => /^https?:\/\//i.test(value);

const isFileContent = (value: string) =>
  !isImageContent(value) && !isVideoContent(value) && isRemoteFileUrl(value);

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const cursor = searchParams.get("cursor");
    const limit = parseInt(searchParams.get("limit") || "20");
    const search = searchParams.get("search") || "";
    const workspaceId = searchParams.get("workspaceId") || null;

    const prisma = getPrisma();
    const workspace = workspaceId
      ? await getWorkspaceByIdIfMember(workspaceId, session.user.id)
      : null;

    const baseWhere = workspaceId
      ? { workspaceId: workspace?.id }
      : { userId: session.user.id, workspaceId: null };

    if (workspaceId && !workspace) {
      return NextResponse.json(
        { error: "Workspace not found." },
        { status: 404 },
      );
    }

    const itemType = searchParams.get("type");

    const itemMatchesType = (item: { content: string }) => {
      if (itemType === "image") return isImageContent(item.content);
      if (itemType === "video") return isVideoContent(item.content);
      if (itemType === "file") return isFileContent(item.content);
      return true;
    };

    if (search) {
      const allItems = cursor
        ? await prisma.copyItem.findMany({
            where: baseWhere,
            orderBy: { createdAt: "desc" },
            skip: 1,
            cursor: { id: cursor },
          })
        : await prisma.copyItem.findMany({
            where: baseWhere,
            orderBy: { createdAt: "desc" },
            take: 500,
          });

      const filteredItems = [];
      let nextCursor: string | null = null;
      const searchLower = search.toLowerCase();

      for (const item of allItems) {
        if (!itemMatchesType(item)) continue;

        const isDataImage = isImageDataUrl(item.content);
        const contentMatches =
          !isDataImage && item.content.toLowerCase().includes(searchLower);
        const fileNameMatches = item.fileName
          ?.toLowerCase()
          .includes(searchLower);

        if (contentMatches || fileNameMatches) {
          filteredItems.push(item);
        }

        if (filteredItems.length === limit) {
          const currentIndex = allItems.indexOf(item);
          if (currentIndex < allItems.length - 1) {
            nextCursor = allItems[currentIndex + 1].id;
          }
          break;
        }
      }

      return NextResponse.json({
        items: filteredItems,
        nextCursor,
      });
    }

    const fetchLimit = limit * 10 + 1;
    const copyItems = await prisma.copyItem.findMany({
      where: baseWhere,
      orderBy: { createdAt: "desc" },
      take: fetchLimit,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });

    const filteredItems = [];
    for (const item of copyItems) {
      if (!itemMatchesType(item)) continue;
      filteredItems.push(item);
      if (filteredItems.length === limit) {
        break;
      }
    }

    const nextCursor =
      copyItems.length === fetchLimit
        ? copyItems[copyItems.length - 1]!.id
        : null;

    return NextResponse.json({
      items: filteredItems,
      nextCursor,
    });
  } catch (error) {
    console.error("Failed to fetch copy items:", error);
    return NextResponse.json(
      { error: "Failed to fetch copy items" },
      { status: 500 },
    );
  }
}
