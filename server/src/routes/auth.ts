
import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import axios from "axios";
import { signJwt, verifyJwt } from "../lib/jwt.js";
import { loginSchema, registerSchema } from "../lib/validators.js";

const prisma = new PrismaClient();
const router = Router();

// ---------- Email/Password ----------
router.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error);
  const { email, password, name, tz, locale } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: "Email already exists" });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({ data: { email, passwordHash, name, tz: tz || "Asia/Jerusalem", locale: locale || "he" } });
  // create default organization
  const org = await prisma.organization.create({ data: { name: name || email.split('@')[0] + " Org" } });
  await prisma.membership.create({ data: { userId: user.id, orgId: org.id, role: "owner" } });
  await prisma.user.update({ where: { id: user.id }, data: { currentOrgId: org.id } });
  const token = signJwt({ sub: user.id, email: user.email, orgId: user.currentOrgId });
  res.json({ token, user: { id: user.id, email: user.email, name: user.name, tz: user.tz, locale: user.locale } });
});

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error);
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ error: "Invalid credentials" });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });
  const token = signJwt({ sub: user.id, email: user.email, orgId: user.currentOrgId });
  res.json({ token, user: { id: user.id, email: user.email, name: user.name, tz: user.tz, locale: user.locale } });
});

router.post("/forgot-password", async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: "email required" });
  // send email link (mock)
  res.json({ ok: true, detail: "Reset link simulated" });
});

// ---------- OAuth start (Meta/TikTok) ----------
function requireAuth(req: any, res: any, next: any) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: "Missing token" });
  const token = auth.replace("Bearer ", "");
  const payload = verifyJwt<{ sub: string }>(token);
  if (!payload) return res.status(401).json({ error: "Invalid token" });
  req.userId = payload.sub;
  next();
}

router.get("/oauth/:provider/start", requireAuth, async (req, res) => {
  const provider = req.params.provider;
  const state = signJwt({ sub: req.userId, provider }, "15m");

  const SERVER_BASE_URL = process.env.SERVER_BASE_URL || "http://localhost:4000";
  const CLIENT_BASE_URL = process.env.CLIENT_BASE_URL || "http://localhost:3000";

  if (provider === "meta" || provider === "facebook" || provider === "instagram") {
    const clientId = process.env.META_APP_ID;
    const redirectUri = `${SERVER_BASE_URL}/auth/oauth/meta/callback`;
    const scope = [
      "public_profile",
      "email",
      "pages_read_engagement",
      "pages_manage_metadata",
      "instagram_basic",
      "instagram_manage_insights",
      "ads_management",
      "business_management"
    ].join(",");
    const url = `https://www.facebook.com/v20.0/dialog/oauth?client_id=${encodeURIComponent(clientId || "")}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&state=${encodeURIComponent(state)}`;
    return res.json({ url });
  }

  if (provider === "tiktok") {
    const clientKey = process.env.TIKTOK_APP_ID;
    const redirectUri = `${SERVER_BASE_URL}/auth/oauth/tiktok/callback`;
    const scope = [
      "user.info.basic",
      "video.list",
      "video.upload",
      "share.video",
    ].join(",");
    const url = `https://www.tiktok.com/v2/auth/authorize/?client_key=${encodeURIComponent(clientKey || "")}&response_type=code&scope=${encodeURIComponent(scope)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`;
    return res.json({ url });
  }

  return res.status(400).json({ error: "Unsupported provider" });
});

// ---------- OAuth callbacks ----------

// Meta (Facebook/Instagram Graph)
router.get("/oauth/meta/callback", async (req, res) => {
  const { code, state } = req.query as any;
  try {
    const decoded = verifyJwt<{ sub: string }>(String(state));
    if (!decoded) throw new Error("bad state");
    const userId = decoded.sub;

    const clientId = process.env.META_APP_ID!;
    const clientSecret = process.env.META_APP_SECRET!;
    const SERVER_BASE_URL = process.env.SERVER_BASE_URL || "http://localhost:4000";
    const CLIENT_BASE_URL = process.env.CLIENT_BASE_URL || "http://localhost:3000";
    const redirectUri = `${SERVER_BASE_URL}/auth/oauth/meta/callback`;

    // exchange code
    const tokenRes = await axios.get("https://graph.facebook.com/v20.0/oauth/access_token", {
      params: { client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, code }
    });
    let accessToken = tokenRes.data.access_token as string;

    // exchange to long-lived
    try {
      const longRes = await axios.get("https://graph.facebook.com/v20.0/oauth/access_token", {
        params: {
          grant_type: "fb_exchange_token",
          client_id: clientId, client_secret: clientSecret,
          fb_exchange_token: accessToken
        }
      });
      accessToken = longRes.data.access_token || accessToken;
    } catch {}

    // get pages
    const pages = await axios.get("https://graph.facebook.com/v20.0/me/accounts", { params: { access_token: accessToken } });
    const firstPage = pages.data.data?.[0];
    let igAccountId: string | undefined;
    if (firstPage?.id) {
      const ig = await axios.get(`https://graph.facebook.com/v20.0/${firstPage.id}`, {
        params: { access_token: accessToken, fields: "instagram_business_account" }
      });
      igAccountId = ig.data?.instagram_business_account?.id;
    }

    // ad accounts
    const adAccounts = await axios.get("https://graph.facebook.com/v20.0/me/adaccounts", { params: { access_token: accessToken } });
    const adAccountId = adAccounts.data.data?.[0]?.id;

    // upsert connections
    await prisma.socialConnection.upsert({
      where: { userId_platform: { userId, platform: "facebook" } } as any,
      create: { userId, platform: "facebook", accessToken, meta: { page_id: firstPage?.id, ad_account_id: adAccountId } },
      update: { accessToken, meta: { page_id: firstPage?.id, ad_account_id: adAccountId } }
    });
    if (igAccountId) {
      await prisma.socialConnection.upsert({
        where: { userId_platform: { userId, platform: "instagram" } } as any,
        create: { userId, platform: "instagram", accessToken, meta: { ig_business_account_id: igAccountId, page_id: firstPage?.id } },
        update: { accessToken, meta: { ig_business_account_id: igAccountId, page_id: firstPage?.id } }
      });
    }

    return res.redirect(`${CLIENT_BASE_URL}/settings?connected=meta`);
  } catch (e:any) {
    console.error("meta oauth error", e?.response?.data || e);
    return res.status(500).send("Meta OAuth failed. Check server logs and app credentials.");
  }
});

// TikTok
router.get("/oauth/tiktok/callback", async (req, res) => {
  const { code, state } = req.query as any;
  try {
    const decoded = verifyJwt<{ sub: string }>(String(state));
    if (!decoded) throw new Error("bad state");
    const userId = decoded.sub;

    const clientKey = process.env.TIKTOK_APP_ID!;
    const clientSecret = process.env.TIKTOK_APP_SECRET!;
    const SERVER_BASE_URL = process.env.SERVER_BASE_URL || "http://localhost:4000";
    const CLIENT_BASE_URL = process.env.CLIENT_BASE_URL || "http://localhost:3000";
    const redirectUri = `${SERVER_BASE_URL}/auth/oauth/tiktok/callback`;

    const tokenRes = await axios.post("https://open.tiktokapis.com/v2/oauth/token/", {
      client_key: clientKey,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri
    }, { headers: { "Content-Type": "application/json" } });
    const accessToken = tokenRes.data.access_token as string;
    const refreshToken = tokenRes.data.refresh_token as string;

    await prisma.socialConnection.upsert({
      where: { userId_platform: { userId, platform: "tiktok" } } as any,
      create: { userId, platform: "tiktok", accessToken, refreshToken, meta: {} },
      update: { accessToken, refreshToken }
    });

    return res.redirect(`${CLIENT_BASE_URL}/settings?connected=tiktok`);
  } catch (e:any) {
    console.error("tiktok oauth error", e?.response?.data || e);
    return res.status(500).send("TikTok OAuth failed. Check server logs and app credentials.");
  }
});

export default router;
