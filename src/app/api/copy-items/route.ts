import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth.config";
import { getPrisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const prisma = getPrisma();
    const copyItems = await prisma.copyItem.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json(copyItems);
  } catch (error) {
    console.error("Failed to fetch copy items:", error);
    return NextResponse.json(
      { error: "Failed to fetch copy items" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const prisma = getPrisma();
    const { content } = await req.json();

    if (!content) {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 },
      );
    }

    const copyItem = await prisma.copyItem.create({
      data: {
        content,
        userId: session.user.id,
      },
    });

    return NextResponse.json(copyItem, { status: 201 });
  } catch (error) {
    console.error("Failed to create copy item:", error);
    return NextResponse.json(
      { error: "Failed to create copy item" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const prisma = getPrisma();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    const copyItem = await prisma.copyItem.findUnique({
      where: { id },
    });

    if (!copyItem || copyItem.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Copy item not found or unauthorized" },
        { status: 404 },
      );
    }

    await prisma.copyItem.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Copy item deleted" });
  } catch (error) {
    console.error("Failed to delete copy item:", error);
    return NextResponse.json(
      { error: "Failed to delete copy item" },
      { status: 500 },
    );
  }
}
