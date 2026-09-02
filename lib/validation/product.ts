import { z } from "zod";
import { PRODUCT_STATUSES } from "@/lib/db/schema";

const slug = z
  .string()
  .trim()
  .min(2)
  .max(60)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens only");

const lines = z
  .string()
  .transform((v) =>
    v
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean),
  );

const commaTags = z
  .string()
  .max(500)
  .optional()
  .transform((v) => {
    if (!v) return [] as string[];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of v.split(",")) {
      const tag = raw.trim();
      if (!tag || seen.has(tag.toLowerCase())) continue;
      seen.add(tag.toLowerCase());
      out.push(tag);
    }
    return out.slice(0, 30);
  });

export const variantInputSchema = z.object({
  id: z.string().uuid().optional(),
  sku: z.string().trim().min(2, "SKU is required").max(40),
  label: z.string().trim().min(1, "Size label is required").max(40),
  barcode: z.string().trim().max(40).optional().transform((v) => v ?? ""),
  priceRupees: z.coerce.number().min(1, "Price must be at least Rs 1").max(1_000_000),
  compareAtRupees: z
    .union([z.coerce.number().min(0).max(1_000_000), z.literal(""), z.null(), z.undefined()])
    .transform((v) => (v === "" || v === null || v === undefined || v === 0 ? null : v)),
  stock: z.coerce.number().int().min(0).max(100_000),
  lowStockThreshold: z.coerce.number().int().min(0).max(10_000).default(5),
});

export const metafieldInputSchema = z.object({
  definitionId: z.string().uuid(),
  value: z.string().max(10_000),
});

export const productInputSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(80),
  slug,
  family: z.enum(["oils", "relief", "home"]),
  status: z.enum(PRODUCT_STATUSES).default("active"),
  productType: z.string().trim().max(60).optional().transform((v) => v ?? ""),
  vendor: z.string().trim().max(60).optional().transform((v) => v ?? ""),
  tags: commaTags,
  seoTitle: z.string().trim().max(120).optional().transform((v) => v ?? ""),
  seoDescription: z.string().trim().max(300).optional().transform((v) => v ?? ""),
  shortDescription: z.string().trim().min(5, "Short description is required").max(140),
  longDescription: z.string().trim().min(20, "Long description is required").max(3000),
  howToUse: lines,
  ingredients: z.string().trim().max(1000),
  benefits: lines,
  images: lines,
  isBestseller: z.boolean().default(false),
  /** Legacy checkbox, mirrored onto status. */
  isArchived: z.boolean().default(false),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
  variants: z.array(variantInputSchema).min(1, "Add at least one variant").max(10),
  metafields: z.array(metafieldInputSchema).max(50).default([]),
  collectionIds: z.array(z.string().uuid()).max(50).default([]),
});

export type ProductInput = z.input<typeof productInputSchema>;
export type ProductValues = z.output<typeof productInputSchema>;
export type VariantInput = z.input<typeof variantInputSchema>;
