import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { getPrisma } from "@/lib/prisma";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workspaceId } = await params;
  const body = await req.json().catch(() => null);
  const confirmationName =
    typeof body?.confirmationName === "string"
      ? body.confirmationName.trim()
      : "";

  try {
    const prisma = getPrisma();
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, name: true, ownerId: true },
    });

    if (!workspace) {
      return NextResponse.json(
        { error: "Workspace not found." },
        { status: 404 },
      );
    }

    if (workspace.ownerId !== session.user.id) {
      return NextResponse.json(
        { error: "Only the workspace owner can delete this workspace." },
        { status: 403 },
      );
    }

    if (confirmationName !== workspace.name) {
      return NextResponse.json(
        { error: "Workspace name confirmation does not match." },
        { status: 400 },
      );
    }

    await prisma.workspace.delete({
      where: { id: workspace.id },
    });

    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("Failed to delete workspace:", error);
    return NextResponse.json(
      { error: "Failed to delete workspace." },
      { status: 500 },
    );
  }
}
