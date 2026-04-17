import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { getPrisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/auth";

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const name =
      typeof body?.name === "string" ? body.name.trim().slice(0, 80) : null;
    const image =
      typeof body?.image === "string" ? body.image.trim().slice(0, 2048) : null;
    const currentPassword =
      typeof body?.currentPassword === "string" ? body.currentPassword : "";
    const newPassword =
      typeof body?.newPassword === "string" ? body.newPassword : "";

    const wantsPasswordUpdate = Boolean(currentPassword || newPassword);

    const prisma = getPrisma();
    let nextPasswordHash: string | undefined;

    if (wantsPasswordUpdate) {
      if (!currentPassword || !newPassword) {
        return NextResponse.json(
          { error: "Current password and new password are required." },
          { status: 400 },
        );
      }

      if (newPassword.length < 8) {
        return NextResponse.json(
          { error: "New password must be at least 8 characters." },
          { status: 400 },
        );
      }

      const existingUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { password: true },
      });

      if (!existingUser) {
        return NextResponse.json({ error: "User not found." }, { status: 404 });
      }

      const isCurrentPasswordValid = await verifyPassword(
        currentPassword,
        existingUser.password,
      );

      if (!isCurrentPasswordValid) {
        return NextResponse.json(
          { error: "Current password is incorrect." },
          { status: 400 },
        );
      }

      nextPasswordHash = await hashPassword(newPassword);
    }

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        ...(name !== null ? { name: name || null } : {}),
        ...(image !== null ? { image: image || null } : {}),
        ...(nextPasswordHash ? { password: nextPasswordHash } : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
      },
    });

    return NextResponse.json({ user });
  } catch (error) {
    console.error("Failed to update profile:", error);
    return NextResponse.json(
      { error: "Failed to update profile." },
      { status: 500 },
    );
  }
}
