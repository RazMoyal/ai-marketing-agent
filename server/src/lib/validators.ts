import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().optional(),
  tz: z.string().optional(),
  locale: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const campaignSchema = z.object({
  name: z.string().min(2),
  platform: z.enum(["instagram", "tiktok", "facebook"]),
  objective: z.string().optional(),
  budget: z.number().min(0),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const leadSchema = z.object({
  name: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  source: z.string().optional(),
  campaignId: z.string().optional(),
});

export const competitorSchema = z.object({
  platform: z.enum(["instagram", "tiktok", "facebook"]),
  handle: z.string().min(1),
  notes: z.string().optional(),
});

export const contentGenSchema = z.object({
  prompt: z.string().min(3),
  style: z.enum(["professional","funny","romantic","dramatic"]).default("professional"),
  audience: z.object({
    age: z.string().optional(),
    location: z.string().optional(),
    interests: z.array(z.string()).optional()
  }).optional(),
  languages: z.array(z.string()).optional(),
  hashtags: z.boolean().default(true)
});
