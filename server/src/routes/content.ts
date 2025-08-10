import { Router } from "express";
import { verifyJwt } from "../lib/jwt.js";
import { contentGenSchema } from "../lib/validators.js";
import { generateContent } from "../services/openai.js";

const router = Router();

router.use((req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: "Missing token" });
  const token = auth.replace("Bearer ", "");
  const payload = verifyJwt<{ sub: string }>(token);
  if (!payload) return res.status(401).json({ error: "Invalid token" });
  (req as any).userId = payload.sub;
  next();
});

router.post("/generate", async (req, res) => {
  const parsed = contentGenSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error);
  const { prompt, style, audience, languages, hashtags } = parsed.data;
  const out = await generateContent(prompt, style);
  res.json({ ...out, audience, languages, hashtags });
});

export default router;
