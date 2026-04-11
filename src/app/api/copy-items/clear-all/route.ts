import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { getPrisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const prisma = getPrisma();
    const result = await prisma.copyItem.deleteMany({
      where: {
        userId: session.user.id,
        workspaceId: null,
      },
    });

    return NextResponse.json({ deletedCount: result.count });
  } catch (error) {
    console.error("Failed to clear personal clipboard:", error);
    return NextResponse.json(
      { error: "Failed to clear personal clipboard." },
      { status: 500 },
    );
  }
}
