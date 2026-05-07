import { Worker } from "bullmq";
import { redis } from "../utils/redis.ts";
import { writeActivity } from "../services/activity.service.ts";
import type { ActivityJobData } from "../utils/queues.ts";

const connection = { host: redis.options.host ?? "localhost", port: redis.options.port ?? 6379 };

export function startActivityWorker() {
  const worker = new Worker<ActivityJobData>(
    "activity-log",
    async (job) => {
      const { projectId, issueId, actorId, eventType, oldValue, newValue } = job.data;
      await writeActivity({ projectId, issueId, actorId, eventType, oldValue, newValue });
    },
    { connection, concurrency: 5 },
  );

  worker.on("failed", (job, err) => {
    console.error(`[activity-worker] job ${job?.id} failed:`, err.message);
  });

  console.log("[activity-worker] started");
  return worker;
}
