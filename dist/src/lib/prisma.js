"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
exports.getPrisma = getPrisma;
require("dotenv/config");
var client_1 = require("@prisma/client");
var adapter_pg_1 = require("@prisma/adapter-pg");
var pg_1 = __importDefault(require("pg"));
var pg_connection_string_1 = require("pg-connection-string");
var globalForPrisma = global;
var databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
    throw new Error("DATABASE_URL is not defined in environment variables");
}
// Correctly parse the connection string to ensure all components (especially password) are handled
var connectionConfig = (0, pg_connection_string_1.parse)(databaseUrl);
var pool = new pg_1.default.Pool({
    user: connectionConfig.user,
    password: connectionConfig.password || undefined,
    host: connectionConfig.host || undefined,
    port: connectionConfig.port ? parseInt(connectionConfig.port, 10) : undefined,
    database: connectionConfig.database || undefined,
    ssl: (databaseUrl.includes("sslmode=require") || databaseUrl.includes("sslmode=verify-full"))
        ? { rejectUnauthorized: false }
        : false
});
var adapter = new adapter_pg_1.PrismaPg(pool);
exports.prisma = globalForPrisma.prisma ||
    new client_1.PrismaClient({
        adapter: adapter,
        log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
    });
if (process.env.NODE_ENV !== "production")
    globalForPrisma.prisma = exports.prisma;
function getPrisma() {
    return exports.prisma;
}
