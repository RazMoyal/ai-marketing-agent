import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { verifyJwt } from "../lib/jwt.js";
import { leadSchema } from "../lib/validators.js";
import { sendWhatsApp } from "../services/whatsapp.js";

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
  const q = String(req.query.q || "");
  const items = await prisma.lead.findMany({
    where: {
      userId: (req as any).userId,
      OR: q ? [
        { name: { contains: q } },
        { email: { contains: q } },
        { phone: { contains: q } }
      ] : undefined
    },
    orderBy: { createdAt: "desc" }
  });
  res.json({ items });
});

router.post("/", async (req, res) => {
  const parsed = leadSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error);
  const data = parsed.data;
  const item = await prisma.lead.create({ data: {
      orgId: (req as any).orgId, ...data, userId: (req as any).userId } });

  // WhatsApp notification if phone configured
  const dest = process.env.WHATSAPP_DESTINATION_NUMBER || item.phone;
  if (dest) {
    await sendWhatsApp(dest, `ליד חדש: ${item.name ?? ''} ${item.phone ?? ''} ${item.email ?? ''}`);
  }
  res.json({ item });
});

export default router;
