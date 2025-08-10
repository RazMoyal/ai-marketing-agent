import { Router } from "express";
import { verifyJwt } from "../lib/jwt.js";
import { getInstagramFeedMock, getTikTokFeedMock } from "../services/meta.js";

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

router.get("/instagram", async (req, res) => {
  const items = await getInstagramFeedMock((req as any).userId);
  res.json({ items });
});

router.get("/tiktok", async (req, res) => {
  const items = await getTikTokFeedMock((req as any).userId);
  res.json({ items });
});

export default router;
