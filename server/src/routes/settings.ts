
import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { verifyJwt } from "../lib/jwt.js";

const prisma = new PrismaClient();
const router = Router();

router.use((req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: "Missing token" });
  const token = auth.replace("Bearer ", "");
  const payload = verifyJwt<{ sub: string, orgId?: string }>(token);
  if (!payload) return res.status(401).json({ error: "Invalid token" });
  (req as any).userId = payload.sub;
  (req as any).orgId = payload.orgId;
  next();
});

router.get("/org", async (req, res) => {
  const org = await prisma.organization.findUnique({ where: { id: (req as any).orgId || "" } });
  res.json({ org });
});

router.put("/org/utm", async (req, res) => {
  const { utmSource, utmMedium, utmCampaign, utmTerm, utmContent } = req.body || {};
  const org = await prisma.organization.update({
    where: { id: (req as any).orgId || "" },
    data: { utmSource, utmMedium, utmCampaign, utmTerm, utmContent }
  });
  res.json({ org });
});

export default router;
