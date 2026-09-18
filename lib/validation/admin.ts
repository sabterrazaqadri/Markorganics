import { z } from "zod";
import {
  EXPENSE_CATEGORIES,
  INVENTORY_REASONS,
  METAFIELD_TYPES,
  ORDER_STATUSES,
  PRODUCT_STATUSES,
  USER_ROLES,
} from "@/lib/db/schema";
import { rulesSchema } from "@/lib/admin/rules";
import { normalizePkPhone } from "@/lib/phone";

/* ------------------------------------------------------------ primitives */

const trimmed = (max: number) => z.string().trim().max(max);
const uuid = z.string().uuid();
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const optionalDate = z.union([dateString, z.literal("")]).optional().transform((v) => (v ? v : undefined));

export const slugField = z
  .string()
  .trim()
  .min(2, "Slug is required")
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens only");

/** Comma-separated tag input -> unique, trimmed, lowercase-compared list. */
export const tagsField = z
  .string()
  .max(500)
  .optional()
  .transform((v) => {
    if (!v) return [] as string[];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of v.split(",")) {
      const tag = raw.trim();
      if (!tag) continue;
      const key = tag.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(tag);
    }
    return out.slice(0, 30);
  });

export const pkPhoneField = z
  .string()
  .trim()
  .min(1, "Enter a mobile number")
  .refine((v) => normalizePkPhone(v) !== null, "Enter a Pakistani mobile number like 0300 1234567")
  .transform((v) => normalizePkPhone(v) as string);

const rupeesToPaisaField = (max = 10_000_000) =>
  z.coerce.number().min(0).max(max).transform((v) => Math.round(v * 100));

/* ------------------------------------------------------------------ auth */

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter your email address").max(200),
  password: z.string().min(1, "Enter your password").max(200),
});

export const passwordField = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(200, "Use 200 characters or fewer");

export const createUserSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(200),
  name: trimmed(80).min(2, "Enter a name"),
  role: z.enum(USER_ROLES),
  password: passwordField,
});

export const updateUserSchema = z.object({
  id: uuid,
  name: trimmed(80).min(2, "Enter a name"),
  role: z.enum(USER_ROLES),
  status: z.enum(["active", "suspended"]),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password"),
  newPassword: passwordField,
});

export const resetPasswordSchema = z.object({ id: uuid, password: passwordField });

/* ---------------------------------------------------------------- orders */

export const ORDER_VIEWS = [
  "all",
  "unfulfilled",
  "pending",
  "confirmed",
  "shipped",
  "delivered",
  "cancelled",
  "returned",
] as const;
export type OrderView = (typeof ORDER_VIEWS)[number];

export const ORDER_VIEW_LABEL: Record<OrderView, string> = {
  all: "All",
  unfulfilled: "Unfulfilled",
  pending: "Pending",
  confirmed: "Confirmed",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  returned: "Returned",
};

export const ordersFilterSchema = z.object({
  view: z.enum(ORDER_VIEWS).optional(),
  q: trimmed(80).optional(),
  status: z.enum(ORDER_STATUSES).optional(),
  from: optionalDate,
  to: optionalDate,
  city: trimmed(60).optional(),
  tag: trimmed(40).optional(),
  actor: z.union([uuid, z.literal("")]).optional().transform((v) => (v ? v : undefined)),
  minTotal: z.coerce.number().min(0).max(10_000_000).optional(),
  maxTotal: z.coerce.number().min(0).max(10_000_000).optional(),
  minItems: z.coerce.number().int().min(0).max(1000).optional(),
  maxItems: z.coerce.number().int().min(0).max(1000).optional(),
  cursor: trimmed(120).optional(),
  /** Offset pagination is kept for the CSV export route only. */
  page: z.coerce.number().int().min(1).default(1),
});
export type OrdersFilter = z.output<typeof ordersFilterSchema>;

export const statusChangeSchema = z.object({
  status: z.enum(ORDER_STATUSES),
  note: trimmed(300).optional(),
});

export const internalNoteSchema = z.object({ internalNote: trimmed(2000) });

export const orderTagsSchema = z.object({ orderId: uuid, tags: tagsField });

export const bulkOrderSchema = z.object({
  ids: z.array(uuid).min(1, "Select at least one order").max(200),
  action: z.enum(["status", "tag", "untag"]),
  status: z.enum(ORDER_STATUSES).optional(),
  tag: trimmed(40).optional(),
  note: trimmed(300).optional(),
});

export const orderLineSchema = z.object({
  /** Present for lines that already exist. */
  id: uuid.optional(),
  variantId: uuid.nullable().optional(),
  productName: trimmed(120).min(1, "Name is required"),
  variantLabel: trimmed(60).default(""),
  sku: trimmed(60).default(""),
  productSlug: trimmed(80).default(""),
  unitPriceRupees: z.coerce.number().min(0).max(1_000_000),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1").max(500),
});

export const editOrderSchema = z.object({
  orderId: uuid,
  lines: z.array(orderLineSchema).min(1, "An order needs at least one line").max(60),
  deliveryRupees: z.coerce.number().min(0).max(100_000),
  discountRupees: z.coerce.number().min(0).max(1_000_000).default(0),
  discountReason: trimmed(120).optional(),
  reason: trimmed(200).optional(),
});

/* ----------------------------------------------------------- draft orders */

export const draftOrderSchema = z.object({
  id: uuid.optional(),
  customerId: z.union([uuid, z.literal("")]).optional().transform((v) => (v ? v : null)),
  customerName: trimmed(80).min(2, "Enter a name"),
  phone: pkPhoneField,
  altPhone: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : ""))
    .refine((v) => v === "" || normalizePkPhone(v) !== null, "Enter a Pakistani mobile number")
    .transform((v) => (v ? normalizePkPhone(v) : null)),
  city: trimmed(60).min(2, "Enter a city"),
  address: trimmed(200).min(10, "Enter the full address"),
  notes: trimmed(300).optional(),
  internalNote: trimmed(2000).optional(),
  lines: z.array(orderLineSchema).min(1, "Add at least one item").max(60),
  deliveryRupees: z.coerce.number().min(0).max(100_000),
  discountRupees: z.coerce.number().min(0).max(1_000_000).default(0),
  discountReason: trimmed(120).optional(),
});

/* -------------------------------------------------------------- products */

export const productsFilterSchema = z.object({
  q: trimmed(80).optional(),
  status: z.enum(PRODUCT_STATUSES).optional(),
  family: z.enum(["oils", "relief", "home"]).optional(),
  productType: trimmed(60).optional(),
  vendor: trimmed(60).optional(),
  tag: trimmed(40).optional(),
  collectionId: z.union([uuid, z.literal("")]).optional().transform((v) => (v ? v : undefined)),
  stock: z.enum(["low", "out"]).optional(),
  sort: z.enum(["name", "created", "price", "stock"]).default("name"),
  cursor: trimmed(120).optional(),
});
export type ProductsFilter = z.output<typeof productsFilterSchema>;

export const bulkProductEditSchema = z.object({
  rows: z
    .array(
      z.object({
        variantId: uuid,
        priceRupees: z.coerce.number().min(0).max(1_000_000).optional(),
        compareAtRupees: z.union([z.coerce.number().min(0).max(1_000_000), z.literal("")]).optional(),
        stock: z.coerce.number().int().min(0).max(100_000).optional(),
        lowStockThreshold: z.coerce.number().int().min(0).max(10_000).optional(),
      }),
    )
    .max(500),
  productRows: z
    .array(
      z.object({
        productId: uuid,
        status: z.enum(PRODUCT_STATUSES).optional(),
        tags: tagsField,
      }),
    )
    .max(500),
});

/* ----------------------------------------------------------- collections */

export const collectionSchema = z.object({
  id: uuid.optional(),
  title: trimmed(80).min(2, "Title is required"),
  slug: slugField,
  description: trimmed(2000).default(""),
  type: z.enum(["manual", "automatic"]),
  rulesMatch: z.enum(["all", "any"]).default("all"),
  rules: rulesSchema.default([]),
  image: trimmed(300).default(""),
  isPublished: z.coerce.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
  seoTitle: trimmed(120).default(""),
  seoDescription: trimmed(300).default(""),
  productIds: z.array(uuid).max(500).default([]),
});

/* ------------------------------------------------------------- inventory */

export const inventoryAdjustSchema = z.object({
  variantId: uuid,
  stock: z.coerce.number().int().min(0).max(100_000),
  reason: z.enum(INVENTORY_REASONS),
  note: trimmed(200).optional(),
  /** Cost paid per unit, in rupees. Only meaningful when the stock went up. */
  unitCostRupees: z
    .union([z.coerce.number().min(0).max(1_000_000), z.literal(""), z.null(), z.undefined()])
    .transform((v) => (v === "" || v === null || v === undefined ? null : v)),
});

export const lowStockSchema = z.object({
  variantId: uuid,
  lowStockThreshold: z.coerce.number().int().min(0).max(10_000),
});

/* -------------------------------------------------------------- expenses */

export const expenseEntrySchema = z.object({
  category: z.enum(EXPENSE_CATEGORIES),
  amountRupees: z.coerce.number().min(0.01, "Amount is required").max(100_000_000),
  occurredOn: dateString,
  note: trimmed(200).optional(),
});

/* ------------------------------------------------------------- customers */

export const customersFilterSchema = z.object({
  q: trimmed(80).optional(),
  city: trimmed(60).optional(),
  tag: trimmed(40).optional(),
  segmentId: z.union([uuid, z.literal("")]).optional().transform((v) => (v ? v : undefined)),
  sort: z.enum(["recent", "spend", "orders", "risk"]).default("recent"),
  cursor: trimmed(120).optional(),
});

export const customerSchema = z.object({
  id: uuid,
  name: trimmed(80),
  email: z.union([z.string().trim().email("Enter a valid email").max(200), z.literal("")]).optional(),
  city: trimmed(60),
  tags: tagsField,
  internalNote: trimmed(2000).default(""),
});

export const mergeCustomersSchema = z.object({ sourceId: uuid, targetId: uuid });

export const segmentSchema = z.object({
  id: uuid.optional(),
  name: trimmed(80).min(2, "Name is required"),
  description: trimmed(300).default(""),
  rulesMatch: z.enum(["all", "any"]).default("all"),
  rules: rulesSchema.min(1, "Add at least one rule"),
});

/* ------------------------------------------------------------- discounts */

export const discountSchema = z
  .object({
    id: uuid.optional(),
    title: trimmed(80).min(2, "Title is required"),
    method: z.enum(["code", "automatic"]),
    code: trimmed(40).optional(),
    type: z.enum(["percentage", "fixed_amount", "free_delivery", "buy_x_get_y"]),
    percentage: z.coerce.number().min(0).max(100).default(0),
    amountRupees: z.coerce.number().min(0).max(1_000_000).default(0),
    appliesTo: z.enum(["order", "products", "collections"]),
    targetProductIds: z.array(uuid).max(200).default([]),
    targetCollectionIds: z.array(uuid).max(50).default([]),
    buyProductIds: z.array(uuid).max(200).default([]),
    getProductIds: z.array(uuid).max(200).default([]),
    buyQuantity: z.coerce.number().int().min(0).max(100).default(0),
    getQuantity: z.coerce.number().int().min(0).max(100).default(0),
    getDiscountPercent: z.coerce.number().min(0).max(100).default(100),
    minSubtotalRupees: rupeesToPaisaField().default(0),
    minQuantity: z.coerce.number().int().min(0).max(1000).default(0),
    firstTimeOnly: z.coerce.boolean().default(false),
    segmentId: z.union([uuid, z.literal("")]).optional().transform((v) => (v ? v : null)),
    usageLimit: z.union([z.coerce.number().int().min(1).max(1_000_000), z.literal("")]).optional(),
    oncePerCustomer: z.coerce.boolean().default(false),
    startsAt: dateString,
    endsAt: optionalDate,
    isEnabled: z.coerce.boolean().default(true),
  })
  .refine((v) => v.method !== "code" || (v.code ?? "").trim().length >= 3, {
    message: "A code discount needs a code of at least 3 characters",
    path: ["code"],
  })
  .refine((v) => v.type !== "buy_x_get_y" || (v.buyQuantity > 0 && v.getQuantity > 0), {
    message: "Set both the buy and get quantities",
    path: ["buyQuantity"],
  })
  .refine((v) => v.type !== "percentage" || v.percentage > 0, {
    message: "Enter a percentage above zero",
    path: ["percentage"],
  })
  .refine((v) => v.type !== "fixed_amount" || v.amountRupees > 0, {
    message: "Enter an amount above zero",
    path: ["amountRupees"],
  });

export const applyDiscountCodeSchema = z.object({ code: z.string().trim().min(1).max(40) });

/* --------------------------------------------------------------- content */

export const pageSchema = z.object({
  id: uuid.optional(),
  slug: slugField,
  title: trimmed(120).min(2, "Title is required"),
  body: z.string().max(60_000).default(""),
  seoTitle: trimmed(120).default(""),
  seoDescription: trimmed(300).default(""),
  status: z.enum(["draft", "published"]),
});

export const blogPostSchema = z.object({
  id: uuid.optional(),
  slug: slugField,
  title: trimmed(160).min(2, "Title is required"),
  excerpt: trimmed(400).default(""),
  body: z.string().max(120_000).default(""),
  coverImage: trimmed(400).default(""),
  authorName: trimmed(80).default(""),
  tags: tagsField,
  status: z.enum(["draft", "published"]),
  seoTitle: trimmed(120).default(""),
  seoDescription: trimmed(300).default(""),
  /** Local datetime, Asia/Karachi. Future values schedule the post. */
  publishedAt: z.union([z.string().trim().max(30), z.literal("")]).optional(),
});

export const menuItemSchema = z.object({
  /** Client-side draft id, not a database id: the editor rebuilds the tree. */
  id: trimmed(60).optional(),
  parentId: trimmed(60).optional().transform((v) => (v ? v : null)),
  label: trimmed(60).min(1, "Label is required"),
  url: trimmed(300).min(1, "Link is required"),
  resourceType: z.enum(["custom", "collection", "product", "page"]).default("custom"),
  resourceId: trimmed(120).optional(),
});

export const menuSchema = z.object({
  handle: z.enum(["header", "footer"]),
  items: z.array(menuItemSchema).max(60),
});

/* -------------------------------------------------------------- settings */

export const storeSettingsSchema = z.object({
  name: trimmed(80).min(1, "Store name is required"),
  contactPhone: trimmed(30),
  contactEmail: z.union([z.string().trim().email("Enter a valid email").max(200), z.literal("")]),
  address: trimmed(300),
  currency: trimmed(8).default("PKR"),
  timezone: trimmed(60).default("Asia/Karachi"),
  orderNumberPrefix: z
    .string()
    .trim()
    .max(10)
    .regex(/^[A-Z0-9-]*$/, "Use capital letters, numbers and hyphens")
    .default("MRK-"),
  acceptJazzcash: z.boolean().default(false),
  acceptEasypaisa: z.boolean().default(false),
  acceptBankTransfer: z.boolean().default(false),
  paymentNote: trimmed(300).default(""),
});

export const deliverySettingsSchema = z.object({
  flatRateRupees: z.coerce.number().min(0).max(100_000),
  freeThresholdRupees: z.coerce.number().min(0).max(10_000_000),
  cityRates: z
    .array(z.object({ city: trimmed(60).min(1), feeRupees: z.coerce.number().min(0).max(100_000) }))
    .max(200)
    .default([]),
  blockedCities: z.array(trimmed(60).min(1)).max(200).default([]),
});

export const notificationTemplateSchema = z.object({
  key: trimmed(40),
  subject: trimmed(200).default(""),
  body: z.string().max(4000).default(""),
  isEnabled: z.coerce.boolean().default(false),
});

/* ------------------------------------------------------------ metafields */

export const metafieldDefinitionSchema = z.object({
  id: uuid.optional(),
  key: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9_]+$/, "Use lowercase letters, numbers and underscores"),
  name: trimmed(60).min(2, "Name is required"),
  type: z.enum(METAFIELD_TYPES),
  description: trimmed(200).default(""),
});

/* ----------------------------------------------------------------- media */

export const mediaUpdateSchema = z.object({ id: uuid, alt: trimmed(200) });
export const mediaFromUrlSchema = z.object({
  /** Either an absolute URL or a path already served from /public. */
  url: z
    .string()
    .trim()
    .min(2)
    .max(500)
    .refine((v) => v.startsWith("/") || /^https?:\/\//.test(v), "Enter a path like /products/oil.webp or a full URL"),
  alt: trimmed(200).default(""),
});

/* ----------------------------------------------------------- saved views */

export const savedViewSchema = z.object({
  resource: z.enum(["orders", "products", "customers"]),
  name: trimmed(40).min(1, "Name the view"),
  query: trimmed(600).default(""),
});

/* -------------------------------------------------------------- activity */

export const activityFilterSchema = z.object({
  q: trimmed(80).optional(),
  userId: z.union([uuid, z.literal("")]).optional().transform((v) => (v ? v : undefined)),
  entityType: trimmed(40).optional(),
  action: trimmed(60).optional(),
  from: optionalDate,
  to: optionalDate,
  cursor: trimmed(40).optional(),
});

/* ------------------------------------------------------------- analytics */

export const analyticsRangeSchema = z.object({
  range: z.enum(["today", "7d", "30d", "90d", "custom"]).default("30d"),
  from: optionalDate,
  to: optionalDate,
});
export type AnalyticsRange = z.output<typeof analyticsRangeSchema>;
