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

router.get("/", async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: (req as any).userId } });
  res.json({ user });
});

router.put("/", async (req, res) => {
  const { name, tz, locale } = req.body || {};
  const user = await prisma.user.update({
    where: { id: (req as any).userId },
    data: { name, tz, locale }
  });
  res.json({ user });
});

export default router;
