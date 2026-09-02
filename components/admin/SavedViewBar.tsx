"use client";

import Link from "next/link";
import { useState } from "react";
import type { SavedView } from "@/lib/db/schema";
import { deleteViewAction, saveViewAction } from "@/app/admin/(panel)/orders/actions";
import { ConfirmButton, ErrorNote, Modal, useAction } from "./client-ui";

/**
 * User-created saved filters, shown next to the fixed status tabs.
 * The whole query string is stored, so a view is just a bookmark with a name.
 */
export function SavedViewBar({
  resource,
  views,
  currentQuery,
}: {
  resource: "orders" | "products" | "customers";
  views: SavedView[];
  currentQuery: string;
}) {
  const { pending, error, runAction } = useAction();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  const base = `/admin/${resource}`;

  return (
    <div className="mb-3 flex flex-wrap items-center gap-1.5">
      <ErrorNote message={error} />
      {views.map((view) => (
        <span key={view.id} className="inline-flex items-center gap-1 rounded border border-[var(--a-border)] bg-white px-1.5 py-0.5">
          <Link href={view.query ? `${base}?${view.query}` : base} className="text-[11.5px] font-medium hover:underline">
            {view.name}
          </Link>
          <ConfirmButton
            className="a-btn-link text-[11px] text-[var(--a-soft)]"
            confirmLabel="Delete?"
            onConfirm={() => runAction(() => deleteViewAction(view.id, resource), { success: "View deleted" })}
            disabled={pending}
          >
            ×
          </ConfirmButton>
        </span>
      ))}
      <button type="button" className="a-btn-link text-[11.5px]" onClick={() => setOpen(true)}>
        Save this filter as a view
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Save view" width={400}>
        <ErrorNote message={error} />
        <p className="mb-2 text-[12px] text-[var(--a-soft)]">
          {currentQuery ? (
            <>
              Saves the current filter: <code className="a-mono">{currentQuery}</code>
            </>
          ) : (
            "No filters are set, so this view will show everything."
          )}
        </p>
        <label htmlFor="view-name" className="a-label">
          Name
        </label>
        <input
          id="view-name"
          className="a-input"
          value={name}
          maxLength={40}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && name.trim()) {
              e.preventDefault();
              runAction(() => saveViewAction({ resource, name, query: currentQuery }), {
                success: "View saved",
                onDone: () => {
                  setOpen(false);
                  setName("");
                },
              });
            }
          }}
        />
        <div className="mt-3 flex justify-end gap-2">
          <button type="button" className="a-btn" onClick={() => setOpen(false)}>
            Cancel
          </button>
          <button
            type="button"
            className="a-btn a-btn-primary"
            disabled={pending || !name.trim()}
            onClick={() =>
              runAction(() => saveViewAction({ resource, name, query: currentQuery }), {
                success: "View saved",
                onDone: () => {
                  setOpen(false);
                  setName("");
                },
              })
            }
          >
            {pending ? "Saving…" : "Save view"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
