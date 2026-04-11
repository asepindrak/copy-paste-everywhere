import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { acceptWorkspaceInvite } from "@/lib/workspace";
import { getSocketServer } from "@/lib/socket";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const inviteId = String(body.inviteId || "").trim();
  if (!inviteId) {
    return NextResponse.json(
      { error: "Invite id is required." },
      { status: 400 },
    );
  }

  const result = await acceptWorkspaceInvite(
    inviteId,
    session.user.id,
    session.user.email,
  );
  if (!result) {
    return NextResponse.json(
      { error: "Unable to accept this invite." },
      { status: 400 },
    );
  }

  const { invite } = result;

  // Emit socket event to the inviter
  const io = getSocketServer();
  if (io && invite.invitedById) {
    const inviterRoom = `user:${invite.invitedById}`;
    console.log(`Emitting workspace:invite:accepted to ${inviterRoom}`);
    io.to(inviterRoom).emit("workspace:invite:accepted", {
      workspaceName: invite.workspace.name,
      inviteeName: session.user.name || session.user.email,
    });
  }

  return NextResponse.json({ accepted: true });
}
