import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { getPrisma } from "@/lib/prisma";
import { getWorkspaceByIdIfMember } from "@/lib/workspace";
import { MAX_S3_UPLOAD_SIZE, s3Client, uploadFileToS3, useS3 } from "@/lib/s3";

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
    const url = await uploadFileToS3(session.user.id, file);
    const prisma = getPrisma();
    const item = await prisma.copyItem.create({
      data: {
        content: url,
        fileName,
        userId: session.user.id,
        workspaceId: workspace?.id ?? null,
      },
    });

    return NextResponse.json({
      item: {
        id: item.id,
        content: item.content,
        createdAt: item.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Upload failed:", error);
    return NextResponse.json(
      { error: "Failed to upload file to S3." },
      { status: 500 },
    );
  }
}
