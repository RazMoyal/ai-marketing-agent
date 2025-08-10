
import { Router } from "express";
import crypto from "crypto";
import { logger } from "../lib/logger.js";

const router = Router();

// Meta webhook (subscription verify + events)
router.get("/meta", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === (process.env.META_WEBHOOK_VERIFY_TOKEN || "verify_token")) {
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

router.post("/meta", (req, res) => {
  // Optionally verify X-Hub-Signature-256
  // const sig = req.headers["x-hub-signature-256"] as string|undefined;
  logger.info({ body: req.body }, "meta webhook event");
  res.sendStatus(200);
});

// TikTok webhook (signature placeholder)
router.post("/tiktok", (req, res) => {
  // verify with app secret if needed (X-Tt-Signature)
  logger.info({ body: req.body }, "tiktok webhook event");
  res.sendStatus(200);
});

export default router;
