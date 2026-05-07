import { redis } from "../utils/redis.ts";

const MAX_EVENTS = 100;
const EVENT_TTL = 600; // 10 minutes

export async function storeEvent(room: string, event: unknown) {
  const key = `events:${room}`;
  const score = Date.now();
  await redis.zadd(key, score, JSON.stringify(event));
  // Keep only the last MAX_EVENTS entries
  await redis.zremrangebyrank(key, 0, -(MAX_EVENTS + 1));
  await redis.expire(key, EVENT_TTL);
}

export async function getMissedEvents(room: string, sinceTimestamp: number): Promise<unknown[]> {
  const key = `events:${room}`;
  const raw = await redis.zrangebyscore(key, sinceTimestamp + 1, "+inf");
  return raw.map((r) => JSON.parse(r) as unknown);
}
