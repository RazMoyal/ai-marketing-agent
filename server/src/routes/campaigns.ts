import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { verifyJwt } from "../lib/jwt.js";
import { campaignSchema } from "../lib/validators.js";
import { boostPost } from "../services/meta.js";

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

router.get("/", async (req, res) => {
  const items = await prisma.campaign.findMany({ where: { userId: (req as any).userId }, orderBy: { createdAt: "desc" } });
  res.json({ items });
});

router.post("/", async (req, res) => {
  const parsed = campaignSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error);
  const data = parsed.data;
  const item = await prisma.campaign.create({
    data: {
      userId: (req as any).userId,
      orgId: (req as any).orgId,
      name: data.name,
      platform: data.platform,
      objective: data.objective,
      budget: data.budget,
      startDate: data.startDate ? new Date(data.startDate) : null,
      endDate: data.endDate ? new Date(data.endDate) : null,
      status: "active"
    }
  });
  res.json({ item });
});

router.post("/:id/boost", async (req, res) => {
  const { id } = req.params;
  const { postId, budget, audience } = req.body || {};
  const campaign = await prisma.campaign.findFirst({ where: { id, userId: (req as any).userId } });
  if (!campaign) return res.status(404).json({ error: "Not found" });

  const result = await boostPost({ postId, budget: Number(budget || campaign.budget), audience });
  res.json({ ok: true, result });
});

export default router;


// simple templates
router.get("/templates", async (req, res) => {
  res.json({
    templates: [
      { id: "reach_ig", name: "IG Reach (Reels)", platform: "instagram", objective: "reach", budget: 50, recommendedKind: "reel" },
      { id: "fb_leads", name: "FB Leads", platform: "facebook", objective: "leads", budget: 70, recommendedKind: "image" },
      { id: "tt_awareness", name: "TikTok Awareness", platform: "tiktok", objective: "awareness", budget: 40, recommendedKind: "video" }
    ]
  });
});
