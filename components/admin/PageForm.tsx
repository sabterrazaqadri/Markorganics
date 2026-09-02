"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ConfirmButton, ErrorNote, useAction } from "./client-ui";
import { RichTextEditor } from "./RichTextEditor";
import { deletePageAction, savePageAction } from "@/app/admin/(panel)/content/actions";

export interface PageFormValues {
  id?: string;
  slug: string;
  title: string;
  body: string;
  seoTitle: string;
  seoDescription: string;
  status: "draft" | "published";
  isSystem: boolean;
}

export const EMPTY_PAGE: PageFormValues = {
  slug: "",
  title: "",
  body: "",
  seoTitle: "",
  seoDescription: "",
  status: "draft",
  isSystem: false,
};

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function PageForm({ initial }: { initial: PageFormValues }) {
  const router = useRouter();
  const { pending, error, fieldErrors, runAction } = useAction();
  const [form, setForm] = useState(initial);
  const [slugTouched, setSlugTouched] = useState(Boolean(initial.id));

  function set<K extends keyof PageFormValues>(key: K, value: PageFormValues[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    runAction(() => savePageAction(form), {
      success: form.id ? "Page saved" : "Page created",
      refresh: false,
      onDone: (data) => {
        router.push(`/admin/content/pages/${data.id}`);
        router.refresh();
      },
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="space-y-3">
        <ErrorNote message={error} />

        <section className="a-card space-y-3 p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="p-title" className="a-label">
                Title
              </label>
              <input
                id="p-title"
                className="a-input"
                value={form.title}
                onChange={(e) => {
                  set("title", e.target.value);
                  if (!slugTouched) set("slug", slugify(e.target.value));
                }}
              />
              {fieldErrors.title ? <p className="a-err">{fieldErrors.title}</p> : null}
            </div>
            <div>
              <label htmlFor="p-slug" className="a-label">
                Slug
              </label>
              <input
                id="p-slug"
                className="a-input"
                value={form.slug}
                disabled={form.isSystem}
                onChange={(e) => {
                  setSlugTouched(true);
                  set("slug", e.target.value);
                }}
              />
              <p className="a-hint">
                {form.isSystem
                  ? "This page backs a fixed storefront route, so the slug is locked."
                  : `Lives at /${form.slug || "slug"}`}
              </p>
              {fieldErrors.slug ? <p className="a-err">{fieldErrors.slug}</p> : null}
            </div>
          </div>

          <div>
            <span className="a-label">Body</span>
            <RichTextEditor id="p-body" value={form.body} onChange={(body) => set("body", body)} />
          </div>
        </section>

        <section className="a-card space-y-3 p-3">
          <h2>Search listing</h2>
          <div>
            <label htmlFor="p-seo-title" className="a-label">
              SEO title
            </label>
            <input id="p-seo-title" className="a-input" value={form.seoTitle} onChange={(e) => set("seoTitle", e.target.value)} />
          </div>
          <div>
            <label htmlFor="p-seo-desc" className="a-label">
              SEO description
            </label>
            <textarea
              id="p-seo-desc"
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
          <h2>Publishing</h2>
          <select
            className="a-select"
            aria-label="Page status"
            value={form.status}
            onChange={(e) => set("status", e.target.value as PageFormValues["status"])}
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
          <button type="submit" className="a-btn a-btn-primary w-full" disabled={pending}>
            {pending ? "Saving…" : form.id ? "Save page" : "Create page"}
          </button>
          {form.id && form.status === "published" ? (
            <a href={`/${form.slug}`} target="_blank" rel="noopener" className="a-btn a-btn-xs w-full">
              View on the storefront &nearr;
            </a>
          ) : null}
        </section>

        {form.id && !form.isSystem ? (
          <section className="a-card p-3">
            <h2 className="mb-1">Danger zone</h2>
            <p className="a-hint mb-2">Deleting hides the page. Nothing is erased.</p>
            <ConfirmButton
              className="a-btn a-btn-xs a-btn-danger w-full"
              confirmLabel="Yes, delete this page"
              disabled={pending}
              onConfirm={() =>
                runAction(() => deletePageAction(form.id!), {
                  success: "Page deleted",
                  refresh: false,
                  onDone: () => router.push("/admin/content/pages"),
                })
              }
            >
              Delete page
            </ConfirmButton>
          </section>
        ) : null}
      </div>
    </form>
  );
}
