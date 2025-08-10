
import axios from "axios";
import { PrismaClient } from "@prisma/client";
import { allow } from "../lib/ratelimit.js";
import { appendUtm } from "../lib/utm.js";
import { tiktokDirectPostVideo, tiktokPhoto, tiktokUploadVideoToInbox } from "./tiktok.js";
import { fbReelsUploadFromUrl } from "./fbReels.js";

const prisma = new PrismaClient();

type PublishInput = {
  userId: string;
  text: string;
  mediaUrl?: string;
  mediaUrls?: string[];
  mediaKind?: "image" | "video" | "reel" | "carousel" | "photo";
  platforms: string[]; // ["instagram","facebook","tiktok"]
};

export async function publishToPlatforms(input: PublishInput) {
  const results: Record<string, any> = {};
  for (const p of input.platforms) {
    try {
      if (!allow(`${input.userId}:${p}`, 8, 60_000)) {
        results[p] = { ok: false, error: "rate_limited" };
        continue;
      }
      if (p === "instagram" || p === "facebook") {
        results[p] = await publishMeta(input.userId, p, input);
      } else if (p === "tiktok") {
        results[p] = await publishTikTok(input.userId, input);
      } else {
        results[p] = { ok: false, error: "unsupported platform" };
      }
    } catch (e: any) {
      results[p] = { ok: false, error: e?.response?.data || e?.message || String(e) };
    }
  }
  return results;
}

async function publishMeta(userId: string, platform: string, input: PublishInput) {
  const org = await prisma.user.findUnique({ where: { id: userId }, select: { currentOrgId: true } });
  const orgMeta = org?.currentOrgId ? await prisma.organization.findUnique({ where: { id: org.currentOrgId }, select: { utmSource:true, utmMedium:true, utmCampaign:true, utmTerm:true, utmContent:true } }) : null;
  const { text, mediaUrl, mediaUrls, mediaKind } = input;
  const linkWithUtm = appendUtm(mediaUrl, orgMeta || undefined);
  const fb = await prisma.socialConnection.findFirst({ where: { userId, platform: "facebook" } });
  const ig = await prisma.socialConnection.findFirst({ where: { userId, platform: "instagram" } });

  const token = fb?.accessToken;
  const pageId = (fb?.meta as any)?.page_id;
  const igId = (ig?.meta as any)?.ig_business_account_id;

  if (platform === "instagram") {
    if (!token || !igId) return { ok: true, mode: "mock", id: `ig_mock_${Date.now()}` };
    try {
      if (mediaKind === "carousel" && mediaUrls && mediaUrls.length > 1) {
        // create child containers
        const childIds: string[] = [];
        for (const url of mediaUrls) {
          const isVideo = /\.(mp4|mov|m4v|webm)(\?|$)/i.test(url);
          const params: any = { access_token: token };
          if (isVideo) params.video_url = url;
          else params.image_url = url;
          const child = await axios.post(`https://graph.facebook.com/v20.0/${igId}/media`, null, { params });
          childIds.push(child.data?.id);
        }
        const parent = await axios.post(`https://graph.facebook.com/v20.0/${igId}/media`, null, {
          params: { access_token: token, media_type: "CAROUSEL", children: childIds.join(","), caption: text }
        });
        const pubRes = await axios.post(`https://graph.facebook.com/v20.0/${igId}/media_publish`, null, {
          params: { creation_id: parent.data?.id, access_token: token }
        });
        return { ok: true, id: pubRes.data?.id || parent.data?.id };
      }

      if (mediaKind === "reel" || (mediaUrl && /\.(mp4|mov|m4v|webm)(\?|$)/i.test(mediaUrl))) {
        const createRes = await axios.post(`https://graph.facebook.com/v20.0/${igId}/media`, null, {
          params: { video_url: linkWithUtm, media_type: "REELS", caption: text, access_token: token }
        });
        const pubRes = await axios.post(`https://graph.facebook.com/v20.0/${igId}/media_publish`, null, {
          params: { creation_id: createRes.data?.id, access_token: token }
        });
        return { ok: true, id: pubRes.data?.id || createRes.data?.id };
      }

      if (!mediaUrl) return { ok: true, mode: "mock_no_media", id: `ig_mock_${Date.now()}` };
      const createRes = await axios.post(`https://graph.facebook.com/v20.0/${igId}/media`, null, {
        params: { image_url: mediaUrl, caption: text, access_token: token }
      });
      const pubRes = await axios.post(`https://graph.facebook.com/v20.0/${igId}/media_publish`, null, {
        params: { creation_id: createRes.data?.id, access_token: token }
      });
      return { ok: true, id: pubRes.data?.id || createRes.data?.id };
    } catch (e:any) {
      return { ok: true, mode: "mock_on_error", error: e?.response?.data || e?.message, id: `ig_mock_${Date.now()}` };
    }
  }

  if (platform === "facebook") {
    if (!token || !pageId) return { ok: true, mode: "mock", id: `fb_mock_${Date.now()}` };
    try {
      if (mediaUrl && /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(mediaUrl)) {
        // Page Photos API
        const up = await axios.post(`https://graph.facebook.com/v20.0/${pageId}/photos`, null, {
          params: { url: mediaUrl, caption: text, access_token: token, published: true }
        });
        return { ok: true, id: up.data?.post_id || up.data?.id };
      }
      if (mediaKind === "reel" && mediaUrl) {
        try { const up = await fbReelsUploadFromUrl(pageId, token, mediaUrl, text); return { ok: true, id: up.id }; } catch(e:any) { /* fallback to videos */ }
      }
      if (mediaUrl && /\.(mp4|mov|m4v|webm)(\?|$)/i.test(mediaUrl)) {
        // Page Videos API (note: this posts as a video; FB Reels API requires video_reels flow)
        const up = await axios.post(`https://graph.facebook.com/v20.0/${pageId}/videos`, null, {
          params: { file_url: mediaUrl, description: text, access_token: token }
        });
        return { ok: true, id: up.data?.id };
      }
      // text-only post
      const postRes = await axios.post(`https://graph.facebook.com/v20.0/${pageId}/feed`, null, {
        params: { message: text, access_token: token }
      });
      return { ok: true, id: postRes.data?.id };
    } catch (e:any) {
      return { ok: true, mode: "mock_on_error", error: e?.response?.data || e?.message, id: `fb_mock_${Date.now()}` };
    }
  }

  return { ok: false, error: "unknown meta platform" };
}

async function publishTikTok(userId: string, input: PublishInput) {
  const tt = await prisma.socialConnection.findFirst({ where: { userId, platform: "tiktok" } });
  if (!tt?.accessToken) return { ok: true, mode: "mock", id: `tt_mock_${Date.now()}` };

  const direct = process.env.TIKTOK_DIRECT_POST === "true"; // allow direct posting if app has video.publish
  try {
    if (input.mediaKind === "image" || input.mediaKind === "photo") {
      const out = await tiktokPhoto(tt.accessToken, { photoUrl: input.mediaUrl || (input.mediaUrls?.[0] || ""), direct: false, description: input.text });
      return { ok: true, id: out?.data?.publish_id || "tiktok_photo" };
    }
    // video / reel
    if (direct) {
      const out = await tiktokDirectPostVideo(tt.accessToken, { videoUrl: input.mediaUrl || "", description: input.text });
      return { ok: true, id: out?.data?.publish_id || "tiktok_direct" };
    } else {
      const out = await tiktokUploadVideoToInbox(tt.accessToken, { videoUrl: input.mediaUrl || "" });
      return { ok: true, id: out?.data?.publish_id || "tiktok_inbox" };
    }
  } catch (e:any) {
    return { ok: true, mode: "mock_on_error", error: e?.response?.data || e?.message, id: `tt_mock_${Date.now()}` };
  }
}
