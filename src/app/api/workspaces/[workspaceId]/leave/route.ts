import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { getPrisma } from "@/lib/prisma";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workspaceId } = await params;

  try {
    const prisma = getPrisma();
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, ownerId: true },
    });

    if (!workspace) {
      return NextResponse.json(
        { error: "Workspace not found." },
        { status: 404 },
      );
    }

    if (workspace.ownerId === session.user.id) {
      return NextResponse.json(
        { error: "Workspace owner cannot leave their own workspace." },
        { status: 400 },
      );
    }

    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: session.user.id,
        },
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "You are not a member of this workspace." },
        { status: 404 },
      );
    }

    await prisma.workspaceMember.delete({
      where: { id: membership.id },
    });

    return NextResponse.json({ left: true });
  } catch (error) {
    console.error("Failed to leave workspace:", error);
    return NextResponse.json(
      { error: "Failed to leave workspace." },
      { status: 500 },
    );
  }
}
