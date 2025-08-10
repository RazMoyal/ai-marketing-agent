import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { verifyJwt } from "../lib/jwt.js";
import {
  metaListResources,
  metaRefreshLongLived,
  metaListBusinesses,
  metaBusinessAdAccounts,
} from "../services/meta.js";
import { tiktokRefreshToken } from "../services/tiktok.js";

const prisma = new PrismaClient();
const router = Router();

const ALLOWED_PLATFORMS = new Set(["facebook", "instagram", "tiktok", "whatsapp"]);

router.use((req, res, next) => {
  try {
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).json({ error: "Missing token" });
    const token = auth.replace("Bearer ", "");
    const payload = verifyJwt<{ sub: string; orgId?: string }>(token);
    if (!payload) return res.status(401).json({ error: "Invalid token" });
    (req as any).userId = payload.sub;
    (req as any).orgId = payload.orgId || null;
    next();
  } catch (e) {
    return res.status(401).json({ error: "Unauthorized" });
  }
});

/** חיווי סטטוס חיבורים */
router.get("/status", async (req, res) => {
  const items = await prisma.socialConnection.findMany({
    where: { userId: (req as any).userId, orgId: (req as any).orgId },
    orderBy: { createdAt: "desc" },
  });
  res.json({ connections: items });
});

/** חיבור/עדכון פלטפורמה (שומר access/refresh/meta) */
router.post("/:platform/connect", async (req, res) => {
  try {
    const { platform } = req.params;
    if (!ALLOWED_PLATFORMS.has(platform)) return res.status(400).json({ error: "Unsupported platform" });
    const { accessToken, refreshToken, meta } = req.body || {};
    const userId = (req as any).userId;
    const orgId = (req as any).orgId;

    const conn = await prisma.socialConnection.upsert({
      where: { userId_platform: { userId, platform } } as any,
      create: {
        userId,
        orgId,
        platform,
        ...(accessToken ? { accessToken } : {}),
        ...(refreshToken ? { refreshToken } : {}),
        ...(meta ? { meta } : {}),
      },
      update: {
        ...(accessToken ? { accessToken } : {}),
        ...(refreshToken ? { refreshToken } : {}),
        ...(meta ? { meta } : {}),
      },
    });

    res.json({ connection: conn });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "connect_failed" });
  }
});

/** ניתוק פלטפורמה */
router.post("/:platform/disconnect", async (req, res) => {
  const { platform } = req.params;
  if (!ALLOWED_PLATFORMS.has(platform)) return res.status(400).json({ error: "Unsupported platform" });
  await prisma.socialConnection.deleteMany({
    where: { userId: (req as any).userId, orgId: (req as any).orgId, platform },
  });
  res.json({ ok: true });
});

/** Meta: משאבים (דפים / IG חשבונות / Ad Accounts) עם user/page token */
router.get("/meta/resources", async (req, res) => {
  try {
    const fb = await prisma.socialConnection.findFirst({
      where: { userId: (req as any).userId, orgId: (req as any).orgId, platform: "facebook" },
    });
    if (!fb?.accessToken) return res.status(400).json({ error: "Facebook not connected" });

    // רענון אופציונלי לטוקן ארוך-טווח אם תרצה (מומלץ פעם ב־24ש׳/Webhook)
    const appId = process.env.META_APP_ID || "";
    const appSecret = process.env.META_APP_SECRET || "";
    let token = fb.accessToken;
    if (appId && appSecret) {
      try {
        token = await metaRefreshLongLived(token, appId, appSecret);
        if (token && token !== fb.accessToken) {
          await prisma.socialConnection.update({ where: { id: fb.id }, data: { accessToken: token } });
        }
      } catch { /* ignore refresh failure */ }
    }

    const data = await metaListResources(token);
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "meta_resources_failed" });
  }
});

/** Meta: שמירת בחירות ברירת מחדל (page / ad_account / ig_business_account) */
router.post("/meta/select", async (req, res) => {
  try {
    const { page_id, ad_account_id, ig_business_account_id } = req.body || {};
    const userId = (req as any).userId;
    const orgId = (req as any).orgId;

    await prisma.$transaction(async (tx) => {
      // עדכון facebook meta
      const fb = await tx.socialConnection.upsert({
        where: { userId_platform: { userId, platform: "facebook" } } as any,
        create: {
          userId,
          orgId,
          platform: "facebook",
          meta: { ...(page_id ? { page_id } : {}), ...(ad_account_id ? { ad_account_id } : {}) },
        },
        update: {
          meta: {
            ...(page_id ? { page_id } : {}),
            ...(ad_account_id ? { ad_account_id } : {}),
          },
        },
      });

      // יצירה/עדכון של רשומת instagram עם ig_business_account_id (משתמשים ב־page token לפרסום IG)
      if (ig_business_account_id) {
        await tx.socialConnection.upsert({
          where: { userId_platform: { userId, platform: "instagram" } } as any,
          create: {
            userId,
            orgId,
            platform: "instagram",
            accessToken: fb.accessToken || undefined,
            meta: { ig_business_account_id, ...(page_id ? { page_id } : {}) },
          },
          update: {
            meta: { ig_business_account_id, ...(page_id ? { page_id } : {}) },
            ...(fb.accessToken ? { accessToken: fb.accessToken } : {}),
          },
        });
      }
    });

    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "meta_select_failed" });
  }
});

/** Meta: רענון ידני לטוקן ארוך-טווח (לא חובה אם יש אוטומציה/Webhook) */
router.post("/refresh/meta", async (req, res) => {
  try {
    const appId = process.env.META_APP_ID || "";
    const appSecret = process.env.META_APP_SECRET || "";
    if (!appId || !appSecret) return res.status(400).json({ error: "Missing app credentials" });

    const fb = await prisma.socialConnection.findFirst({
      where: { userId: (req as any).userId, orgId: (req as any).orgId, platform: "facebook" },
    });
    if (!fb?.accessToken) return res.status(400).json({ error: "Facebook not connected" });

    const newToken = await metaRefreshLongLived(fb.accessToken, appId, appSecret);
    await prisma.socialConnection.update({ where: { id: fb.id }, data: { accessToken: newToken } });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "meta_refresh_failed" });
  }
});

/** TikTok: רענון ידני */
router.post("/refresh/tiktok", async (req, res) => {
  try {
    const userId = (req as any).userId;
    const orgId = (req as any).orgId;
    const tt = await prisma.socialConnection.findFirst({
      where: { userId, orgId, platform: "tiktok" },
    });
    if (!tt?.refreshToken) return res.status(400).json({ error: "TikTok not connected" });

    const out = await tiktokRefreshToken(
      tt.refreshToken,
      process.env.TIKTOK_APP_ID || "",
      process.env.TIKTOK_APP_SECRET || ""
    );
    if (!out) return res.status(500).json({ error: "Refresh failed" });

    await prisma.socialConnection.update({
      where: { id: tt.id },
      data: { accessToken: out.accessToken, refreshToken: out.refreshToken },
    });
    res.json({ ok: true, expiresIn: out.expiresIn });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "tiktok_refresh_failed" });
  }
});

/** Meta: Business Manager – רשימת עסקים */
router.get("/meta/businesses", async (req, res) => {
  const fb = await prisma.socialConnection.findFirst({
    where: { userId: (req as any).userId, orgId: (req as any).orgId, platform: "facebook" },
  });
  if (!fb?.accessToken) return res.status(400).json({ error: "Facebook not connected" });
  const list = await metaListBusinesses(fb.accessToken);
  res.json({ businesses: list });
});

/** Meta: חשבונות מודעות עבור Business */
router.get("/meta/businesses/:id/adaccounts", async (req, res) => {
  const fb = await prisma.socialConnection.findFirst({
    where: { userId: (req as any).userId, orgId: (req as any).orgId, platform: "facebook" },
  });
  if (!fb?.accessToken) return res.status(400).json({ error: "Facebook not connected" });
  const list = await metaBusinessAdAccounts(fb.accessToken, req.params.id);
  res.json({ adAccounts: list });
});

/** Meta: שמירת בחירת Business + Ad Account */
router.post("/meta/selectBusiness", async (req, res) => {
  const { business_id, ad_account_id } = req.body || {};
  const userId = (req as any).userId;
  const orgId = (req as any).orgId;
  const fb = await prisma.socialConnection.findFirst({
    where: { userId, orgId, platform: "facebook" },
  });
  if (!fb) return res.status(400).json({ error: "Facebook not connected" });

  const meta = Object.assign({}, (fb.meta as any) || {}, {
    ...(business_id ? { business_id } : {}),
    ...(ad_account_id ? { ad_account_id } : {}),
  });

  await prisma.socialConnection.update({ where: { id: fb.id }, data: { meta } });
  res.json({ ok: true });
});

export default router;
