import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { getPrisma } from "@/lib/prisma";
import { getWorkspaceByIdIfMember } from "@/lib/workspace";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workspaceId } = await params;
  const workspace = await getWorkspaceByIdIfMember(
    workspaceId,
    session.user.id,
  );
  if (!workspace) {
    return NextResponse.json(
      { error: "Workspace not found." },
      { status: 404 },
    );
  }

  try {
    const members = await getPrisma().workspaceMember.findMany({
      where: { workspaceId },
      include: { user: true },
    });

    const users = members.map((member) => ({
      id: member.user.id,
      name: member.user.name,
      email: member.user.email,
    }));

    return NextResponse.json({ users });
  } catch (error) {
    console.error("Failed to load workspace members:", error);
    return NextResponse.json(
      { error: "Failed to load workspace members." },
      { status: 500 },
    );
  }
}
