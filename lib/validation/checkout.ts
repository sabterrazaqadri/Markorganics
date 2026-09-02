import { z } from "zod";
import { MAX_QTY_PER_LINE } from "@/config/commerce";
import { normalizePkPhone } from "@/lib/phone";

const phoneField = z
  .string()
  .trim()
  .min(1, "Enter a mobile number")
  .refine((v) => normalizePkPhone(v) !== null, "Enter a Pakistani mobile number like 0300 1234567")
  .transform((v) => normalizePkPhone(v) as string);

const optionalPhoneField = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined))
  .refine((v) => v === undefined || normalizePkPhone(v) !== null, "Enter a Pakistani mobile number like 0300 1234567")
  .transform((v) => (v ? (normalizePkPhone(v) as string) : null));

export const cartLineSchema = z.object({
  variantId: z.string().uuid("Invalid item"),
  quantity: z.number().int().min(1).max(MAX_QTY_PER_LINE),
});

export const checkoutSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(3, "Enter your full name (at least 3 characters)")
    .max(60, "Name must be 60 characters or fewer"),
  phone: phoneField,
  altPhone: optionalPhoneField,
  city: z.string().trim().min(2, "Choose or type your city").max(60, "City must be 60 characters or fewer"),
  address: z
    .string()
    .trim()
    .min(10, "Enter your full address, including street and area (at least 10 characters)")
    .max(200, "Address must be 200 characters or fewer"),
  notes: z
    .string()
    .trim()
    .max(300, "Notes must be 300 characters or fewer")
    .optional()
    .transform((v) => (v ? v : null)),
  /** Honeypot. Real users never fill this. */
  website: z.string().max(0, "Spam check failed").optional(),
  items: z.array(cartLineSchema).min(1, "Your cart is empty").max(30),
  /** Only the code travels; the amount is always recalculated server-side. */
  discountCode: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((v) => (v ? v : undefined)),
  /** Links the order back to its abandoned-checkout row. */
  sessionKey: z.string().trim().max(64).optional(),
});

/** What the cart and checkout ask for when they need a price. */
export const quoteSchema = z.object({
  items: z.array(cartLineSchema).max(30),
  code: z.string().trim().max(40).optional().transform((v) => (v ? v : undefined)),
  city: z.string().trim().max(60).optional(),
  phone: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && normalizePkPhone(v) ? (normalizePkPhone(v) as string) : undefined)),
});

export type QuoteInput = z.input<typeof quoteSchema>;
export type QuoteValues = z.output<typeof quoteSchema>;

export type CheckoutInput = z.input<typeof checkoutSchema>;
export type CheckoutValues = z.output<typeof checkoutSchema>;

export type FieldErrors = Partial<Record<keyof CheckoutInput, string>>;

export function issuesToFieldErrors(issues: z.core.$ZodIssue[]): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !(key in out)) {
      out[key as keyof CheckoutInput] = issue.message;
    }
  }
  return out;
}

export const trackOrderSchema = z.object({
  orderNumber: z.string().trim().min(6, "Enter your order number, e.g. MRK-ABC123"),
  phone: phoneField,
});
