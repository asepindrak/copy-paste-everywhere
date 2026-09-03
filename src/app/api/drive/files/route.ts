import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { getPrisma } from "@/lib/prisma";
import { getWorkspaceByIdIfMember } from "@/lib/workspace";
import {
  deleteDriveStorageFile,
  getFileCategory,
  getTimeGroup,
} from "@/lib/driveStorage";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const workspaceIdParam = searchParams.get("workspaceId");
  const workspaceId = workspaceIdParam && workspaceIdParam !== "null" && workspaceIdParam !== "undefined"
    ? workspaceIdParam.trim()
    : null;

  const folderIdParam = searchParams.get("folderId");
  const folderId = folderIdParam && folderIdParam !== "root" && folderIdParam !== "all" && folderIdParam !== "null" && folderIdParam !== ""
    ? folderIdParam.trim()
    : null;

  const filter = searchParams.get("filter") || "all";
  const search = searchParams.get("search")?.trim() || "";
  const sortBy = searchParams.get("sortBy") || "updatedAt";
  const sortOrder = (searchParams.get("sortOrder") || "desc") as "asc" | "desc";
  const timeRange = searchParams.get("timeRange") || "all";

  if (workspaceId) {
    const member = await getWorkspaceByIdIfMember(workspaceId, session.user.id);
    if (!member) {
      return NextResponse.json({ error: "Workspace access denied" }, { status: 403 });
    }
  }

  try {
    const prisma = getPrisma();

    // Determine trash state
    const isTrash = filter === "trash";

    // Base scope
    const where: any = {
      ...(workspaceId ? { workspaceId } : { userId: session.user.id, workspaceId: null }),
      isTrash,
    };

    // Filter modes
    if (filter === "starred") {
      where.isStarred = true;
    }

    // Folder scoping: if searching, starred, recent, or trash, search across all folders
    if (!search && filter !== "starred" && filter !== "recent" && filter !== "trash" && filter !== "image" && filter !== "document" && filter !== "video" && filter !== "audio" && filter !== "archive") {
      if (folderIdParam !== "all") {
        where.folderId = folderId;
      }
    }

    // Category filtering
    if (["image", "video", "audio", "document", "archive", "code"].includes(filter)) {
      if (filter === "image") {
        where.mimeType = { startsWith: "image/" };
      } else if (filter === "video") {
        where.mimeType = { startsWith: "video/" };
      } else if (filter === "audio") {
        where.mimeType = { startsWith: "audio/" };
      } else if (filter === "document") {
        where.OR = [
          { mimeType: { contains: "pdf" } },
          { mimeType: { contains: "document" } },
          { mimeType: { contains: "word" } },
          { mimeType: { contains: "sheet" } },
          { mimeType: { contains: "excel" } },
          { mimeType: { contains: "text/" } },
        ];
      } else if (filter === "archive") {
        where.OR = [
          { mimeType: { contains: "zip" } },
          { mimeType: { contains: "tar" } },
          { mimeType: { contains: "compressed" } },
        ];
      }
    }

    // Name search
    if (search) {
      where.name = { contains: search, mode: "insensitive" };
    }

    // Time-based filtering (if specified)
    if (timeRange !== "all") {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      if (timeRange === "today") {
        where.createdAt = { gte: startOfToday };
      } else if (timeRange === "yesterday") {
        const startOfYesterday = new Date(startOfToday);
        startOfYesterday.setDate(startOfYesterday.getDate() - 1);
        where.createdAt = { gte: startOfYesterday, lt: startOfToday };
      } else if (timeRange === "this_week") {
        const startOfWeek = new Date(startOfToday);
        startOfWeek.setDate(startOfWeek.getDate() - 7);
        where.createdAt = { gte: startOfWeek };
      } else if (timeRange === "this_month") {
        const startOfMonth = new Date(startOfToday);
        startOfMonth.setDate(startOfMonth.getDate() - 30);
        where.createdAt = { gte: startOfMonth };
      } else if (timeRange === "older") {
        const startOfMonth = new Date(startOfToday);
        startOfMonth.setDate(startOfMonth.getDate() - 30);
        where.createdAt = { lt: startOfMonth };
      }
    }

    // Order By
    const orderBy: any = {};
    if (sortBy === "name") {
      orderBy.name = sortOrder;
    } else if (sortBy === "size") {
      orderBy.size = sortOrder;
    } else if (sortBy === "createdAt") {
      orderBy.createdAt = sortOrder;
    } else {
      orderBy.updatedAt = sortOrder;
    }

    const files = await prisma.driveFile.findMany({
      where,
      orderBy,
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
        folder: { select: { id: true, name: true, color: true } },
      },
    });

    const enrichedFiles = files.map((file) => ({
      ...file,
      category: getFileCategory(file.mimeType, file.name),
      timeGroup: getTimeGroup(file.createdAt),
    }));

    return NextResponse.json({ files: enrichedFiles });
  } catch (err) {
    console.error("Failed to fetch drive files:", err);
    return NextResponse.json({ error: "Failed to fetch files" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const id = String(body.id || "").trim();
    if (!id) {
      return NextResponse.json({ error: "File ID is required" }, { status: 400 });
    }

    const prisma = getPrisma();
    const existing = await prisma.driveFile.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    if (existing.workspaceId) {
      const member = await getWorkspaceByIdIfMember(existing.workspaceId, session.user.id);
      if (!member) {
        return NextResponse.json({ error: "Workspace access denied" }, { status: 403 });
      }
    } else if (existing.userId !== session.user.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const updateData: {
      name?: string;
      folderId?: string | null;
      isStarred?: boolean;
      isTrash?: boolean;
    } = {};

    if (body.name !== undefined) {
      const trimmed = String(body.name).trim();
      if (trimmed) updateData.name = trimmed;
    }
    if (body.folderId !== undefined) {
      updateData.folderId = body.folderId && body.folderId !== "root" ? String(body.folderId).trim() : null;
    }
    if (typeof body.isStarred === "boolean") {
      updateData.isStarred = body.isStarred;
    }
    if (typeof body.isTrash === "boolean") {
      updateData.isTrash = body.isTrash;
    }

    const updated = await prisma.driveFile.update({
      where: { id },
      data: updateData,
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
        folder: { select: { id: true, name: true, color: true } },
      },
    });

    return NextResponse.json({
      file: {
        ...updated,
        category: getFileCategory(updated.mimeType, updated.name),
        timeGroup: getTimeGroup(updated.createdAt),
      },
    });
  } catch (err) {
    console.error("Failed to update file:", err);
    return NextResponse.json({ error: "Failed to update file" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "File ID is required" }, { status: 400 });
  }

  try {
    const prisma = getPrisma();
    const existing = await prisma.driveFile.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    if (existing.workspaceId) {
      const member = await getWorkspaceByIdIfMember(existing.workspaceId, session.user.id);
      if (!member) {
        return NextResponse.json({ error: "Workspace access denied" }, { status: 403 });
      }
    } else if (existing.userId !== session.user.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Delete from storage
    await deleteDriveStorageFile(existing.storageType, existing.storageKey, existing.url);

    // Delete record from DB
    await prisma.driveFile.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, id });
  } catch (err) {
    console.error("Failed to delete file:", err);
    return NextResponse.json({ error: "Failed to delete file" }, { status: 500 });
  }
}
