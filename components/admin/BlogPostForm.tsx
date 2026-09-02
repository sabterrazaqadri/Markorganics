"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ConfirmButton, ErrorNote, TagInput, useAction } from "./client-ui";
import { MediaPicker } from "./MediaPicker";
import { RichTextEditor } from "./RichTextEditor";
import { deletePostAction, savePostAction } from "@/app/admin/(panel)/content/actions";

export interface PostFormValues {
  id?: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  coverImage: string;
  authorName: string;
  tags: string[];
  status: "draft" | "published";
  seoTitle: string;
  seoDescription: string;
  /** Local datetime-local value in Asia/Karachi. */
  publishedAt: string;
}

export const EMPTY_POST: PostFormValues = {
  slug: "",
  title: "",
  excerpt: "",
  body: "",
  coverImage: "",
  authorName: "",
  tags: [],
  status: "draft",
  seoTitle: "",
  seoDescription: "",
  publishedAt: "",
};

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function BlogPostForm({ initial }: { initial: PostFormValues }) {
  const router = useRouter();
  const { pending, error, fieldErrors, runAction } = useAction();
  const [form, setForm] = useState(initial);
  const [slugTouched, setSlugTouched] = useState(Boolean(initial.id));
  const [picking, setPicking] = useState(false);

  function set<K extends keyof PostFormValues>(key: K, value: PostFormValues[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const scheduled =
    form.status === "published" && form.publishedAt && new Date(`${form.publishedAt}:00+05:00`) > new Date();

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    runAction(() => savePostAction({ ...form, tags: form.tags.join(", ") }), {
      success: form.id ? "Post saved" : "Post created",
      refresh: false,
      onDone: (data) => {
        router.push(`/admin/content/blog/${data.id}`);
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
              <label htmlFor="b-title" className="a-label">
                Title
              </label>
              <input
                id="b-title"
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
              <label htmlFor="b-slug" className="a-label">
                Slug
              </label>
              <input
                id="b-slug"
                className="a-input"
                value={form.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  set("slug", e.target.value);
                }}
              />
              <p className="a-hint">Lives at /blog/{form.slug || "slug"}</p>
              {fieldErrors.slug ? <p className="a-err">{fieldErrors.slug}</p> : null}
            </div>
          </div>

          <div>
            <label htmlFor="b-excerpt" className="a-label">
              Excerpt
            </label>
            <textarea
              id="b-excerpt"
              className="a-textarea"
              maxLength={400}
              value={form.excerpt}
              onChange={(e) => set("excerpt", e.target.value)}
            />
            <p className="a-hint">Shown on the blog index. Left blank, the first lines of the body are used.</p>
          </div>

          <div>
            <span className="a-label">Body</span>
            <RichTextEditor id="b-body" value={form.body} onChange={(body) => set("body", body)} rows={20} />
          </div>
        </section>

        <section className="a-card space-y-3 p-3">
          <h2>Search listing</h2>
          <div>
            <label htmlFor="b-seo-title" className="a-label">
              SEO title
            </label>
            <input id="b-seo-title" className="a-input" value={form.seoTitle} onChange={(e) => set("seoTitle", e.target.value)} />
          </div>
          <div>
            <label htmlFor="b-seo-desc" className="a-label">
              SEO description
            </label>
            <textarea
              id="b-seo-desc"
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
            aria-label="Post status"
            value={form.status}
            onChange={(e) => set("status", e.target.value as PostFormValues["status"])}
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
          <div>
            <label htmlFor="b-published" className="a-label">
              Publish date and time
            </label>
            <input
              id="b-published"
              className="a-input"
              type="datetime-local"
              value={form.publishedAt}
              onChange={(e) => set("publishedAt", e.target.value)}
            />
            <p className="a-hint">
              {scheduled
                ? "In the future, so the post stays hidden until then. No cron job needed."
                : "Asia/Karachi. Leave blank to publish now."}
            </p>
          </div>
          <button type="submit" className="a-btn a-btn-primary w-full" disabled={pending}>
            {pending ? "Saving…" : form.id ? "Save post" : "Create post"}
          </button>
          {form.id && form.status === "published" && !scheduled ? (
            <a href={`/blog/${form.slug}`} target="_blank" rel="noopener" className="a-btn a-btn-xs w-full">
              View on the storefront &nearr;
            </a>
          ) : null}
        </section>

        <section className="a-card space-y-2 p-3">
          <h2>Details</h2>
          <div>
            <label htmlFor="b-author" className="a-label">
              Author
            </label>
            <input id="b-author" className="a-input" value={form.authorName} onChange={(e) => set("authorName", e.target.value)} />
          </div>
          <div>
            <span className="a-label">Tags</span>
            <TagInput value={form.tags} onChange={(tags) => set("tags", tags)} />
          </div>
        </section>

        <section className="a-card p-3">
          <div className="mb-2 flex items-center justify-between">
            <h2>Cover image</h2>
            <button type="button" className="a-btn a-btn-xs" onClick={() => setPicking(true)}>
              Choose
            </button>
          </div>
          {form.coverImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={form.coverImage} alt="" className="mb-2 w-full rounded border border-[var(--a-border)] object-contain" />
          ) : null}
          <input
            className="a-input"
            aria-label="Cover image path"
            value={form.coverImage}
            onChange={(e) => set("coverImage", e.target.value)}
          />
          <MediaPicker
            open={picking}
            onClose={() => setPicking(false)}
            onPick={(url) => {
              set("coverImage", url);
              setPicking(false);
            }}
          />
        </section>

        {form.id ? (
          <section className="a-card p-3">
            <h2 className="mb-1">Danger zone</h2>
            <ConfirmButton
              className="a-btn a-btn-xs a-btn-danger w-full"
              confirmLabel="Yes, delete this post"
              disabled={pending}
              onConfirm={() =>
                runAction(() => deletePostAction(form.id!), {
                  success: "Post deleted",
                  refresh: false,
                  onDone: () => router.push("/admin/content/blog"),
                })
              }
            >
              Delete post
            </ConfirmButton>
          </section>
        ) : null}
      </div>
    </form>
  );
}
