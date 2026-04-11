import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { acceptWorkspaceInvite } from "@/lib/workspace";

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

  const membership = await acceptWorkspaceInvite(
    inviteId,
    session.user.id,
    session.user.email,
  );
  if (!membership) {
    return NextResponse.json(
      { error: "Unable to accept this invite." },
      { status: 400 },
    );
  }

  return NextResponse.json({ accepted: true });
}
