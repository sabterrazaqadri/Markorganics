"use client";

import { useState, type FormEvent } from "react";
import { ErrorNote, Modal, useAction } from "./client-ui";
import { addReviewAction } from "@/app/admin/(panel)/reviews/actions";

/** Records a review a customer gave on WhatsApp or the phone. */
export function AddReviewForm({ products }: { products: { id: string; name: string }[] }) {
  const { pending, error, fieldErrors, runAction } = useAction();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    productId: products[0]?.id ?? "",
    name: "",
    phone: "",
    city: "",
    rating: "5",
    title: "",
    body: "",
    lang: "en",
    status: "approved",
  });

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    runAction(() => addReviewAction(form), {
      success: "Review added",
      onDone: () => {
        setOpen(false);
        setForm((f) => ({ ...f, name: "", phone: "", city: "", title: "", body: "" }));
      },
    });
  }

  return (
    <>
      <button type="button" className="a-btn a-btn-primary a-btn-xs" onClick={() => setOpen(true)}>
        Add a review
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Add a review from WhatsApp or a call" width={560}>
        <form onSubmit={onSubmit} className="space-y-3">
          <ErrorNote message={error} />
          <p className="a-hint">
            Use the customer&apos;s own words. If the phone number matches a delivered order for the product, the review shows as a verified purchase.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="ar-product" className="a-label">
                Product
              </label>
              <select id="ar-product" className="a-select" value={form.productId} onChange={(e) => set("productId", e.target.value)}>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="ar-name" className="a-label">
                Customer name
              </label>
              <input id="ar-name" className="a-input" value={form.name} onChange={(e) => set("name", e.target.value)} />
              {fieldErrors.name ? <p className="a-err">{fieldErrors.name}</p> : null}
            </div>
            <div>
              <label htmlFor="ar-phone" className="a-label">
                Phone (optional)
              </label>
              <input id="ar-phone" className="a-input" value={form.phone} placeholder="0300 1234567" onChange={(e) => set("phone", e.target.value)} />
            </div>
            <div>
              <label htmlFor="ar-city" className="a-label">
                City
              </label>
              <input id="ar-city" className="a-input" value={form.city} onChange={(e) => set("city", e.target.value)} />
            </div>
            <div>
              <label htmlFor="ar-rating" className="a-label">
                Rating
              </label>
              <select id="ar-rating" className="a-select" value={form.rating} onChange={(e) => set("rating", e.target.value)}>
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {n} star{n === 1 ? "" : "s"}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="ar-lang" className="a-label">
                Language
              </label>
              <select id="ar-lang" className="a-select" value={form.lang} onChange={(e) => set("lang", e.target.value)}>
                <option value="en">English / Roman Urdu</option>
                <option value="ur">Urdu script</option>
              </select>
            </div>
            <div>
              <label htmlFor="ar-status" className="a-label">
                Status
              </label>
              <select id="ar-status" className="a-select" value={form.status} onChange={(e) => set("status", e.target.value)}>
                <option value="approved">Approved (live)</option>
                <option value="pending">Pending</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="ar-title" className="a-label">
                Title (optional)
              </label>
              <input id="ar-title" className="a-input" value={form.title} onChange={(e) => set("title", e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="ar-body" className="a-label">
                Review
              </label>
              <textarea id="ar-body" className="a-textarea min-h-24" dir={form.lang === "ur" ? "rtl" : "ltr"} value={form.body} onChange={(e) => set("body", e.target.value)} />
              {fieldErrors.body ? <p className="a-err">{fieldErrors.body}</p> : null}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="a-btn a-btn-xs" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="a-btn a-btn-primary a-btn-xs" disabled={pending}>
              {pending ? "Saving…" : "Save review"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
