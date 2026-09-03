import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { getPrisma } from "@/lib/prisma";
import { getWorkspaceByIdIfMember } from "@/lib/workspace";
import {
  getFileCategory,
  getTimeGroup,
  saveDriveFile,
} from "@/lib/driveStorage";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const folderIdParam = formData.get("folderId");
    const folderId = folderIdParam && folderIdParam !== "root" && folderIdParam !== "null"
      ? String(folderIdParam).trim()
      : null;

    const workspaceIdParam = formData.get("workspaceId");
    const workspaceId = workspaceIdParam && workspaceIdParam !== "null"
      ? String(workspaceIdParam).trim()
      : null;

    if (workspaceId) {
      const member = await getWorkspaceByIdIfMember(workspaceId, session.user.id);
      if (!member) {
        return NextResponse.json({ error: "Workspace access denied" }, { status: 403 });
      }
    }

    const prisma = getPrisma();

    // Verify folder exists if specified
    if (folderId) {
      const folder = await prisma.driveFolder.findFirst({
        where: {
          id: folderId,
          ...(workspaceId ? { workspaceId } : { userId: session.user.id, workspaceId: null }),
        },
      });
      if (!folder) {
        return NextResponse.json({ error: "Target folder not found" }, { status: 404 });
      }
    }

    const isFileLike = (val: any): val is File => {
      return (
        val &&
        typeof val === "object" &&
        typeof val.arrayBuffer === "function" &&
        typeof val.size === "number"
      );
    };

    // Collect all uploaded files
    const filesToUpload: File[] = [];
    const allEntries = formData.getAll("files");
    const singleEntry = formData.get("file");

    if (allEntries && allEntries.length > 0) {
      for (const entry of allEntries) {
        if (isFileLike(entry) && entry.size > 0) {
          filesToUpload.push(entry);
        }
      }
    }
    if (filesToUpload.length === 0 && isFileLike(singleEntry) && singleEntry.size > 0) {
      filesToUpload.push(singleEntry);
    }

    if (filesToUpload.length === 0) {
      return NextResponse.json(
        { error: "No files found in request. Please select a valid file." },
        { status: 400 }
      );
    }

    const createdFiles = [];

    for (const file of filesToUpload) {
      let saved;
      try {
        saved = await saveDriveFile(session.user.id, file);
      } catch (storageErr: any) {
        console.error("Storage error during upload:", storageErr);
        return NextResponse.json(
          { error: `Storage error: ${storageErr?.message || String(storageErr)}` },
          { status: 500 }
        );
      }

      let dbFile;
      try {
        dbFile = await prisma.driveFile.create({
          data: {
            name: saved.name,
            size: saved.size,
            mimeType: saved.mimeType,
            url: saved.url,
            storageType: saved.storageType,
            storageKey: saved.storageKey,
            folderId,
            userId: session.user.id,
            workspaceId,
          },
          include: {
            user: { select: { id: true, name: true, email: true, image: true } },
            folder: { select: { id: true, name: true, color: true } },
          },
        });
      } catch (dbErr: any) {
        console.error("Database error during drive file save:", dbErr);
        return NextResponse.json(
          { error: `Database error: ${dbErr?.message || String(dbErr)}` },
          { status: 500 }
        );
      }

      createdFiles.push({
        ...dbFile,
        category: getFileCategory(dbFile.mimeType, dbFile.name),
        timeGroup: getTimeGroup(dbFile.createdAt),
      });
    }

    return NextResponse.json({
      success: true,
      files: createdFiles,
    });
  } catch (err: any) {
    console.error("Failed to upload drive file(s):", err);
    const message = err?.message || String(err) || "Failed to upload file(s)";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
