import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { getPrisma } from "@/lib/prisma";
import { getWorkspaceByIdIfMember } from "@/lib/workspace";

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
        if (/^data:image\/[a-zA-Z]+;base64,/.test(item.content)) {
          continue;
        }

        if (item.content.toLowerCase().includes(searchLower)) {
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

    const copyItems = await prisma.copyItem.findMany({
      where: baseWhere,
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });

    let nextCursor: string | null = null;
    if (copyItems.length > limit) {
      const nextItem = copyItems.pop();
      nextCursor = nextItem!.id;
    }

    return NextResponse.json({
      items: copyItems,
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
