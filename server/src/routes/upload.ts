
import { Router } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { verifyJwt } from "../lib/jwt.js";
import { v2 as cloudinary } from "cloudinary";

const router = Router();

// auth
router.use((req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: "Missing token" });
  const token = auth.replace("Bearer ", "");
  const payload = verifyJwt<{ sub: string }>(token);
  if (!payload) return res.status(401).json({ error: "Invalid token" });
  (req as any).userId = payload.sub;
  next();
});

// configure cloudinary if ENV provided
const useCloudinary = !!(process.env.CLOUDINARY_URL || (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET));
if (!process.env.CLOUDINARY_URL && process.env.CLOUDINARY_CLOUD_NAME) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "uploads";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/\s+/g, "_");
    cb(null, `${Date.now()}_${base}${ext}`);
  }
});
const upload = multer({ storage });

router.post("/", upload.array("files", 10), async (req, res) => {
  const files = (req as any).files as Express.Multer.File[];
  if (!files || files.length === 0) return res.status(400).json({ error: "no files" });
  const serverBase = process.env.SERVER_BASE_URL || "http://localhost:4000";
  const urls: string[] = [];
  for (const f of files) {
    if (useCloudinary) {
      try {
        const up = await cloudinary.uploader.upload(f.path, { resource_type: "auto" });
        urls.push(up.secure_url || up.url);
        fs.unlinkSync(f.path);
      } catch (e) {
        // fallback to local
        urls.push(`${serverBase}/uploads/${f.filename}`);
      }
    } else {
      urls.push(`${serverBase}/uploads/${f.filename}`);
    }
  }
  res.json({ urls });
});

export default router;
