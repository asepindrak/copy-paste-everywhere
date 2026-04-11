import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { getPrisma } from "@/lib/prisma";
import { getWorkspaceByIdIfMember } from "@/lib/workspace";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const prisma = getPrisma();
    const item = await prisma.copyItem.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    if (item.workspaceId) {
      const workspace = await getWorkspaceByIdIfMember(
        item.workspaceId,
        session.user.id,
      );
      if (!workspace) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    } else if (item.userId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({
      item: {
        id: item.id,
        content: item.content,
        fileName: item.fileName,
        fileSize: item.fileSize,
        workspaceId: item.workspaceId,
        userId: item.userId,
        createdAt: item.createdAt.toISOString(),
        user: item.user
          ? {
              id: item.user.id,
              name: item.user.name,
              email: item.user.email,
            }
          : undefined,
      },
    });
  } catch (error) {
    console.error("Failed to fetch copy item:", error);
    return NextResponse.json(
      { error: "Failed to fetch copy item" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const prisma = getPrisma();

    // Check if the item belongs to the user
    const item = await prisma.copyItem.findUnique({
      where: { id },
    });

    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    if (item.userId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await prisma.copyItem.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Item deleted successfully" });
  } catch (error) {
    console.error("Failed to delete copy item:", error);
    return NextResponse.json(
      { error: "Failed to delete copy item" },
      { status: 500 },
    );
  }
}
