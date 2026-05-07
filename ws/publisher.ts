import { redisPub } from "../utils/redis.ts";

export interface WsEvent {
  type: string;
  payload: unknown;
  actor_id?: string;
  timestamp: string;
}

export async function publish(room: string, type: string, payload: unknown, actorId?: string) {
  const event: WsEvent = {
    type,
    payload,
    actor_id: actorId,
    timestamp: new Date().toISOString(),
  };
  await redisPub.publish(`ws:${room}`, JSON.stringify(event));
}
