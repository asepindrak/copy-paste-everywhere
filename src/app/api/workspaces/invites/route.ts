import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { getPendingInvitesForEmail } from "@/lib/workspace";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const invites = await getPendingInvitesForEmail(session.user.email);
  return NextResponse.json({ invites });
}

export async function POST(req: Request) {
  return NextResponse.json({ error: "Method not allowed." }, { status: 405 });
}
