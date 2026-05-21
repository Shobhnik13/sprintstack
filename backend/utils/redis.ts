import Redis from "ioredis";

const url = process.env["REDIS_URL"] ?? "redis://localhost:6379";

export const redis = new Redis(url, { maxRetriesPerRequest: null });
export const redisPub = new Redis(url, { maxRetriesPerRequest: null });
export const redisSub = new Redis(url, { maxRetriesPerRequest: null });

redis.on("error", (err) => console.error("[redis]", err.message));
redisPub.on("error", (err) => console.error("[redis:pub]", err.message));
redisSub.on("error", (err) => console.error("[redis:sub]", err.message));
