"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Rule, RuleMatch } from "@/lib/admin/rules";
import { ErrorNote, useAction } from "./client-ui";
import { MediaPicker } from "./MediaPicker";
import { RuleBuilder } from "./RuleBuilder";
import {
  listProductOptionsAction,
  previewRulesAction,
  saveCollectionAction,
  type RulePreviewRow,
} from "@/app/admin/(panel)/collections/actions";

export interface CollectionFormValues {
  id?: string;
  title: string;
  slug: string;
  description: string;
  type: "manual" | "automatic";
  rulesMatch: RuleMatch;
  rules: Rule[];
  image: string;
  isPublished: boolean;
  sortOrder: string;
  seoTitle: string;
  seoDescription: string;
  productIds: string[];
}

export const EMPTY_COLLECTION: CollectionFormValues = {
  title: "",
  slug: "",
  description: "",
  type: "manual",
  rulesMatch: "all",
  rules: [],
  image: "",
  isPublished: true,
  sortOrder: "0",
  seoTitle: "",
  seoDescription: "",
  productIds: [],
};

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function CollectionForm({ initial }: { initial: CollectionFormValues }) {
  const router = useRouter();
  const { pending, error, runAction } = useAction();
  const [form, setForm] = useState(initial);
  const [slugTouched, setSlugTouched] = useState(Boolean(initial.id));
  const [picking, setPicking] = useState(false);
  const [options, setOptions] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [preview, setPreview] = useState<{ rows: RulePreviewRow[]; total: number } | null>(null);
  const [, startPreview] = useTransition();

  function set<K extends keyof CollectionFormValues>(key: K, value: CollectionFormValues[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  useEffect(() => {
    if (form.type !== "manual") return;
    if (options.length) return;
    listProductOptionsAction().then(setOptions);
  }, [form.type, options.length]);

  useEffect(() => {
    if (form.type !== "automatic") return;
    const timer = setTimeout(() => {
      startPreview(async () => {
        const result = await previewRulesAction(form.rules, form.rulesMatch);
        if (result.ok) setPreview(result.data);
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [form.rules, form.rulesMatch, form.type]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    runAction(
      () =>
        saveCollectionAction({
          id: form.id,
          title: form.title,
          slug: form.slug,
          description: form.description,
          type: form.type,
          rulesMatch: form.rulesMatch,
          rules: form.rules,
          image: form.image,
          isPublished: form.isPublished,
          sortOrder: form.sortOrder,
          seoTitle: form.seoTitle,
          seoDescription: form.seoDescription,
          productIds: form.productIds,
        }),
      {
        success: form.id ? "Collection saved" : "Collection created",
        refresh: false,
        onDone: (data) => {
          router.push(`/admin/collections/${data.id}`);
          router.refresh();
        },
      },
    );
  }

  /* Drag to reorder manual members. */
  function move(from: number, to: number) {
    if (to < 0 || to >= form.productIds.length) return;
    const next = [...form.productIds];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    set("productIds", next);
  }

  const nameById = new Map(options.map((o) => [o.id, o.name]));

  return (
    <form onSubmit={onSubmit} className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="space-y-3">
        <ErrorNote message={error} />

        <section className="a-card space-y-3 p-3">
          <h2>Details</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="title" className="a-label">
                Title
              </label>
              <input
                id="title"
                className="a-input"
                value={form.title}
                onChange={(e) => {
                  set("title", e.target.value);
                  if (!slugTouched) set("slug", slugify(e.target.value));
                }}
              />
            </div>
            <div>
              <label htmlFor="slug" className="a-label">
                Slug
              </label>
              <input
                id="slug"
                className="a-input"
                value={form.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  set("slug", e.target.value);
                }}
              />
            </div>
          </div>
          <div>
            <label htmlFor="description" className="a-label">
              Description
            </label>
            <textarea id="description" className="a-textarea" value={form.description} onChange={(e) => set("description", e.target.value)} />
          </div>
        </section>

        <section className="a-card space-y-3 p-3">
          <h2>Products</h2>
          <div className="flex gap-4">
            {(["manual", "automatic"] as const).map((t) => (
              <label key={t} className="flex items-center gap-1.5 text-[12.5px]">
                <input type="radio" name="type" checked={form.type === t} onChange={() => set("type", t)} />
                {t === "manual" ? "Hand-picked" : "Rule-based"}
              </label>
            ))}
          </div>

          {form.type === "automatic" ? (
            <>
              <RuleBuilder
                resource="product"
                rules={form.rules}
                match={form.rulesMatch}
                onChange={(rules) => set("rules", rules)}
                onMatchChange={(m) => set("rulesMatch", m)}
              />
              <div className="rounded border border-[var(--a-border)] p-2">
                <p className="a-label mb-1">
                  Preview {preview ? `· ${preview.total} product${preview.total === 1 ? "" : "s"} match` : ""}
                </p>
                {!preview || preview.rows.length === 0 ? (
                  <p className="text-[11.5px] text-[var(--a-soft)]">
                    Nothing matches yet. Add a condition with a value.
                  </p>
                ) : (
                  <ul className="grid gap-0.5 text-[11.5px] sm:grid-cols-2">
                    {preview.rows.map((r) => (
                      <li key={r.id} className="truncate">
                        {r.name} <span className="text-[var(--a-soft)]">/{r.slug}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <p className="a-hint">Automatic collections re-evaluate whenever a product is saved.</p>
            </>
          ) : (
            <>
              <div>
                <label htmlFor="add-product" className="a-label">
                  Add a product
                </label>
                <select
                  id="add-product"
                  className="a-select"
                  value=""
                  onChange={(e) => {
                    if (e.target.value && !form.productIds.includes(e.target.value)) {
                      set("productIds", [...form.productIds, e.target.value]);
                    }
                  }}
                >
                  <option value="">Choose a product…</option>
                  {options
                    .filter((o) => !form.productIds.includes(o.id))
                    .map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                </select>
              </div>

              {form.productIds.length === 0 ? (
                <p className="text-[12px] text-[var(--a-soft)]">No products in this collection yet.</p>
              ) : (
                <ol className="space-y-1">
                  {form.productIds.map((id, i) => (
                    <li
                      key={id}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData("text/plain", String(i))}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        move(Number(e.dataTransfer.getData("text/plain")), i);
                      }}
                      className="flex items-center gap-2 rounded border border-[var(--a-border)] bg-white px-2 py-1"
                    >
                      <span className="cursor-grab text-[var(--a-soft)]" aria-hidden="true">
                        ⠿
                      </span>
                      <span className="a-num w-6 text-[var(--a-soft)]">{i + 1}</span>
                      <span className="min-w-0 flex-1 truncate text-[12.5px]">{nameById.get(id) ?? id}</span>
                      <button type="button" className="a-btn a-btn-xs" aria-label={`Move ${nameById.get(id)} up`} onClick={() => move(i, i - 1)}>
                        ↑
                      </button>
                      <button type="button" className="a-btn a-btn-xs" aria-label={`Move ${nameById.get(id)} down`} onClick={() => move(i, i + 1)}>
                        ↓
                      </button>
                      <button
                        type="button"
                        className="a-btn-link text-[var(--a-danger)]"
                        onClick={() => set("productIds", form.productIds.filter((p) => p !== id))}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ol>
              )}
              <p className="a-hint">Drag a row, or use the arrows, to change the order shown on the storefront.</p>
            </>
          )}
        </section>

        <section className="a-card space-y-3 p-3">
          <h2>Search listing</h2>
          <div>
            <label htmlFor="seoTitle" className="a-label">
              SEO title
            </label>
            <input id="seoTitle" className="a-input" value={form.seoTitle} onChange={(e) => set("seoTitle", e.target.value)} />
          </div>
          <div>
            <label htmlFor="seoDescription" className="a-label">
              SEO description
            </label>
            <textarea
              id="seoDescription"
              className="a-textarea"
              value={form.seoDescription}
              onChange={(e) => set("seoDescription", e.target.value)}
            />
          </div>
        </section>
      </div>

      <div className="space-y-3">
        <section className="a-card space-y-2 p-3">
          <h2>Publishing</h2>
          <label className="flex items-center gap-2 text-[12.5px]">
            <input type="checkbox" checked={form.isPublished} onChange={(e) => set("isPublished", e.target.checked)} />
            Published
          </label>
          <div>
            <label htmlFor="sortOrder" className="a-label">
              Sort order
            </label>
            <input id="sortOrder" className="a-input" type="number" min={0} value={form.sortOrder} onChange={(e) => set("sortOrder", e.target.value)} />
          </div>
          <button type="submit" className="a-btn a-btn-primary w-full" disabled={pending}>
            {pending ? "Saving…" : form.id ? "Save collection" : "Create collection"}
          </button>
        </section>

        <section className="a-card p-3">
          <div className="mb-2 flex items-center justify-between">
            <h2>Image</h2>
            <button type="button" className="a-btn a-btn-xs" onClick={() => setPicking(true)}>
              Choose
            </button>
          </div>
          {form.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={form.image} alt="" className="mb-2 w-full rounded border border-[var(--a-border)] object-contain" />
          ) : null}
          <input className="a-input" aria-label="Collection image path" value={form.image} onChange={(e) => set("image", e.target.value)} />
          <MediaPicker
            open={picking}
            onClose={() => setPicking(false)}
            onPick={(url) => {
              set("image", url);
              setPicking(false);
            }}
          />
        </section>
      </div>
    </form>
  );
}
