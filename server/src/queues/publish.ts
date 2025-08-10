import { Queue, Worker, JobsOptions } from "bullmq";
import IORedis from "ioredis";
import { PrismaClient } from "@prisma/client";
import { publishToPlatforms } from "../services/publishers.js";
import cron from "node-cron";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
const connection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

export const publishQueue = new Queue("publish", { connection });
const prisma = new PrismaClient();

export function enqueuePublish(jobData: any, opts?: JobsOptions) {
  return publishQueue.add("publish", jobData, opts);
}

export const publishWorker = new Worker(
  "publish",
  async (job) => {
    const { postId } = job.data as any;
    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) return;
    const res = await publishToPlatforms({
      userId: post.userId,
      text: post.text,
      mediaUrl: post.mediaUrl ?? undefined,
      mediaUrls: (post as any).mediaUrls ?? undefined,
      mediaKind: (post as any).mediaKind ?? undefined,
      platforms: (post.platforms as any),
    });
    const allOk = Object.values(res).every((r: any) => r && r.ok);
    await prisma.post.update({
      where: { id: post.id },
      data: {
        status: allOk ? "published" : "failed",
        result: res,
        lastError: allOk ? null : JSON.stringify(res),
      },
    });
  },
  { connection, concurrency: 5 }
);

// ⛑️ cron fallback ל-delayed (כל חצי דקה מכניס לתור פוסטים שתוזמנו וזמנם הגיע)מ
cron.schedule("*/0.5 * * * *", async () => {
  const due = await prisma.post.findMany({
    where: { status: "scheduled", scheduledAt: { lte: new Date() } },
    take: 20, orderBy: { scheduledAt: "asc" },
  });
  for (const p of due) {
    await enqueuePublish({ postId: p.id }, { delay: 0 });
  }
});
