import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cron from "node-cron";
import { PrismaClient } from "@prisma/client";
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import integrationRoutes from "./routes/integrations.js";
import campaignRoutes from "./routes/campaigns.js";
import contentRoutes from "./routes/content.js";
import leadRoutes from "./routes/leads.js";
import competitorRoutes from "./routes/competitors.js";
import feedRoutes from "./routes/feed.js";
import webhookRoutes from "./routes/webhooks.js";
import healthRoutes from "./routes/health.js";
import dashboardRoutes from "./routes/dashboard.js";
import uploadRoutes from "./routes/upload.js";
import publishRoutes from "./routes/publish.js";
import settingsRoutes from "./routes/settings.js";
import oauthRoutes from "./routes/oauth.js";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import cookieParser from "cookie-parser";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const p = path.join(__dirname, "../.env");
import "dotenv/config";
if (fs.existsSync(p)) {
  dotenv.config({ path: p });
  console.log("Loaded .env from", p);
}else{
  console.log("Error in Loaded .env from", p);
  
}
console.log("META_APP_ID =", process.env.META_APP_ID);
console.log(
  "META_APP_SECRET length =",
  process.env.META_APP_SECRET ? process.env.META_APP_SECRET.length : 0
);

const prisma = new PrismaClient();
const app = express();
import { initSentry } from "./lib/sentry.js";
import { mountBullBoard } from "./lib/bullboard.js";
initSentry(app);
mountBullBoard(app);

const CLIENT_BASE_URL = process.env.CLIENT_BASE_URL || "http://localhost:3000";

app.use(cookieParser());
app.use(helmet());
app.use(cors({ origin: CLIENT_BASE_URL, credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use("/uploads", express.static("uploads"));

app.get("/", (_req, res) => res.json({ ok: true, name: "auto-marketing-agent-server" }));

app.use("/auth", authRoutes);
app.use("/me", userRoutes);
app.use("/integrations", integrationRoutes);
app.use("/campaigns", campaignRoutes);
app.use("/content", contentRoutes);
app.use("/leads", leadRoutes);
app.use("/competitors", competitorRoutes);
app.use("/feed", feedRoutes);
app.use("/webhooks", webhookRoutes);
app.use("/health", healthRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/upload", uploadRoutes);
app.use("/", publishRoutes);
app.use("/settings", settingsRoutes);
app.use("/oauth", oauthRoutes);

// Simple cron: create AI recommendation per user daily 09:00
cron.schedule("0 9 * * *", async () => {
  const users = await prisma.user.findMany({ select: { id: true } });
  for (const u of users) {
    await prisma.notification.create({
      data: {
        userId: u.id,
        type: "suggestion",
        payload: { message: "המלצה יומית: נסה פוסט קצר עם קליפ מהרחבה 🎧" }
      }
    });
  }
  console.log("cron: daily suggestions created");
});

const PORT = Number(process.env.PORT || 4000);
app.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`));


/** Nightly token-refresh at 03:30 */
cron.schedule("30 3 * * *", async () => {
  const appId = process.env.META_APP_ID || "";
  const appSecret = process.env.META_APP_SECRET || "";
  const tiktokKey = process.env.TIKTOK_APP_ID || "";
  const tiktokSecret = process.env.TIKTOK_APP_SECRET || "";

  const users = await prisma.user.findMany({ select: { id: true } });
  for (const u of users) {
    // Meta refresh (best-effort)
    const fb = await prisma.socialConnection.findFirst({ where: { userId: u.id, platform: "facebook" } });
    if (fb?.accessToken && appId && appSecret) {
      try {
        const { metaRefreshLongLived } = await import("./services/meta.js");
        const newToken = await metaRefreshLongLived(fb.accessToken, appId, appSecret);
        if (newToken && newToken !== fb.accessToken) {
          await prisma.socialConnection.update({ where: { id: fb.id }, data: { accessToken: newToken } });
        }
      } catch {}
    }

    // TikTok refresh
    const tt = await prisma.socialConnection.findFirst({ where: { userId: u.id, platform: "tiktok" } });
    if (tt?.refreshToken && tiktokKey && tiktokSecret) {
      try {
        const { tiktokRefreshToken } = await import("./services/tiktok.js");
        const out = await tiktokRefreshToken(tt.refreshToken, tiktokKey, tiktokSecret);
        if (out?.accessToken) {
          await prisma.socialConnection.update({ where: { id: tt.id }, data: { accessToken: out.accessToken, refreshToken: out.refreshToken } });
        }
      } catch {}
    }
  }
  console.log("cron: tokens refresh attempted");
});


/** Retry failed posts with backoff */
cron.schedule("*/5 * * * *", async () => {
  const items = await prisma.post.findMany({
    where: { status: "failed", attemptCount: { lt: 3 }, OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: new Date() } }] },
    take: 10, orderBy: { updatedAt: "asc" }
  });
  for (const p of items) {
    try {
      const { publishToPlatforms } = await import("./services/publishers.js");
      const res = await publishToPlatforms({
        userId: p.userId, text: p.text, mediaUrl: p.mediaUrl ?? undefined, mediaUrls: (p as any).mediaUrls ?? undefined,
        mediaKind: (p as any).mediaKind ?? undefined, platforms: (p.platforms as any)
      });
      // if all ok
      const allOk = Object.values(res).every((r: any)=> r && r.ok);
      if (allOk) {
        await prisma.post.update({ where: { id: p.id }, data: { status: "published", result: res, lastError: null } });
      } else {
        const attempt = (p as any).attemptCount + 1;
        const delayMin = Math.min(30, attempt * 5);
        const next = new Date(Date.now() + delayMin * 60_000);
        await prisma.post.update({ where: { id: p.id }, data: { attemptCount: attempt, nextAttemptAt: next, lastError: JSON.stringify(res) } });
      }
    } catch (e:any) {
      const attempt = (p as any).attemptCount + 1;
      const delayMin = Math.min(30, attempt * 5);
      const next = new Date(Date.now() + delayMin * 60_000);
      await prisma.post.update({ where: { id: p.id }, data: { attemptCount: attempt, nextAttemptAt: next, lastError: e?.message || String(e) } });
    }
  }
  console.log("cron: retry backoff tick");
});
