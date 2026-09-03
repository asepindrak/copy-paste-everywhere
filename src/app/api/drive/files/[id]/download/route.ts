import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { getPrisma } from "@/lib/prisma";
import { getWorkspaceByIdIfMember } from "@/lib/workspace";
import fs from "fs";
import path from "path";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "File ID required" }, { status: 400 });
  }

  try {
    const prisma = getPrisma();
    const file = await prisma.driveFile.findUnique({
      where: { id },
    });

    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Access check
    if (file.workspaceId) {
      const member = await getWorkspaceByIdIfMember(file.workspaceId, session.user.id);
      if (!member) {
        return NextResponse.json({ error: "Workspace access denied" }, { status: 403 });
      }
    } else if (file.userId !== session.user.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const forceDownload = searchParams.get("download") === "true";

    // If S3, proxy download with original filename when forceDownload is true, or redirect
    if (file.storageType === "s3" && file.url.startsWith("http")) {
      if (forceDownload) {
        try {
          const s3Res = await fetch(file.url);
          if (s3Res.ok && s3Res.body) {
            return new NextResponse(s3Res.body as any, {
              status: 200,
              headers: {
                "Content-Type": file.mimeType || "application/octet-stream",
                "Content-Disposition": `attachment; filename="${encodeURIComponent(file.name)}"`,
              },
            });
          }
        } catch (err) {
          console.error("Failed to proxy S3 download:", err);
        }
      }
      return NextResponse.redirect(file.url);
    }

    // Local file streaming
    let localPath = file.storageKey;
    if (!localPath || !fs.existsSync(localPath)) {
      // Check public directory
      if (file.url.startsWith("/uploads/drive/")) {
        localPath = path.join(process.cwd(), "public", file.url);
      }
    }

    if (!localPath || !fs.existsSync(localPath)) {
      return NextResponse.json({ error: "File not found on storage" }, { status: 404 });
    }

    const stat = fs.statSync(localPath);
    const fileStream = fs.createReadStream(localPath);
    const readableStream = new ReadableStream({
      start(controller) {
        fileStream.on("data", (chunk) => controller.enqueue(chunk));
        fileStream.on("end", () => controller.close());
        fileStream.on("error", (err) => controller.error(err));
      },
    });

    const disposition = forceDownload
      ? `attachment; filename="${encodeURIComponent(file.name)}"`
      : `inline; filename="${encodeURIComponent(file.name)}"`;

    return new NextResponse(readableStream, {
      status: 200,
      headers: {
        "Content-Type": file.mimeType || "application/octet-stream",
        "Content-Length": String(stat.size),
        "Content-Disposition": disposition,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    console.error("Failed to download file:", err);
    return NextResponse.json({ error: "Download failed" }, { status: 500 });
  }
}
