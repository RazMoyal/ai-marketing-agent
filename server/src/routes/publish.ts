import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { verifyJwt } from "../lib/jwt.js";
import { enqueuePublish } from "../queues/publish.js";

const prisma = new PrismaClient();
const router = Router();

router.use((req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: "Missing token" });
  const token = auth.replace("Bearer ", "");
  const payload = verifyJwt<{ sub: string }>(token);
  if (!payload) return res.status(401).json({ error: "Invalid token" });
  (req as any).userId = payload.sub;
  (req as any).orgId = (payload as any).orgId;
  next();
});

router.get("/posts", async (req, res) => {
  const items = await prisma.post.findMany({
    where: { userId: (req as any).userId },
    orderBy: [{ scheduledAt: "desc" }, { createdAt: "desc" }]
  });
  res.json({ items });
});

router.post("/publish", async (req, res) => {
  const { text, mediaUrl, mediaUrls, mediaKind, platforms, scheduledAt } = req.body || {};
  if (!text || !platforms || !Array.isArray(platforms) || platforms.length === 0) {
    return res.status(400).json({ error: "text and platforms[] required" });
  }

  const now = Date.now();
  const ts = scheduledAt ? new Date(scheduledAt).getTime() : 0;

  if (scheduledAt && ts > now + 15000) {
    const item = await prisma.post.create({
      data: {
        orgId: (req as any).orgId,
        userId: (req as any).userId,
        text, mediaUrl, mediaUrls, mediaKind, platforms,
        scheduledAt: new Date(ts),
        status: "scheduled",
        attemptCount: 0,
      } as any
    });
    await enqueuePublish({ postId: item.id }, { delay: ts - now });
    return res.json({ scheduled: true, item });
  }

  const item = await prisma.post.create({
    data: {
      orgId: (req as any).orgId,
      userId: (req as any).userId,
      text, mediaUrl, mediaUrls, mediaKind, platforms,
      status: "scheduled",
      attemptCount: 0,
    } as any
  });
  await enqueuePublish({ postId: item.id }, { delay: 0 });
  return res.json({ scheduled: false, enqueued: true, item });
});

export default router;
