import type { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { redisSub } from "../utils/redis.ts";
import { verifyToken } from "../utils/jwt.ts";
import { addPresence, refreshPresence, removePresence } from "./presence.ts";
import { storeEvent, getMissedEvents } from "./replay.ts";

export function initWsServer(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
  });

  io.use((socket, next) => {
    const token =
      (socket.handshake.auth["token"] as string | undefined) ??
      (socket.handshake.query["token"] as string | undefined);

    if (!token) return next(new Error("unauthorized"));

    try {
      const payload = verifyToken(token);
      socket.data["userId"] = payload.userId;
      socket.data["email"] = payload.email;
      next();
    } catch {
      next(new Error("invalid_token"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.data["userId"] as string;

    socket.join(`user:${userId}`);

    socket.on("subscribe", async ({ room, lastEventTimestamp }: { room: string; lastEventTimestamp?: number }) => {
      socket.join(room);

      const projectId = extractProjectId(room);
      if (projectId) await addPresence(projectId, userId);

      if (typeof lastEventTimestamp === "number") {
        const missed = await getMissedEvents(room, lastEventTimestamp);
        if (missed.length > 0) socket.emit("replay", missed);
      }
    });

    socket.on("unsubscribe", async ({ room }: { room: string }) => {
      socket.leave(room);
      const projectId = extractProjectId(room);
      if (projectId) await removePresence(projectId, userId);
    });

    socket.on("heartbeat", async ({ room }: { room: string }) => {
      const projectId = extractProjectId(room);
      if (projectId) await refreshPresence(projectId, userId);
    });

    socket.on("disconnect", async () => {
      for (const room of socket.rooms) {
        const projectId = extractProjectId(room);
        if (projectId) await removePresence(projectId, userId);
      }
    });
  });

  redisSub.psubscribe("ws:*", (err) => {
    if (err) console.error("[ws] failed to psubscribe:", err.message);
    else console.log("[ws] subscribed to ws:* channels");
  });

  redisSub.on("pmessage", async (_pattern, channel, message) => {
    const room = channel.slice(3);
    let event: unknown;

    try {
      event = JSON.parse(message) as unknown;
    } catch {
      return;
    }

    await storeEvent(room, event);
    io.to(room).emit("event", event);
  });

  console.log("[ws] Socket.IO server ready");
  return io;
}

function extractProjectId(room: string): string | null {
  const match = room.match(/^project:([a-f0-9-]{36})$/);
  return match?.[1] ?? null;
}
