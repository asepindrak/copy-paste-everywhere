import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { parse as parseConnectionString } from "pg-connection-string";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not defined in environment variables");
}

// Correctly parse the connection string to ensure all components (especially password) are handled
const connectionConfig = parseConnectionString(databaseUrl);

const pool = new pg.Pool({
  user: connectionConfig.user,
  password: connectionConfig.password || undefined,
  host: connectionConfig.host || undefined,
  port: connectionConfig.port ? parseInt(connectionConfig.port, 10) : undefined,
  database: connectionConfig.database || undefined,
  ssl: databaseUrl.includes("sslmode=require") ? { rejectUnauthorized: false } : false
});

const adapter = new PrismaPg(pool);

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export function getPrisma() {
  return prisma;
}
