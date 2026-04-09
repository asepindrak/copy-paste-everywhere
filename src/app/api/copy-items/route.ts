import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { getPrisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const cursor = searchParams.get("cursor");
    const limit = parseInt(searchParams.get("limit") || "20");
    const search = searchParams.get("search") || "";

    const prisma = getPrisma();

    // If searching, we need a different approach because data is encrypted in DB
    if (search) {
      // Fetch a larger chunk to filter in memory
      // Note: In a massive scale app, we would use blind indexing.
      // For a clipboard app, fetching recent 200 items and filtering is fast and secure.
      const allItems = await prisma.copyItem.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: "desc" },
        // If we have a cursor, we start from there
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : { take: 500 }),
      });

      const filteredItems = [];
      let nextCursor: string | null = null;
      const searchLower = search.toLowerCase();

      for (const item of allItems) {
        if (item.content.toLowerCase().includes(searchLower)) {
          filteredItems.push(item);
        }

        if (filteredItems.length === limit) {
          // Find the next item in allItems to set as cursor
          const currentIndex = allItems.indexOf(item);
          if (currentIndex < allItems.length - 1) {
            nextCursor = allItems[currentIndex + 1].id;
          }
          break;
        }
      }

      return NextResponse.json({
        items: filteredItems,
        nextCursor,
      });
    }

    // Normal flow (no search) - keep it efficient with DB pagination
    const copyItems = await prisma.copyItem.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });

    let nextCursor: string | null = null;
    if (copyItems.length > limit) {
      const nextItem = copyItems.pop();
      nextCursor = nextItem!.id;
    }

    return NextResponse.json({
      items: copyItems,
      nextCursor,
    });
  } catch (error) {
    console.error("Failed to fetch copy items:", error);
    return NextResponse.json(
      { error: "Failed to fetch copy items" },
      { status: 500 }
    );
  }
}
