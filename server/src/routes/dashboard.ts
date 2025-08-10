import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { verifyJwt } from "../lib/jwt.js";

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

router.get("/summary", async (req, res) => {
  const [campaigns, leads, notifications] = await Promise.all([
    prisma.campaign.count({ where: { userId: (req as any).userId, status: "active" } }),
    prisma.lead.count({ where: { userId: (req as any).userId } }),
    prisma.notification.findMany({ where: { userId: (req as any).userId }, orderBy: { createdAt: "desc" }, take: 5 })
  ]);
  const stats = {
    views: 12000 + Math.floor(Math.random()*5000),
    likes: 2400 + Math.floor(Math.random()*1000),
    comments: 400 + Math.floor(Math.random()*200),
    shares: 120 + Math.floor(Math.random()*80),
    conversionRate: 4.2 + Math.random()*2
  };
  res.json({ campaigns, leads, notifications, stats });
});

export default router;
