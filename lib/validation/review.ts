import { z } from "zod";
import { normalizePkPhone } from "@/lib/phone";

export const reviewInputSchema = z.object({
  productSlug: z.string().trim().min(2).max(60),
  name: z.string().trim().min(2, "Tell us your name").max(60),
  phone: z
    .string()
    .trim()
    .max(20)
    .optional()
    .transform((v, ctx) => {
      if (!v) return null;
      const n = normalizePkPhone(v);
      if (!n) {
        ctx.addIssue({ code: "custom", message: "Enter a Pakistani mobile number, like 0300 1234567" });
        return z.NEVER;
      }
      return n;
    }),
  city: z.string().trim().max(60).optional().transform((v) => v ?? ""),
  rating: z.coerce.number().int().min(1, "Pick a star rating").max(5),
  title: z.string().trim().max(80).optional().transform((v) => v ?? ""),
  body: z.string().trim().min(10, "Write at least a sentence").max(1500),
  lang: z.enum(["en", "ur"]).default("en"),
  /** Honeypot. */
  website: z.string().max(0, "Spam check failed").optional(),
});

export type ReviewInput = z.input<typeof reviewInputSchema>;
export type ReviewValues = z.output<typeof reviewInputSchema>;

/** Admin: add a review collected on WhatsApp or by phone, plus moderation. */
export const adminReviewSchema = z.object({
  productId: z.string().uuid(),
  name: z.string().trim().min(2).max(60),
  phone: z
    .string()
    .trim()
    .max(20)
    .optional()
    .transform((v) => (v ? normalizePkPhone(v) : null)),
  city: z.string().trim().max(60).optional().transform((v) => v ?? ""),
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().trim().max(80).optional().transform((v) => v ?? ""),
  body: z.string().trim().min(5).max(1500),
  lang: z.enum(["en", "ur"]).default("en"),
  status: z.enum(["pending", "approved", "rejected"]).default("approved"),
});

export const reviewReplySchema = z.object({
  id: z.string().uuid(),
  reply: z.string().trim().max(1000),
});
