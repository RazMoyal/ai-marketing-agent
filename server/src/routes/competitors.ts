import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { verifyJwt } from "../lib/jwt.js";
import { competitorSchema } from "../lib/validators.js";
import { analyzeTikTokCompetitor } from "../services/tiktok.js";

const prisma = new PrismaClient();
const router = Router();

router.use((req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: "Missing token" });
  const token = auth.replace("Bearer ", "");
  const payload = verifyJwt<{ sub: string; orgId?: string }>(token);
  if (!payload) return res.status(401).json({ error: "Invalid token" });
  (req as any).userId = payload.sub;
  (req as any).orgId = payload.orgId;
  next();
});

router.get("/", async (req, res) => {
  const items = await prisma.competitor.findMany({
    where: { userId: (req as any).userId, orgId: (req as any).orgId },
    orderBy: [{ createdAt: "desc" }, { updatedAt: "desc" }],
  });
  res.json({ items });
});

router.post("/", async (req, res) => {
  const parsed = competitorSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error);
  const data = parsed.data;

  // מונע כפילויות לפי (userId, platform, handle)
  const item = await prisma.competitor.upsert({
    where: {
      userId_platform_handle: {
        userId: (req as any).userId,
        platform: data.platform,
        handle: data.handle,
      },
    } as any,
    create: {
      orgId: (req as any).orgId,
      ...data,
      userId: (req as any).userId,
    },
    update: {
      note: (data as any).note ?? undefined,
    },
  });

  res.json({ item });
});

router.post("/analyze", async (req, res) => {
  const items = await prisma.competitor.findMany({
    where: { userId: (req as any).userId, orgId: (req as any).orgId },
  });

  const results = await Promise.all(
    items.map(async (c:any) => {
      if (c.platform === "tiktok") return analyzeTikTokCompetitor(c.handle);
      // TODO: להוסיף ניתוח IG/FB אמיתי דרך Graph API
      return {
        handle: c.handle,
        postsPerWeek: 3,
        avgViews: 1200,
        topFormats: ["reel", "carousel"],
      };
    })
  );

  res.json({ results });
});

router.delete("/:id", async (req, res) => {
  const id = req.params.id;
  await prisma.competitor.deleteMany({
    where: { id, userId: (req as any).userId, orgId: (req as any).orgId },
  });
  res.json({ ok: true });
});

export default router;
