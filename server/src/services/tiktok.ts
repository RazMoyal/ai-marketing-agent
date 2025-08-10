
import axios from "axios";

export async function analyzeTikTokCompetitor(handle: string) {
  return {
    handle,
    postsPerWeek: Math.round(Math.random()*5)+1,
    avgViews: Math.round(Math.random()*5000)+1000,
    topFormats: ["dance","before/after","tips"].sort(()=>0.5-Math.random()).slice(0,2),
  };
}

/**
 * Upload video to TikTok inbox (draft) using PULL_FROM_URL or FILE_UPLOAD initialize.
 * scope: video.upload
 */
export async function tiktokUploadVideoToInbox(userAccessToken: string, opts: { videoUrl?: string, sizeBytes?: number }) {
  const url = "https://open.tiktokapis.com/v2/post/publish/inbox/video/init/";
  const headers = { Authorization: `Bearer ${userAccessToken}`, "Content-Type": "application/json; charset=UTF-8" };
  if (opts.videoUrl) {
    const res = await axios.post(url, { source_info: { source: "PULL_FROM_URL", video_url: opts.videoUrl } }, { headers });
    return res.data;
  }
  // FILE_UPLOAD path (chunked PUT to returned upload_url) not implemented here
  const res = await axios.post(url, {
    source_info: { source: "FILE_UPLOAD", video_size: opts.sizeBytes || 0, chunk_size: opts.sizeBytes || 0, total_chunk_count: 1 }
  }, { headers });
  return res.data;
}

/**
 * Direct post video (if app has video.publish scope)
 */
export async function tiktokDirectPostVideo(userAccessToken: string, opts: { videoUrl: string, title?: string, description?: string }) {
  const url = "https://open.tiktokapis.com/v2/post/publish/video/init/";
  const headers = { Authorization: `Bearer ${userAccessToken}`, "Content-Type": "application/json; charset=UTF-8" };
  const body: any = {
    source_info: { source: "PULL_FROM_URL", video_url: opts.videoUrl },
    post_info: { title: opts.title || "", description: opts.description || "" }
  };
  const res = await axios.post(url, body, { headers });
  return res.data;
}

/**
 * Photo post or upload (PHOTO only) via /v2/post/publish/content/init/
 * media_type: PHOTO, post_mode: DIRECT POST | MEDIA_UPLOAD
 */
export async function tiktokPhoto(userAccessToken: string, opts: { photoUrl: string, direct?: boolean, title?: string, description?: string }) {
  const url = "https://open.tiktokapis.com/v2/post/publish/content/init/";
  const headers = { Authorization: `Bearer ${userAccessToken}`, "Content-Type": "application/json; charset=UTF-8" };
  const body: any = {
    media_type: "PHOTO",
    post_mode: opts.direct ? "DIRECT POST" : "MEDIA_UPLOAD",
    post_info: { title: opts.title || "", description: opts.description || "" },
    source_info: { source: "PULL_FROM_URL", photo_urls: [opts.photoUrl] }
  };
  const res = await axios.post(url, body, { headers });
  return res.data;
}

export async function tiktokRefreshToken(refreshToken: string, clientKey: string, clientSecret: string) {
  try {
    const res = await axios.post("https://open.tiktokapis.com/v2/oauth/token/", {
      client_key: clientKey,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken
    }, { headers: { "Content-Type": "application/json" } });
    return {
      accessToken: res.data?.access_token,
      refreshToken: res.data?.refresh_token,
      expiresIn: res.data?.expires_in
    };
  } catch (e) {
    return null;
  }
}


/** Upload raw bytes (single chunk) to TikTok upload_url. Extend to multi-chunk as needed. */
export async function tiktokUploadChunks(uploadUrl: string, data: Buffer) {
  const res = await axios.put(uploadUrl, data, { headers: { "Content-Type": "application/octet-stream" }, maxBodyLength: Infinity });
  return res.data || { ok: true };
}
