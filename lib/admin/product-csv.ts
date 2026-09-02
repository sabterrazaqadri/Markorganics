import "server-only";
import Papa from "papaparse";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { productVariants, products, type ProductStatus } from "@/lib/db/schema";
import { toCsv } from "@/lib/csv";
import { paisaToDecimal, rupeesToPaisa } from "@/lib/money";
import { reevaluateAllAutomaticCollections } from "./collections";
import { setStock } from "./inventory";

export const CSV_COLUMNS = [
  "handle",
  "title",
  "family",
  "status",
  "product_type",
  "vendor",
  "tags",
  "short_description",
  "long_description",
  "ingredients",
  "benefits",
  "how_to_use",
  "images",
  "seo_title",
  "seo_description",
  "bestseller",
  "sort_order",
  "variant_sku",
  "variant_label",
  "variant_barcode",
  "variant_price",
  "variant_compare_at",
  "variant_stock",
  "variant_low_stock",
] as const;

const FAMILIES = new Set(["oils", "relief", "home"]);
const STATUSES = new Set<ProductStatus>(["active", "draft", "archived"]);

/* ---------------------------------------------------------------- export */

export async function exportProductsCsv(): Promise<string> {
  const rows = await db.query.products.findMany({
    where: isNull(products.deletedAt),
    orderBy: products.name,
    with: { variants: { where: isNull(productVariants.deletedAt) } },
  });

  const out: unknown[][] = [];
  for (const p of rows) {
    for (const v of p.variants) {
      out.push([
        p.slug,
        p.name,
        p.family,
        p.status,
        p.productType,
        p.vendor,
        p.tags.join("|"),
        p.shortDescription,
        p.longDescription,
        p.ingredients,
        p.benefits.join("|"),
        p.howToUse.join("|"),
        p.images.join("|"),
        p.seoTitle,
        p.seoDescription,
        p.isBestseller ? "yes" : "no",
        p.sortOrder,
        v.sku,
        v.label,
        v.barcode,
        paisaToDecimal(v.pricePaisa),
        v.compareAtPaisa ? paisaToDecimal(v.compareAtPaisa) : "",
        v.stock,
        v.lowStockThreshold,
      ]);
    }
  }
  return toCsv([...CSV_COLUMNS], out);
}

export function csvTemplate(): string {
  return toCsv(
    [...CSV_COLUMNS],
    [
      [
        "mustard-oil",
        "Cold-pressed mustard oil",
        "oils",
        "active",
        "Hair oil",
        "MARKORGANICS",
        "hair|winter",
        "Sharp, unrefined, pressed cold.",
        "A longer description of at least twenty characters goes here.",
        "100% mustard seed",
        "Reduces hair fall|Soothes dry scalp",
        "Warm slightly|Massage into the scalp",
        "/products/mustard-oil-200.webp",
        "",
        "",
        "yes",
        "0",
        "MRK-MUS-200",
        "200 ml",
        "",
        "450",
        "550",
        "24",
        "5",
      ],
    ],
  );
}

/* ---------------------------------------------------------------- import */

export interface ImportRowResult {
  line: number;
  handle: string;
  sku: string;
  action: "create" | "update" | "skip" | "error";
  message: string;
}

export interface ImportPlan {
  ok: boolean;
  rows: ImportRowResult[];
  created: number;
  updated: number;
  skipped: number;
  errors: number;
}

interface ParsedRow {
  line: number;
  raw: Record<string, string>;
}

function cell(raw: Record<string, string>, key: string): string {
  return (raw[key] ?? "").trim();
}

function list(raw: Record<string, string>, key: string): string[] {
  return cell(raw, key)
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Validates the whole file before touching a single row.
 *
 * A CSV that is half-good is worse than one that is rejected: a partially
 * applied import leaves a catalogue nobody can reason about. So this returns a
 * plan, and `applyImport` refuses to run unless the plan is clean.
 */
export async function planImport(csv: string): Promise<ImportPlan> {
  const parsed = Papa.parse<Record<string, string>>(csv.replace(/^﻿/, ""), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim().toLowerCase(),
  });

  const rows: ImportRowResult[] = [];
  const push = (r: ImportRowResult) => rows.push(r);

  if (parsed.errors.length) {
    for (const e of parsed.errors.slice(0, 20)) {
      push({ line: (e.row ?? 0) + 2, handle: "", sku: "", action: "error", message: e.message });
    }
  }

  const data: ParsedRow[] = (parsed.data ?? []).map((raw, i) => ({ line: i + 2, raw }));
  if (data.length === 0 && rows.length === 0) {
    push({ line: 0, handle: "", sku: "", action: "error", message: "The file has no data rows." });
  }
  if (data.length > 2000) {
    push({ line: 0, handle: "", sku: "", action: "error", message: "Import at most 2000 rows at a time." });
  }

  const missingHeaders = ["handle", "variant_sku", "variant_label", "variant_price"].filter(
    (h) => !(parsed.meta.fields ?? []).includes(h),
  );
  if (missingHeaders.length) {
    push({
      line: 1,
      handle: "",
      sku: "",
      action: "error",
      message: `Missing required column${missingHeaders.length > 1 ? "s" : ""}: ${missingHeaders.join(", ")}`,
    });
  }

  const handles = [...new Set(data.map((r) => cell(r.raw, "handle")).filter(Boolean))];
  const skus = data.map((r) => cell(r.raw, "variant_sku")).filter(Boolean);

  const [existingProducts, existingVariants] = await Promise.all([
    handles.length
      ? db.select({ id: products.id, slug: products.slug }).from(products).where(inArray(products.slug, handles))
      : Promise.resolve([]),
    skus.length
      ? db
          .select({ id: productVariants.id, sku: productVariants.sku, productId: productVariants.productId })
          .from(productVariants)
          .where(inArray(productVariants.sku, skus))
      : Promise.resolve([]),
  ]);

  const productBySlug = new Map(existingProducts.map((p) => [p.slug, p]));
  const variantBySku = new Map(existingVariants.map((v) => [v.sku, v]));

  const seenSkus = new Set<string>();
  let created = 0;
  let updated = 0;
  let errors = rows.filter((r) => r.action === "error").length;

  for (const { line, raw } of data) {
    const handle = cell(raw, "handle");
    const sku = cell(raw, "variant_sku");
    const fail = (message: string) => {
      push({ line, handle, sku, action: "error", message });
      errors += 1;
    };

    if (!handle) {
      fail("handle is required");
      continue;
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(handle)) {
      fail("handle must be lowercase letters, numbers and hyphens");
      continue;
    }
    if (!sku) {
      fail("variant_sku is required");
      continue;
    }
    if (seenSkus.has(sku)) {
      fail(`variant_sku "${sku}" appears twice in this file`);
      continue;
    }
    seenSkus.add(sku);

    const label = cell(raw, "variant_label");
    if (!label) {
      fail("variant_label is required");
      continue;
    }

    const price = Number(cell(raw, "variant_price"));
    if (!Number.isFinite(price) || price < 1) {
      fail("variant_price must be a number of at least 1");
      continue;
    }

    const compareAtRaw = cell(raw, "variant_compare_at");
    if (compareAtRaw && !Number.isFinite(Number(compareAtRaw))) {
      fail("variant_compare_at must be a number or blank");
      continue;
    }

    const stockRaw = cell(raw, "variant_stock");
    if (stockRaw && (!Number.isInteger(Number(stockRaw)) || Number(stockRaw) < 0)) {
      fail("variant_stock must be a whole number of 0 or more");
      continue;
    }

    const family = cell(raw, "family") || "oils";
    const existingProduct = productBySlug.get(handle);
    if (!existingProduct && !FAMILIES.has(family)) {
      fail(`family must be one of oils, relief, home (got "${family}")`);
      continue;
    }

    const status = cell(raw, "status") || "active";
    if (!STATUSES.has(status as ProductStatus)) {
      fail(`status must be one of active, draft, archived (got "${status}")`);
      continue;
    }

    if (!existingProduct) {
      const title = cell(raw, "title");
      if (title.length < 2) {
        fail("title is required for a new product");
        continue;
      }
      if (cell(raw, "short_description").length < 5) {
        fail("short_description is required for a new product");
        continue;
      }
      if (cell(raw, "long_description").length < 20) {
        fail("long_description of at least 20 characters is required for a new product");
        continue;
      }
    }

    const existingVariant = variantBySku.get(sku);
    if (existingVariant && existingProduct && existingVariant.productId !== existingProduct.id) {
      fail(`variant_sku "${sku}" already belongs to another product`);
      continue;
    }
    if (existingVariant && !existingProduct) {
      fail(`variant_sku "${sku}" already belongs to another product`);
      continue;
    }

    if (existingVariant) {
      updated += 1;
      push({ line, handle, sku, action: "update", message: "Variant and product fields will be updated" });
    } else {
      created += 1;
      push({
        line,
        handle,
        sku,
        action: "create",
        message: existingProduct ? "New variant on an existing product" : "New product and variant",
      });
    }
  }

  return {
    ok: errors === 0 && data.length > 0,
    rows,
    created,
    updated,
    skipped: 0,
    errors,
  };
}

export interface ImportOutcome {
  productsCreated: number;
  productsUpdated: number;
  variantsCreated: number;
  variantsUpdated: number;
}

/** Applies a plan that passed validation, in one transaction. */
export async function applyImport(csv: string, userId?: string): Promise<ImportOutcome> {
  const plan = await planImport(csv);
  if (!plan.ok) throw new Error("The file has errors and was not applied.");

  const parsed = Papa.parse<Record<string, string>>(csv.replace(/^﻿/, ""), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim().toLowerCase(),
  });

  const outcome: ImportOutcome = { productsCreated: 0, productsUpdated: 0, variantsCreated: 0, variantsUpdated: 0 };

  await db.transaction(async (tx) => {
    const touchedProducts = new Map<string, string>(); // slug -> id

    for (const raw of parsed.data ?? []) {
      const handle = cell(raw, "handle");
      if (!handle) continue;

      let productId = touchedProducts.get(handle);
      if (!productId) {
        const [existing] = await tx
          .select({ id: products.id })
          .from(products)
          .where(and(eq(products.slug, handle), isNull(products.deletedAt)))
          .limit(1);

        const status = (cell(raw, "status") || "active") as ProductStatus;
        const fields = {
          name: cell(raw, "title") || handle,
          family: (cell(raw, "family") || "oils") as "oils" | "relief" | "home",
          status,
          isArchived: status === "archived",
          productType: cell(raw, "product_type"),
          vendor: cell(raw, "vendor"),
          tags: list(raw, "tags"),
          shortDescription: cell(raw, "short_description"),
          longDescription: cell(raw, "long_description"),
          ingredients: cell(raw, "ingredients"),
          benefits: list(raw, "benefits"),
          howToUse: list(raw, "how_to_use"),
          images: list(raw, "images"),
          seoTitle: cell(raw, "seo_title"),
          seoDescription: cell(raw, "seo_description"),
          isBestseller: /^(yes|true|1)$/i.test(cell(raw, "bestseller")),
          sortOrder: Number(cell(raw, "sort_order")) || 0,
          updatedAt: new Date(),
        };

        if (existing) {
          // Only overwrite text fields the file actually carried.
          const patch = Object.fromEntries(
            Object.entries(fields).filter(([key, value]) => {
              if (key === "updatedAt") return true;
              if (typeof value === "string") return value !== "";
              if (Array.isArray(value)) return value.length > 0;
              return raw[
                key === "isBestseller" ? "bestseller" : key === "sortOrder" ? "sort_order" : key
              ] !== undefined;
            }),
          );
          await tx.update(products).set(patch).where(eq(products.id, existing.id));
          productId = existing.id;
          outcome.productsUpdated += 1;
        } else {
          const [row] = await tx.insert(products).values({ ...fields, slug: handle }).returning({ id: products.id });
          productId = row.id;
          outcome.productsCreated += 1;
        }
        touchedProducts.set(handle, productId);
      }

      const sku = cell(raw, "variant_sku");
      const [variant] = await tx
        .select({ id: productVariants.id })
        .from(productVariants)
        .where(eq(productVariants.sku, sku))
        .limit(1);

      const compareAtRaw = cell(raw, "variant_compare_at");
      const variantFields = {
        sku,
        label: cell(raw, "variant_label"),
        barcode: cell(raw, "variant_barcode"),
        pricePaisa: rupeesToPaisa(Number(cell(raw, "variant_price"))),
        compareAtPaisa: compareAtRaw ? rupeesToPaisa(Number(compareAtRaw)) : null,
        lowStockThreshold: Number(cell(raw, "variant_low_stock")) || 5,
        deletedAt: null,
        updatedAt: new Date(),
      };
      const stockRaw = cell(raw, "variant_stock");

      if (variant) {
        await tx.update(productVariants).set(variantFields).where(eq(productVariants.id, variant.id));
        if (stockRaw !== "") {
          await setStock(tx, {
            variantId: variant.id,
            stock: Number(stockRaw),
            reason: "correction",
            note: "CSV import",
            userId,
          });
        }
        outcome.variantsUpdated += 1;
      } else {
        await tx
          .insert(productVariants)
          .values({ ...variantFields, productId, stock: stockRaw === "" ? 0 : Number(stockRaw) });
        outcome.variantsCreated += 1;
      }
    }
  });

  await reevaluateAllAutomaticCollections();
  return outcome;
}

export { sql };
