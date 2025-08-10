
import axios from "axios";
import fs from "fs";
import path from "path";
import crypto from "crypto";

export async function fbReelsUploadFromUrl(pageId: string, accessToken: string, videoUrl: string, description?: string) {
  // Simplified resumable upload for Reels via /{page-id}/video_reels
  // 1) Start
  const start = await axios.post(`https://graph.facebook.com/v20.0/${pageId}/video_reels`, null, {
    params: { access_token: accessToken, upload_phase: "start" }
  });
  const sessionId = start.data?.upload_session_id;
  const uploadUrl = start.data?.upload_url;
  if (!sessionId || !uploadUrl) throw new Error("Failed to init reels upload");

  // 2) Transfer (single-chunk pull)
  // NOTE: for large files implement proper chunking. Here we pass through source URL (requires proxy/streaming)
  const resp = await axios.get(videoUrl, { responseType: "arraybuffer" });
  const buffer = Buffer.from(resp.data);
  await axios.post(uploadUrl, buffer, {
    headers: { "Content-Type": "application/octet-stream" },
    maxBodyLength: Infinity
  });

  // 3) Finish
  const finish = await axios.post(`https://graph.facebook.com/v20.0/${pageId}/video_reels`, null, {
    params: { access_token: accessToken, upload_phase: "finish", upload_session_id: sessionId, description }
  });
  return { ok: true, id: finish.data?.id || sessionId };
}
