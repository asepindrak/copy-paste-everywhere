import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { getPrisma } from "@/lib/prisma";
import { s3Client, uploadAvatarToS3, useS3 } from "@/lib/s3";

const MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!useS3 || !s3Client) {
    return NextResponse.json(
      { error: "Avatar upload is unavailable. S3 is not configured." },
      { status: 500 },
    );
  }

  const formData = await req.formData();
  const file = formData.get("file");

  if (!file || typeof file === "string" || !(file instanceof File)) {
    return NextResponse.json(
      { error: "Avatar image is required." },
      { status: 400 },
    );
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json(
      { error: "Only image files are allowed." },
      { status: 400 },
    );
  }

  if (file.size > MAX_AVATAR_SIZE) {
    return NextResponse.json(
      { error: "Avatar image exceeds the 5MB limit." },
      { status: 413 },
    );
  }

  try {
    const imageUrl = await uploadAvatarToS3(session.user.id, file);
    const prisma = getPrisma();
    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: { image: imageUrl },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
      },
    });

    return NextResponse.json({ user });
  } catch (error) {
    console.error("Failed to upload avatar:", error);
    return NextResponse.json(
      { error: "Failed to upload avatar." },
      { status: 500 },
    );
  }
}
