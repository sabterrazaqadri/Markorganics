"use client";

import { useState, useTransition } from "react";
import { displayPkPhone } from "@/lib/phone";
import { ConfirmButton, ErrorNote, Modal, TagInput, useAction } from "./client-ui";
import { mergeCustomersAction, saveCustomerAction } from "@/app/admin/(panel)/customers/actions";
import { searchEverything } from "@/app/admin/(panel)/search-action";
import type { SearchHit } from "@/lib/admin/search";

export interface EditableCustomer {
  id: string;
  name: string;
  email: string;
  city: string;
  tags: string[];
  internalNote: string;
  phone: string;
}

export function CustomerEditor({ customer, canWrite }: { customer: EditableCustomer; canWrite: boolean }) {
  const { pending, error, fieldErrors, runAction } = useAction();
  const [form, setForm] = useState(customer);
  const [merging, setMerging] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [target, setTarget] = useState<SearchHit | null>(null);
  const [, startSearch] = useTransition();

  function set<K extends keyof EditableCustomer>(key: K, value: EditableCustomer[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const dirty = JSON.stringify(form) !== JSON.stringify(customer);

  return (
    <div className="space-y-3">
      <ErrorNote message={error} />

      <section className="a-card space-y-3 p-3">
        <h2>Details</h2>
        <div>
          <label htmlFor="cust-name" className="a-label">
            Name
          </label>
          <input id="cust-name" className="a-input" value={form.name} disabled={!canWrite} onChange={(e) => set("name", e.target.value)} />
          {fieldErrors.name ? <p className="a-err">{fieldErrors.name}</p> : null}
        </div>
        <div>
          <label htmlFor="cust-email" className="a-label">
            Email (optional)
          </label>
          <input
            id="cust-email"
            className="a-input"
            type="email"
            value={form.email}
            disabled={!canWrite}
            onChange={(e) => set("email", e.target.value)}
          />
          {fieldErrors.email ? <p className="a-err">{fieldErrors.email}</p> : null}
        </div>
        <div>
          <label htmlFor="cust-city" className="a-label">
            City
          </label>
          <input id="cust-city" className="a-input" value={form.city} disabled={!canWrite} onChange={(e) => set("city", e.target.value)} />
        </div>
        <div>
          <span className="a-label">Tags</span>
          <TagInput value={form.tags} onChange={(tags) => set("tags", tags)} />
        </div>
        <div>
          <label htmlFor="cust-note" className="a-label">
            Internal note
          </label>
          <textarea
            id="cust-note"
            className="a-textarea"
            value={form.internalNote}
            disabled={!canWrite}
            maxLength={2000}
            onChange={(e) => set("internalNote", e.target.value)}
          />
        </div>
        {canWrite ? (
          <button
            type="button"
            className="a-btn a-btn-primary w-full"
            disabled={pending || !dirty}
            onClick={() =>
              runAction(
                () =>
                  saveCustomerAction({
                    id: form.id,
                    name: form.name,
                    email: form.email,
                    city: form.city,
                    tags: form.tags.join(", "),
                    internalNote: form.internalNote,
                  }),
                { success: "Customer saved" },
              )
            }
          >
            {pending ? "Saving…" : "Save customer"}
          </button>
        ) : (
          <p className="a-hint">Your role can view customers but not edit them.</p>
        )}
      </section>

      {canWrite ? (
        <section className="a-card p-3">
          <h2 className="mb-1">Merge a duplicate</h2>
          <p className="a-hint mb-2">
            Moves every order from another record onto this one. Use it when the same person ordered from two numbers.
          </p>
          <button type="button" className="a-btn a-btn-xs w-full" onClick={() => setMerging(true)}>
            Find a record to merge in
          </button>
        </section>
      ) : null}

      <Modal open={merging} onClose={() => setMerging(false)} title="Merge into this customer" width={480}>
        <ErrorNote message={error} />
        <label htmlFor="merge-search" className="a-label">
          Search the customer to merge in
        </label>
        <input
          id="merge-search"
          className="a-input"
          autoFocus
          value={query}
          placeholder="Name or phone"
          onChange={(e) => {
            setQuery(e.target.value);
            setTarget(null);
            startSearch(async () => {
              const results = await searchEverything(e.target.value);
              setHits(results.filter((h) => h.kind === "customer" && h.id !== customer.id));
            });
          }}
        />
        <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto">
          {hits.map((hit) => (
            <li key={hit.id}>
              <button
                type="button"
                className={`w-full rounded border px-2 py-1.5 text-left text-[12.5px] ${
                  target?.id === hit.id ? "border-[var(--a-focus)] bg-[var(--a-info-bg)]" : "border-[var(--a-border)]"
                }`}
                onClick={() => setTarget(hit)}
              >
                <span className="block font-medium">{hit.title}</span>
                <span className="block text-[11.5px] text-[var(--a-soft)]">{hit.subtitle}</span>
              </button>
            </li>
          ))}
        </ul>
        {target ? (
          <p className="mt-2 rounded border border-[var(--a-border)] bg-[var(--a-warn-bg)] px-2 py-1.5 text-[11.5px] text-[var(--a-warn)]">
            Every order from <strong>{target.title}</strong> moves onto {form.name || displayPkPhone(form.phone)}. The old
            record is tombstoned, not deleted.
          </p>
        ) : null}
        <div className="mt-3 flex justify-end gap-2">
          <button type="button" className="a-btn" onClick={() => setMerging(false)}>
            Cancel
          </button>
          <ConfirmButton
            className="a-btn a-btn-primary"
            confirmLabel="Yes, merge them"
            disabled={pending || !target}
            onConfirm={() =>
              target
                ? runAction(() => mergeCustomersAction(target.id, customer.id), {
                    success: "Customers merged",
                    onDone: () => {
                      setMerging(false);
                      setTarget(null);
                      setQuery("");
                      setHits([]);
                    },
                  })
                : undefined
            }
          >
            Merge
          </ConfirmButton>
        </div>
      </Modal>
    </div>
  );
}
