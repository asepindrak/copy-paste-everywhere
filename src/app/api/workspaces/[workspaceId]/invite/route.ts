import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import {
  getWorkspaceByIdIfMember,
  createWorkspaceInvite,
} from "@/lib/workspace";
import { getSocketServer } from "@/lib/socket";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ workspaceId: string }> },
) {
  const { workspaceId } = await context.params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspace = await getWorkspaceByIdIfMember(
    workspaceId,
    session.user.id,
  );

  if (!workspace) {
    return NextResponse.json(
      { error: "Workspace not found or access denied." },
      { status: 404 },
    );
  }

  const body = await req.json();
  const inviteeEmail = String(body.inviteeEmail || "")
    .trim()
    .toLowerCase();
  if (!inviteeEmail) {
    return NextResponse.json(
      { error: "Invitee email is required." },
      { status: 400 },
    );
  }

  const invite = await createWorkspaceInvite(
    workspaceId,
    inviteeEmail,
    session.user.id,
  );

  // Emit socket event to the invitee
  const io = getSocketServer();
  if (io) {
    const emailRoom = `email:${inviteeEmail}`;
    console.log(`Emitting workspace:invite to ${emailRoom}`);
    io.to(emailRoom).emit("workspace:invite", {
      invite: {
        id: invite.id,
        workspace: {
          name: workspace.name,
        },
        invitedBy: {
          name: session.user.name,
          email: session.user.email,
        },
      },
    });
  } else {
    console.warn("Socket server not available for invite emission");
  }

  return NextResponse.json({ invite });
}
