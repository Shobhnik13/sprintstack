import { redis } from "../utils/redis.ts";

const PRESENCE_TTL = 30; // seconds

export async function addPresence(projectId: string, userId: string) {
  const key = `presence:project:${projectId}`;
  await redis.sadd(key, userId);
  await redis.expire(key, PRESENCE_TTL);
}

export async function refreshPresence(projectId: string, userId: string) {
  await addPresence(projectId, userId);
}

export async function removePresence(projectId: string, userId: string) {
  await redis.srem(`presence:project:${projectId}`, userId);
}

export async function getPresenceMembers(projectId: string): Promise<string[]> {
  return redis.smembers(`presence:project:${projectId}`);
}
