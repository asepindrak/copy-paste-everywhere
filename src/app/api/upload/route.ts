import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { getPrisma } from "@/lib/prisma";
import { getWorkspaceByIdIfMember } from "@/lib/workspace";
import { MAX_S3_UPLOAD_SIZE, s3Client, uploadFileToS3, useS3 } from "@/lib/s3";
import { getSocketServer } from "@/lib/socket";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!useS3 || !s3Client) {
    return NextResponse.json(
      { error: "S3 is not configured. File uploads are disabled." },
      { status: 500 },
    );
  }

  const formData = await req.formData();
  const file = formData.get("file");
  const workspaceId = String(formData.get("workspaceId") || "").trim() || null;

  if (!file || typeof file === "string" || !(file instanceof File)) {
    return NextResponse.json({ error: "File is required." }, { status: 400 });
  }

  if (file.size > MAX_S3_UPLOAD_SIZE) {
    return NextResponse.json(
      { error: "File size exceeds the 5GB upload limit." },
      { status: 413 },
    );
  }

  let workspace = null;
  if (workspaceId) {
    workspace = await getWorkspaceByIdIfMember(workspaceId, session.user.id);
    if (!workspace) {
      return NextResponse.json(
        { error: "Workspace not found or access denied." },
        { status: 403 },
      );
    }
  }

  try {
    const fileName = file.name || "download";
    const fileSize = file.size;
    const url = await uploadFileToS3(session.user.id, file);
    const prisma = getPrisma();
    const item = await prisma.copyItem.create({
      data: {
        content: url,
        fileName,
        fileSize,
        userId: session.user.id,
        workspaceId: workspace?.id ?? null,
      },
      include: { user: true },
    });

    const result = {
      id: item.id,
      content: item.content,
      fileName: item.fileName,
      fileSize: item.fileSize,
      userId: item.userId,
      user: {
        id: item.user.id,
        name: item.user.name,
        email: item.user.email,
      },
      workspaceId: item.workspaceId,
      createdAt: item.createdAt.toISOString(),
    };

    const io = getSocketServer();
    if (io) {
      const targetRoom = workspace?.id
        ? `workspace:${workspace.id}`
        : `user:${session.user.id}`;
      io.to(targetRoom).emit("clipboard:updated", result);
    }

    return NextResponse.json({ item: result });
  } catch (error) {
    console.error("Upload failed:", error);
    return NextResponse.json(
      { error: "Failed to upload file to S3." },
      { status: 500 },
    );
  }
}
