import { hash, compare } from "bcryptjs";
import { getPrisma } from "./prisma";

export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10;
  return hash(password, saltRounds);
}

export async function verifyPassword(
  password: string,
  hashedPassword: string,
): Promise<boolean> {
  return compare(password, hashedPassword);
}

export async function getUserByEmail(email: string) {
  const prisma = getPrisma();
  return prisma.user.findUnique({
    where: { email },
  });
}

export async function createUser(
  email: string,
  password: string,
  name?: string,
) {
  const hashedPassword = await hashPassword(password);
  const prisma = getPrisma();
  return prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      name,
    },
  });
}
