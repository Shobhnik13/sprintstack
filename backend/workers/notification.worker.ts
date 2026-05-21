import { Worker } from "bullmq";
import { db } from "../db/index.ts";
import { notifications } from "../db/schema/comments.ts";
import { redis } from "../utils/redis.ts";
import { redisPub } from "../utils/redis.ts";
import type { NotificationJobData } from "../utils/queues.ts";

const connection = { host: redis.options.host ?? "localhost", port: redis.options.port ?? 6379 };

export function startNotificationWorker() {
  const worker = new Worker<NotificationJobData>(
    "notifications",
    async (job) => {
      const { recipientId, actorId, issueId, projectId, type } = job.data;

      const [notification] = await db
        .insert(notifications)
        .values({ recipient_id: recipientId, actor_id: actorId, issue_id: issueId, type })
        .returning();

      await redisPub.publish(
        `ws:user:${recipientId}`,
        JSON.stringify({
          type: "notification",
          payload: notification,
          timestamp: new Date().toISOString(),
        }),
      );
    },
    { connection, concurrency: 10 },
  );

  worker.on("failed", (job, err) => {
    console.error(`[notification-worker] job ${job?.id} failed:`, err.message);
  });

  console.log("[notification-worker] started");
  return worker;
}
