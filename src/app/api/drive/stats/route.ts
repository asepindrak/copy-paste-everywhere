import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { getPrisma } from "@/lib/prisma";
import { getWorkspaceByIdIfMember } from "@/lib/workspace";
import { formatBytes, getFileCategory } from "@/lib/driveStorage";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const workspaceIdParam = searchParams.get("workspaceId");
  const workspaceId = workspaceIdParam && workspaceIdParam !== "null"
    ? workspaceIdParam.trim()
    : null;

  if (workspaceId) {
    const member = await getWorkspaceByIdIfMember(workspaceId, session.user.id);
    if (!member) {
      return NextResponse.json({ error: "Workspace access denied" }, { status: 403 });
    }
  }

  try {
    const prisma = getPrisma();
    const files = await prisma.driveFile.findMany({
      where: {
        ...(workspaceId ? { workspaceId } : { userId: session.user.id, workspaceId: null }),
        isTrash: false,
      },
      select: {
        id: true,
        size: true,
        mimeType: true,
        name: true,
      },
    });

    const categories: Record<string, { count: number; bytes: number }> = {
      image: { count: 0, bytes: 0 },
      document: { count: 0, bytes: 0 },
      video: { count: 0, bytes: 0 },
      audio: { count: 0, bytes: 0 },
      archive: { count: 0, bytes: 0 },
      other: { count: 0, bytes: 0 },
    };

    let totalBytes = 0;

    for (const f of files) {
      totalBytes += f.size;
      const cat = getFileCategory(f.mimeType, f.name);
      const targetCat = categories[cat] ? cat : "other";
      categories[targetCat].count += 1;
      categories[targetCat].bytes += f.size;
    }

    return NextResponse.json({
      totalFiles: files.length,
      totalBytes,
      totalBytesFormatted: formatBytes(totalBytes),
      categories: Object.entries(categories).map(([key, data]) => ({
        category: key,
        count: data.count,
        bytes: data.bytes,
        formatted: formatBytes(data.bytes),
      })),
    });
  } catch (err) {
    console.error("Failed to fetch drive stats:", err);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
