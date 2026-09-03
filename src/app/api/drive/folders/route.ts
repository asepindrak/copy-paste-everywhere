import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { getPrisma } from "@/lib/prisma";
import { getWorkspaceByIdIfMember } from "@/lib/workspace";

// Helper to build breadcrumb chain
async function buildBreadcrumbs(folderId: string | null, userId: string, workspaceId: string | null) {
  const breadcrumbs: { id: string | null; name: string }[] = [];
  let currentId: string | null = folderId;

  while (currentId) {
    const folder: { id: string; name: string; parentId: string | null } | null = await getPrisma().driveFolder.findFirst({
      where: {
        id: currentId,
        ...(workspaceId ? { workspaceId } : { userId, workspaceId: null }),
      },
      select: { id: true, name: true, parentId: true },
    });

    if (!folder) break;
    breadcrumbs.unshift({ id: folder.id, name: folder.name });
    currentId = folder.parentId;
  }

  // Root prefix
  breadcrumbs.unshift({
    id: null,
    name: workspaceId ? "Workspace Drive" : "My Drive",
  });

  return breadcrumbs;
}

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
  const parentIdParam = searchParams.get("parentId");
  const parentId = parentIdParam && parentIdParam !== "root" && parentIdParam !== "null" && parentIdParam !== ""
    ? parentIdParam.trim()
    : null;
  const isTrash = searchParams.get("isTrash") === "true";
  const isStarred = searchParams.get("isStarred") === "true";
  const search = searchParams.get("search")?.trim() || "";
  const allTree = searchParams.get("all") === "true";

  if (workspaceId) {
    const member = await getWorkspaceByIdIfMember(workspaceId, session.user.id);
    if (!member) {
      return NextResponse.json({ error: "Workspace access denied" }, { status: 403 });
    }
  }

  try {
    const prisma = getPrisma();
    const baseWhere = {
      ...(workspaceId ? { workspaceId } : { userId: session.user.id, workspaceId: null }),
      isTrash,
      ...(isStarred ? { isStarred: true } : {}),
      ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {}),
    };

    let folders;
    if (allTree) {
      // Return full folder list for move modals or picker
      folders = await prisma.driveFolder.findMany({
        where: {
          ...(workspaceId ? { workspaceId } : { userId: session.user.id, workspaceId: null }),
          isTrash: false,
        },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          parentId: true,
          color: true,
        },
      });
      return NextResponse.json({ folders });
    }

    folders = await prisma.driveFolder.findMany({
      where: {
        ...baseWhere,
        ...(!search && !isStarred && !isTrash ? { parentId } : {}),
      },
      include: {
        _count: {
          select: {
            files: { where: { isTrash: false } },
            children: { where: { isTrash: false } },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    let currentFolder = null;
    let breadcrumbs: { id: string | null; name: string }[] = [
      { id: null, name: workspaceId ? "Workspace Drive" : "My Drive" },
    ];

    if (parentId) {
      currentFolder = await prisma.driveFolder.findUnique({
        where: { id: parentId },
      });
      breadcrumbs = await buildBreadcrumbs(parentId, session.user.id, workspaceId);
    }

    return NextResponse.json({
      folders: folders.map((f) => ({
        ...f,
        filesCount: f._count.files,
        foldersCount: f._count.children,
      })),
      currentFolder,
      breadcrumbs,
    });
  } catch (err) {
    console.error("Failed to fetch drive folders:", err);
    return NextResponse.json({ error: "Failed to fetch folders" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const name = String(body.name || "").trim();
    const color = body.color ? String(body.color).trim() : null;
    const parentId = body.parentId && body.parentId !== "root" ? String(body.parentId).trim() : null;
    const workspaceId = body.workspaceId && body.workspaceId !== "null" ? String(body.workspaceId).trim() : null;

    if (!name) {
      return NextResponse.json({ error: "Folder name is required" }, { status: 400 });
    }

    if (workspaceId) {
      const member = await getWorkspaceByIdIfMember(workspaceId, session.user.id);
      if (!member) {
        return NextResponse.json({ error: "Workspace access denied" }, { status: 403 });
      }
    }

    const prisma = getPrisma();

    // If parentId is specified, verify it exists and belongs to the same context
    if (parentId) {
      const parent = await prisma.driveFolder.findFirst({
        where: {
          id: parentId,
          ...(workspaceId ? { workspaceId } : { userId: session.user.id, workspaceId: null }),
        },
      });
      if (!parent) {
        return NextResponse.json({ error: "Parent folder not found" }, { status: 404 });
      }
    }

    const folder = await prisma.driveFolder.create({
      data: {
        name,
        color,
        parentId,
        userId: session.user.id,
        workspaceId,
      },
    });

    return NextResponse.json({ folder });
  } catch (err) {
    console.error("Failed to create folder:", err);
    return NextResponse.json({ error: "Failed to create folder" }, { status: 500 });
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
      return NextResponse.json({ error: "Folder ID is required" }, { status: 400 });
    }

    const prisma = getPrisma();
    const existing = await prisma.driveFolder.findUnique({
      where: { id },
      include: { workspace: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    // Auth check
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
      color?: string | null;
      parentId?: string | null;
      isStarred?: boolean;
      isTrash?: boolean;
    } = {};

    if (body.name !== undefined) {
      const trimmed = String(body.name).trim();
      if (trimmed) updateData.name = trimmed;
    }
    if (body.color !== undefined) {
      updateData.color = body.color ? String(body.color).trim() : null;
    }
    if (body.parentId !== undefined) {
      const newParentId = body.parentId && body.parentId !== "root" ? String(body.parentId).trim() : null;
      // Prevent cyclical nesting into self
      if (newParentId === id) {
        return NextResponse.json({ error: "Cannot move folder into itself" }, { status: 400 });
      }
      updateData.parentId = newParentId;
    }
    if (typeof body.isStarred === "boolean") {
      updateData.isStarred = body.isStarred;
    }
    if (typeof body.isTrash === "boolean") {
      updateData.isTrash = body.isTrash;
    }

    const updated = await prisma.driveFolder.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ folder: updated });
  } catch (err) {
    console.error("Failed to update folder:", err);
    return NextResponse.json({ error: "Failed to update folder" }, { status: 500 });
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
    return NextResponse.json({ error: "Folder ID is required" }, { status: 400 });
  }

  try {
    const prisma = getPrisma();
    const existing = await prisma.driveFolder.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    if (existing.workspaceId) {
      const member = await getWorkspaceByIdIfMember(existing.workspaceId, session.user.id);
      if (!member) {
        return NextResponse.json({ error: "Workspace access denied" }, { status: 403 });
      }
    } else if (existing.userId !== session.user.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    await prisma.driveFolder.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, id });
  } catch (err) {
    console.error("Failed to delete folder:", err);
    return NextResponse.json({ error: "Failed to delete folder" }, { status: 500 });
  }
}
