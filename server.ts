import "dotenv/config";
process.env.PRISMA_CLIENT_ENGINE_TYPE = "library";
import http from "http";
import { parse } from "url";
import next from "next";
import { Server } from "socket.io";
import * as cookie from "cookie";
import { getToken } from "next-auth/jwt";
import { getPrisma } from "./src/lib/prisma";
import { isImageDataUrl, uploadBase64ImageToS3, useS3 } from "./src/lib/s3";
import { getWorkspaceByIdIfMember } from "./src/lib/workspace";

const dev = process.env.NODE_ENV !== "production";
const PORT = Number(process.env.PORT ?? 3000);

// For development, we allow all localhost variants
const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_API_URL,
  `http://localhost:${PORT}`,
  `http://127.0.0.1:${PORT}`,
].filter(Boolean) as string[];

const app = next({ dev });
const handle = app.getRequestHandler();

const server = http.createServer((req, res) => {
  const parsedUrl = parse(req.url ?? "", true);
  handle(req, res, parsedUrl);
});

interface CopyItemPayload {
  content: string;
  workspaceId?: string;
}

interface ClipboardUpdateAck {
  item?: {
    id: string;
    content: string;
    createdAt: string;
  };
  error?: string;
}

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || ALLOWED_ORIGINS.includes(origin) || dev) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  },
  // Use polling then upgrade for better compatibility
  transports: ["polling", "websocket"],
});

io.use(async (socket, next) => {
  try {
    const req = socket.request as any;
    const cookieHeader = req.headers?.cookie ?? "";
    const cookies = cookie.parse(cookieHeader);
    req.cookies = cookies;

    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) {
      console.error("NEXTAUTH_SECRET is not defined");
      return next(new Error("Server configuration error"));
    }

    // Try multiple cookie names to be safe
    const cookieNames = [
      "__Secure-next-auth.session-token",
      "next-auth.session-token",
    ];

    let token = null;
    for (const cookieName of cookieNames) {
      token = await getToken({
        req,
        secret,
        secureCookie: cookieName.startsWith("__Secure-"),
        cookieName,
      });
      if (token) break;
    }

    if (!token?.sub) {
      return next(new Error("Unauthorized"));
    }

    socket.data.userId = token.sub;
    next();
  } catch (error) {
    console.error("Socket Auth Error:", error);
    next(new Error("Socket authentication failed"));
  }
});

io.on("connection", async (socket) => {
  const userId = socket.data.userId as string;
  const room = `user:${userId}`;

  socket.join(room);

  socket.on("workspace:join", async (workspaceId: string) => {
    if (!workspaceId) return;

    const workspace = await getWorkspaceByIdIfMember(workspaceId, userId);
    if (!workspace) {
      return;
    }

    socket.join(`workspace:${workspaceId}`);
  });

  socket.on("workspace:leave", async (workspaceId: string) => {
    if (!workspaceId) return;

    socket.leave(`workspace:${workspaceId}`);
  });

  socket.on(
    "clipboard:update",
    async (
      payload: CopyItemPayload,
      callback: (ack: ClipboardUpdateAck) => void,
    ) => {
      if (!payload || typeof payload.content !== "string") {
        return callback({ error: "Invalid clipboard payload." });
      }

      try {
        // If content is empty or whitespace only, broadcast but don't save to DB
        if (!payload.content.trim()) {
          const result = {
            id: "temporary-empty",
            content: "",
            createdAt: new Date().toISOString(),
            userId,
            user: undefined,
            workspaceId: payload.workspaceId ?? null,
          };
          io.to(room).emit("clipboard:updated", result);
          return callback({ item: result });
        }

        const allowedWorkspaceId = payload.workspaceId
          ? await getWorkspaceByIdIfMember(payload.workspaceId, userId)
          : null;

        if (payload.workspaceId && !allowedWorkspaceId) {
          return callback({ error: "Invalid workspace access." });
        }

        const contentToStore =
          useS3 && isImageDataUrl(payload.content)
            ? await uploadBase64ImageToS3(userId, payload.content)
            : payload.content;

        const item = await getPrisma().copyItem.create({
          data: {
            content: contentToStore,
            userId,
            workspaceId: allowedWorkspaceId ? payload.workspaceId : null,
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

        const targetRoom = allowedWorkspaceId
          ? `workspace:${payload.workspaceId}`
          : room;

        io.to(targetRoom).emit("clipboard:updated", result);
        callback({ item: result });
      } catch (error) {
        console.error("Database error in clipboard:update:", error);
        callback({ error: "Failed to save clipboard in real-time." });
      }
    },
  );

  socket.on("disconnect", (reason) => {});
});

app.prepare().then(() => {
  server.listen(PORT, () => {
    console.log(
      `> Ready on http://localhost:${PORT} [${process.env.NODE_ENV || "development"}]`,
    );
  });
});
