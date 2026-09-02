"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { productInputSchema, type ProductInput } from "@/lib/validation/product";
import { FAMILIES, FAMILY_ORDER } from "@/lib/catalog";
import { PRODUCT_STATUSES, type MetafieldType, type ProductStatus } from "@/lib/db/schema";
import { PRODUCT_STATUS_LABEL } from "./ui";
import { ErrorNote, TagInput, useAction } from "./client-ui";
import { MediaPicker } from "./MediaPicker";
import { saveProductAction } from "@/app/admin/(panel)/products/actions";

interface VariantRow {
  id?: string;
  sku: string;
  label: string;
  barcode: string;
  priceRupees: string;
  compareAtRupees: string;
  stock: string;
  lowStockThreshold: string;
}

export interface MetafieldDef {
  id: string;
  key: string;
  name: string;
  type: MetafieldType;
  description: string;
}

export interface CollectionOption {
  id: string;
  title: string;
  type: string;
}

export interface ProductFormValues {
  name: string;
  slug: string;
  family: "oils" | "relief" | "home";
  status: ProductStatus;
  productType: string;
  vendor: string;
  tags: string[];
  seoTitle: string;
  seoDescription: string;
  shortDescription: string;
  longDescription: string;
  howToUse: string;
  ingredients: string;
  benefits: string;
  images: string;
  isBestseller: boolean;
  sortOrder: string;
  variants: VariantRow[];
  metafields: Record<string, string>;
  collectionIds: string[];
}

const EMPTY_VARIANT: VariantRow = {
  sku: "",
  label: "",
  barcode: "",
  priceRupees: "",
  compareAtRupees: "",
  stock: "0",
  lowStockThreshold: "5",
};

export const EMPTY_FORM: ProductFormValues = {
  name: "",
  slug: "",
  family: "oils",
  status: "draft",
  productType: "",
  vendor: "",
  tags: [],
  seoTitle: "",
  seoDescription: "",
  shortDescription: "",
  longDescription: "",
  howToUse: "",
  ingredients: "",
  benefits: "",
  images: "",
  isBestseller: false,
  sortOrder: "0",
  variants: [{ ...EMPTY_VARIANT }],
  metafields: {},
  collectionIds: [],
};

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function ProductForm({
  productId,
  initial,
  definitions,
  collections,
}: {
  productId?: string;
  initial: ProductFormValues;
  definitions: MetafieldDef[];
  collections: CollectionOption[];
}) {
  const router = useRouter();
  const { pending, error, runAction, setError } = useAction();
  const [form, setForm] = useState<ProductFormValues>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [slugTouched, setSlugTouched] = useState(Boolean(productId));
  const [pickingImages, setPickingImages] = useState(false);

  function set<K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }
  function setVariant(i: number, patch: Partial<VariantRow>) {
    setForm((f) => ({ ...f, variants: f.variants.map((v, idx) => (idx === i ? { ...v, ...patch } : v)) }));
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const input: ProductInput = {
      name: form.name,
      slug: form.slug,
      family: form.family,
      status: form.status,
      productType: form.productType,
      vendor: form.vendor,
      tags: form.tags.join(", "),
      seoTitle: form.seoTitle,
      seoDescription: form.seoDescription,
      shortDescription: form.shortDescription,
      longDescription: form.longDescription,
      howToUse: form.howToUse,
      ingredients: form.ingredients,
      benefits: form.benefits,
      images: form.images,
      isBestseller: form.isBestseller,
      isArchived: form.status === "archived",
      sortOrder: form.sortOrder,
      variants: form.variants.map((v) => ({
        id: v.id,
        sku: v.sku,
        label: v.label,
        barcode: v.barcode,
        priceRupees: v.priceRupees,
        compareAtRupees: v.compareAtRupees === "" ? "" : v.compareAtRupees,
        stock: v.stock,
        lowStockThreshold: v.lowStockThreshold,
      })),
      metafields: definitions.map((d) => ({ definitionId: d.id, value: form.metafields[d.id] ?? "" })),
      collectionIds: form.collectionIds,
    };

    const parsed = productInputSchema.safeParse(input);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".");
        if (!errs[key]) errs[key] = issue.message;
      }
      setErrors(errs);
      setError("Check the highlighted fields.");
      return;
    }
    setErrors({});

    runAction(() => saveProductAction(input, productId), {
      success: productId ? "Saved" : "Product created",
      refresh: false,
      onDone: (data) => {
        router.push(`/admin/products/${data.id}`);
        router.refresh();
      },
    });
  }

  const err = (k: string) => (errors[k] ? <p className="a-err">{errors[k]}</p> : null);
  const imageList = form.images.split("\n").map((s) => s.trim()).filter(Boolean);
  const manualCollections = collections.filter((c) => c.type === "manual");

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="space-y-3">
        <ErrorNote message={error} />

        <section className="a-card space-y-3 p-3">
          <h2>Basics</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="name" className="a-label">
                Name
              </label>
              <input
                id="name"
                className="a-input"
                value={form.name}
                aria-invalid={errors.name ? "true" : undefined}
                onChange={(e) => {
                  set("name", e.target.value);
                  if (!slugTouched) set("slug", slugify(e.target.value));
                }}
              />
              {err("name")}
            </div>
            <div>
              <label htmlFor="slug" className="a-label">
                Slug
              </label>
              <input
                id="slug"
                className="a-input"
                value={form.slug}
                aria-invalid={errors.slug ? "true" : undefined}
                onChange={(e) => {
                  setSlugTouched(true);
                  set("slug", e.target.value);
                }}
              />
              {err("slug")}
            </div>
          </div>
          <div>
            <label htmlFor="shortDescription" className="a-label">
              Short description
            </label>
            <input
              id="shortDescription"
              className="a-input"
              maxLength={140}
              value={form.shortDescription}
              onChange={(e) => set("shortDescription", e.target.value)}
            />
            {err("shortDescription")}
          </div>
          <div>
            <label htmlFor="longDescription" className="a-label">
              Long description
            </label>
            <textarea
              id="longDescription"
              className="a-textarea min-h-32"
              value={form.longDescription}
              onChange={(e) => set("longDescription", e.target.value)}
            />
            {err("longDescription")}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="benefits" className="a-label">
                Benefits (one per line)
              </label>
              <textarea id="benefits" className="a-textarea" value={form.benefits} onChange={(e) => set("benefits", e.target.value)} />
            </div>
            <div>
              <label htmlFor="howToUse" className="a-label">
                How to use (one per line)
              </label>
              <textarea id="howToUse" className="a-textarea" value={form.howToUse} onChange={(e) => set("howToUse", e.target.value)} />
            </div>
          </div>
          <div>
            <label htmlFor="ingredients" className="a-label">
              Ingredients
            </label>
            <textarea id="ingredients" className="a-textarea" value={form.ingredients} onChange={(e) => set("ingredients", e.target.value)} />
          </div>
        </section>

        <section className="a-card p-3">
          <div className="mb-2 flex items-center justify-between">
            <h2>Images</h2>
            <button type="button" className="a-btn a-btn-xs" onClick={() => setPickingImages(true)}>
              Pick from files
            </button>
          </div>
          {imageList.length ? (
            <ul className="mb-2 flex flex-wrap gap-2">
              {imageList.map((src) => (
                <li key={src} className="w-20">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="h-20 w-20 rounded border border-[var(--a-border)] object-cover" />
                </li>
              ))}
            </ul>
          ) : null}
          <label htmlFor="images" className="a-label">
            Image paths (one per line)
          </label>
          <textarea id="images" className="a-textarea" value={form.images} onChange={(e) => set("images", e.target.value)} />
          <MediaPicker
            open={pickingImages}
            onClose={() => setPickingImages(false)}
            onPick={(url) => {
              setPickingImages(false);
              set("images", form.images ? `${form.images.replace(/\n+$/, "")}\n${url}` : url);
            }}
          />
        </section>

        <section className="a-card p-3">
          <h2 className="mb-2">Variants</h2>
          <div className="a-scroll">
            <table className="a-table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Size label</th>
                  <th>Barcode</th>
                  <th className="a-num">Price Rs</th>
                  <th className="a-num">Compare at</th>
                  <th className="a-num">Stock</th>
                  <th className="a-num">Low at</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {form.variants.map((v, i) => (
                  <tr key={v.id ?? `new-${i}`}>
                    <td>
                      <input
                        className="a-input a-input-xs"
                        aria-label={`SKU for variant ${i + 1}`}
                        value={v.sku}
                        onChange={(e) => setVariant(i, { sku: e.target.value })}
                      />
                      {err(`variants.${i}.sku`)}
                    </td>
                    <td>
                      <input
                        className="a-input a-input-xs"
                        aria-label={`Label for variant ${i + 1}`}
                        value={v.label}
                        onChange={(e) => setVariant(i, { label: e.target.value })}
                      />
                      {err(`variants.${i}.label`)}
                    </td>
                    <td>
                      <input
                        className="a-input a-input-xs"
                        aria-label={`Barcode for variant ${i + 1}`}
                        value={v.barcode}
                        onChange={(e) => setVariant(i, { barcode: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        className="a-input a-input-xs text-right"
                        type="number"
                        min={0}
                        step="0.01"
                        aria-label={`Price for variant ${i + 1}`}
                        value={v.priceRupees}
                        onChange={(e) => setVariant(i, { priceRupees: e.target.value })}
                      />
                      {err(`variants.${i}.priceRupees`)}
                    </td>
                    <td>
                      <input
                        className="a-input a-input-xs text-right"
                        type="number"
                        min={0}
                        step="0.01"
                        aria-label={`Compare-at price for variant ${i + 1}`}
                        value={v.compareAtRupees}
                        onChange={(e) => setVariant(i, { compareAtRupees: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        className="a-input a-input-xs text-right"
                        type="number"
                        min={0}
                        aria-label={`Stock for variant ${i + 1}`}
                        value={v.stock}
                        onChange={(e) => setVariant(i, { stock: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        className="a-input a-input-xs text-right"
                        type="number"
                        min={0}
                        aria-label={`Low stock threshold for variant ${i + 1}`}
                        value={v.lowStockThreshold}
                        onChange={(e) => setVariant(i, { lowStockThreshold: e.target.value })}
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="a-btn-link text-[var(--a-danger)]"
                        disabled={form.variants.length === 1}
                        onClick={() => set("variants", form.variants.filter((_, idx) => idx !== i))}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" className="a-btn a-btn-xs mt-2" onClick={() => set("variants", [...form.variants, { ...EMPTY_VARIANT }])}>
            Add variant
          </button>
          <p className="a-hint">Stock changes here are written to the inventory ledger with a Correction reason.</p>
        </section>

        {definitions.length ? (
          <section className="a-card space-y-3 p-3">
            <h2>Metafields</h2>
            {definitions.map((def) => (
              <div key={def.id}>
                <label htmlFor={`mf-${def.id}`} className="a-label">
                  {def.name} <span className="font-normal text-[var(--a-soft)]">({def.type.replace("_", " ")})</span>
                </label>
                {def.type === "boolean" ? (
                  <select
                    id={`mf-${def.id}`}
                    className="a-select"
                    value={form.metafields[def.id] ?? ""}
                    onChange={(e) => set("metafields", { ...form.metafields, [def.id]: e.target.value })}
                  >
                    <option value="">Not set</option>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                ) : def.type === "rich_text" ? (
                  <textarea
                    id={`mf-${def.id}`}
                    className="a-textarea"
                    value={form.metafields[def.id] ?? ""}
                    onChange={(e) => set("metafields", { ...form.metafields, [def.id]: e.target.value })}
                  />
                ) : (
                  <input
                    id={`mf-${def.id}`}
                    className="a-input"
                    type={def.type === "number" ? "number" : "text"}
                    value={form.metafields[def.id] ?? ""}
                    onChange={(e) => set("metafields", { ...form.metafields, [def.id]: e.target.value })}
                  />
                )}
                {def.description ? <p className="a-hint">{def.description}</p> : null}
              </div>
            ))}
          </section>
        ) : null}

        <section className="a-card space-y-3 p-3">
          <h2>Search listing</h2>
          <div>
            <label htmlFor="seoTitle" className="a-label">
              SEO title
            </label>
            <input id="seoTitle" className="a-input" maxLength={120} value={form.seoTitle} onChange={(e) => set("seoTitle", e.target.value)} />
          </div>
          <div>
            <label htmlFor="seoDescription" className="a-label">
              SEO description
            </label>
            <textarea
              id="seoDescription"
              className="a-textarea"
              maxLength={300}
              value={form.seoDescription}
              onChange={(e) => set("seoDescription", e.target.value)}
            />
          </div>
        </section>
      </div>

      <div className="space-y-3">
        <section className="a-card space-y-2 p-3">
          <h2>Status</h2>
          <select
            className="a-select"
            aria-label="Product status"
            value={form.status}
            onChange={(e) => set("status", e.target.value as ProductStatus)}
          >
            {PRODUCT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {PRODUCT_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <p className="a-hint">Only Active products appear on the storefront.</p>
          <button type="submit" className="a-btn a-btn-primary w-full" disabled={pending}>
            {pending ? "Saving…" : productId ? "Save product" : "Create product"}
          </button>
        </section>

        <section className="a-card space-y-3 p-3">
          <h2>Organisation</h2>
          <div>
            <label htmlFor="family" className="a-label">
              Family
            </label>
            <select id="family" className="a-select" value={form.family} onChange={(e) => set("family", e.target.value as ProductFormValues["family"])}>
              {FAMILY_ORDER.map((f) => (
                <option key={f} value={f}>
                  {FAMILIES[f].name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="productType" className="a-label">
              Product type
            </label>
            <input id="productType" className="a-input" value={form.productType} onChange={(e) => set("productType", e.target.value)} />
          </div>
          <div>
            <label htmlFor="vendor" className="a-label">
              Vendor
            </label>
            <input id="vendor" className="a-input" value={form.vendor} onChange={(e) => set("vendor", e.target.value)} />
          </div>
          <div>
            <span className="a-label">Tags</span>
            <TagInput value={form.tags} onChange={(tags) => set("tags", tags)} />
          </div>
          <div className="flex items-center gap-2">
            <input
              id="bestseller"
              type="checkbox"
              checked={form.isBestseller}
              onChange={(e) => set("isBestseller", e.target.checked)}
            />
            <label htmlFor="bestseller" className="text-[12.5px]">
              Show as a bestseller
            </label>
          </div>
          <div>
            <label htmlFor="sortOrder" className="a-label">
              Sort order
            </label>
            <input
              id="sortOrder"
              className="a-input"
              type="number"
              min={0}
              value={form.sortOrder}
              onChange={(e) => set("sortOrder", e.target.value)}
            />
          </div>
        </section>

        {manualCollections.length ? (
          <section className="a-card p-3">
            <h2 className="mb-2">Manual collections</h2>
            <ul className="space-y-1">
              {manualCollections.map((c) => (
                <li key={c.id} className="flex items-center gap-2">
                  <input
                    id={`col-${c.id}`}
                    type="checkbox"
                    checked={form.collectionIds.includes(c.id)}
                    onChange={(e) =>
                      set(
                        "collectionIds",
                        e.target.checked ? [...form.collectionIds, c.id] : form.collectionIds.filter((id) => id !== c.id),
                      )
                    }
                  />
                  <label htmlFor={`col-${c.id}`} className="text-[12.5px]">
                    {c.title}
                  </label>
                </li>
              ))}
            </ul>
            <p className="a-hint">Automatic collections re-evaluate themselves when you save.</p>
          </section>
        ) : null}
      </div>
    </form>
  );
}
