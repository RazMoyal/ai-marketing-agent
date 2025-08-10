import { Router } from "express";
import axios from "axios";
import { PrismaClient } from "@prisma/client";
import { verifyJwt } from "../lib/jwt.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";

const router = Router();
const prisma = new PrismaClient();

const SECURE_COOKIE = process.env.NODE_ENV === "production";
const SERVER_BASE = process.env.SERVER_BASE_URL || "http://localhost:4000";
const CLIENT_BASE = process.env.CLIENT_BASE_URL || "http://localhost:3000";

function makeSignedState(provider: "meta" | "tiktok", userId: string, orgId?: string | null) {
  const nonce = crypto.randomBytes(16).toString("hex");
  return jwt.sign(
    { p: provider, uid: userId, orgId: orgId || null, n: nonce },
    process.env.JWT_SECRET as string,
    { expiresIn: "5m" }
  );
}

function verifySignedState(expectedProvider: "meta" | "tiktok", state: string, cookieState?: string) {
  if (!state) throw new Error("missing_state");
  const payload = jwt.verify(state, process.env.JWT_SECRET as string) as any;
  if (payload.p !== expectedProvider) throw new Error("bad_state_provider");
  if (!cookieState || cookieState !== state) throw new Error("bad_state");
  return payload as { p: string; uid: string; orgId?: string | null; n: string; iat: number; exp: number };
}

// ---------- helper: require auth for /start endpoints ----------
function requireAuth(req: any, res: any, next: any) {
  const auth = req.headers.authorization || req.query.token;
  if (!auth) return res.status(401).send("Missing token");
  const token = String(auth).replace("Bearer ", "");
  const payload = verifyJwt<{ sub: string; orgId?: string }>(token);
  if (!payload) return res.status(401).send("Invalid token");
  (req as any).userId = payload.sub;
  (req as any).orgId = payload.orgId || null;
  next();
}

// ======================= META (Facebook/Instagram/WhatsApp) =======================

router.get("/meta/start", requireAuth, async (req, res) => {
  const appId = (process.env.META_APP_ID || "").trim();
  if (!/^\d{5,20}$/.test(appId)) return res.status(500).send("META_APP_ID missing/invalid");

  const redirect = `${SERVER_BASE}/oauth/meta/callback`;
  const scope = (process.env.META_SCOPES || "public_profile,email").trim();

  const state = makeSignedState("meta", (req as any).userId, (req as any).orgId);

  // שומר גם בעוגיה להגנת CSRF כפולה
  res.cookie("oauth_state_meta", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: SECURE_COOKIE,
    maxAge: 5 * 60 * 1000,
  });

  const url = new URL("https://www.facebook.com/v20.0/dialog/oauth");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", redirect);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", scope);
  url.searchParams.set("state", state);

  return res.redirect(url.toString());
});

router.get("/meta/callback", async (req, res) => {
  try {
    const code = req.query.code as string | undefined;
    const state = req.query.state as string | undefined;
    const cookieState = (req as any).cookies?.oauth_state_meta as string | undefined;
    if (!code) throw new Error("missing_code");

    const st = verifySignedState("meta", state!, cookieState);

    const appId = process.env.META_APP_ID!;
    const appSecret = process.env.META_APP_SECRET!;
    const redirect = `${SERVER_BASE}/oauth/meta/callback`;

    // 1) short-lived
    const tokenRes = await axios.get("https://graph.facebook.com/v20.0/oauth/access_token", {
      params: { client_id: appId, client_secret: appSecret, redirect_uri: redirect, code },
    });
    const shortToken = tokenRes.data.access_token as string;

    // 2) long-lived
    const longRes = await axios.get("https://graph.facebook.com/v20.0/oauth/access_token", {
      params: {
        grant_type: "fb_exchange_token",
        client_id: appId,
        client_secret: appSecret,
        fb_exchange_token: shortToken,
      },
    });
    const accessToken = longRes.data.access_token as string;

    // שמירת Facebook connection
    await prisma.socialConnection.upsert({
      where: { userId_platform: { userId: st.uid, platform: "facebook" } } as any,
      create: { userId: st.uid, orgId: st.orgId || undefined, platform: "facebook", accessToken },
      update: { accessToken, orgId: st.orgId || undefined },
    });

    // דפים + איתור חשבון IG
    const pagesRes = await axios.get("https://graph.facebook.com/v20.0/me/accounts", {
      params: {
        access_token: accessToken,
        fields: "id,name,instagram_business_account,connected_instagram_account",
      },
    });
    const pages = Array.isArray(pagesRes.data?.data) ? pagesRes.data.data : [];

    for (const p of pages) {
      const igUserId = p?.instagram_business_account?.id || p?.connected_instagram_account?.id;
      if (igUserId) {
        await prisma.socialConnection.upsert({
          where: { userId_platform: { userId: st.uid, platform: "instagram" } } as any,
          create: {
            userId: st.uid,
            orgId: st.orgId || undefined,
            platform: "instagram",
            accessToken, // לפרסום IG משתמשים ב-Page Token
            meta: { pageId: p.id, igUserId } as any,
          },
          update: { accessToken, orgId: st.orgId || undefined, meta: { pageId: p.id, igUserId } as any },
        });
        break; // לוקחים ראשון לדמו; אפשר להציג לבחור UI
      }
    }

    // ניסוי: WhatsApp Business (best effort)
    try {
      const biz = await axios.get("https://graph.facebook.com/v20.0/me/businesses", {
        params: { access_token: accessToken, fields: "id,name,owned_whatsapp_business_accounts" },
      });
      const firstWaba = biz.data?.data?.[0]?.owned_whatsapp_business_accounts?.data?.[0]?.id;
      if (firstWaba) {
        const phones = await axios.get(`https://graph.facebook.com/v20.0/${firstWaba}/phone_numbers`, {
          params: { access_token: accessToken, fields: "id,display_phone_number,verified_name" },
        });
        await prisma.socialConnection.upsert({
          where: { userId_platform: { userId: st.uid, platform: "whatsapp" } } as any,
          create: {
            userId: st.uid,
            orgId: st.orgId || undefined,
            platform: "whatsapp",
            accessToken,
            meta: { wabaId: firstWaba, phones: phones.data?.data } as any,
          },
          update: { accessToken, orgId: st.orgId || undefined, meta: { wabaId: firstWaba, phones: phones.data?.data } as any },
        });
      }
    } catch { /* ignore */ }

    res.clearCookie("oauth_state_meta");
    return res.redirect(`${CLIENT_BASE}/settings?connected=meta`);
  } catch (e: any) {
    console.error("meta oauth error", e?.response?.data || e?.message || e);
    return res.redirect(`${CLIENT_BASE}/integrations/error?m=${encodeURIComponent(e?.message || "meta_oauth_failed")}`);
  }
});

// ======================= TikTok =======================

router.get("/tiktok/start", requireAuth, (req, res) => {
  const clientKey = (process.env.TIKTOK_APP_ID || "").trim();
  if (!clientKey) return res.status(500).send("TIKTOK_APP_ID missing");

  const redirect = `${SERVER_BASE}/oauth/tiktok/callback`;
  const scope = ["user.info.basic", "video.list", "video.upload", "business.basic"].join(",");

  const state = makeSignedState("tiktok", (req as any).userId, (req as any).orgId);
  res.cookie("oauth_state_tiktok", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: SECURE_COOKIE,
    maxAge: 5 * 60 * 1000,
  });

  const url = new URL("https://www.tiktok.com/v2/auth/authorize/");
  url.searchParams.set("client_key", clientKey);
  url.searchParams.set("scope", scope);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirect);
  url.searchParams.set("state", state);

  return res.redirect(url.toString());
});

router.get("/tiktok/callback", async (req, res) => {
  try {
    const code = req.query.code as string | undefined;
    const state = req.query.state as string | undefined;
    const cookieState = (req as any).cookies?.oauth_state_tiktok as string | undefined;
    if (!code) throw new Error("missing_code");

    const st = verifySignedState("tiktok", state!, cookieState);

    const redirect = `${SERVER_BASE}/oauth/tiktok/callback`;
    const tokenRes = await axios.post(
      "https://open.tiktokapis.com/v2/oauth/token/",
      {
        client_key: process.env.TIKTOK_APP_ID,
        client_secret: process.env.TIKTOK_APP_SECRET,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirect,
      },
      { headers: { "Content-Type": "application/json" } }
    );

    const accessToken = tokenRes.data.access_token as string;
    const refreshToken = tokenRes.data.refresh_token as string;

    await prisma.socialConnection.upsert({
      where: { userId_platform: { userId: st.uid, platform: "tiktok" } } as any,
      create: {
        userId: st.uid,
        orgId: st.orgId || undefined,
        platform: "tiktok",
        accessToken,
        refreshToken,
        meta: tokenRes.data as any,
      },
      update: {
        orgId: st.orgId || undefined,
        accessToken,
        refreshToken,
        meta: tokenRes.data as any,
      },
    });

    res.clearCookie("oauth_state_tiktok");
    return res.redirect(`${CLIENT_BASE}/settings?connected=tiktok`);
  } catch (e: any) {
    console.error("tiktok oauth error", e?.response?.data || e?.message || e);
    return res.redirect(`${CLIENT_BASE}/integrations/error?m=${encodeURIComponent(e?.message || "tiktok_oauth_failed")}`);
  }
});

export default router;
