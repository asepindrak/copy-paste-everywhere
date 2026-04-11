import type { Server } from "socket.io";

const globalWithSocket = global as typeof globalThis & {
  socketServer: Server | null;
};

export function setSocketServer(server: Server) {
  globalWithSocket.socketServer = server;
}

export function getSocketServer(): Server | null {
  return globalWithSocket.socketServer || null;
}

if (!globalWithSocket.socketServer) {
  globalWithSocket.socketServer = null;
}
