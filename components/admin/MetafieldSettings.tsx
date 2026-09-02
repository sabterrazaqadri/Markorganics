"use client";

import { useState } from "react";
import { METAFIELD_TYPES, type MetafieldType } from "@/lib/db/schema";
import { Card } from "./ui";
import { ConfirmButton, ErrorNote, Modal, useAction } from "./client-ui";
import { deleteMetafieldAction, saveMetafieldAction } from "@/app/admin/(panel)/settings/actions";

export interface MetafieldRow {
  id: string;
  key: string;
  name: string;
  type: MetafieldType;
  description: string;
}

const TYPE_LABEL: Record<MetafieldType, string> = {
  text: "Text",
  number: "Number",
  rich_text: "Rich text",
  boolean: "True or false",
  file: "File path",
};

const EMPTY: Omit<MetafieldRow, "id"> & { id?: string } = {
  key: "",
  name: "",
  type: "text",
  description: "",
};

/** Extra product fields without a schema change — shelf life, certification. */
export function MetafieldSettings({ rows, canWrite }: { rows: MetafieldRow[]; canWrite: boolean }) {
  const { pending, error, fieldErrors, runAction } = useAction();
  const [editing, setEditing] = useState<(typeof EMPTY) | null>(null);

  return (
    <>
      <Card
        title="Product metafields"
        actions={
          canWrite ? (
            <button type="button" className="a-btn a-btn-xs" onClick={() => setEditing({ ...EMPTY })}>
              New definition
            </button>
          ) : null
        }
      >
        <ErrorNote message={error} />
        {rows.length === 0 ? (
          <p className="p-3 text-[12px] text-[var(--a-soft)]">
            No metafields yet. Define one and it appears on every product editor.
          </p>
        ) : (
          <table className="a-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Key</th>
                <th>Type</th>
                <th>Description</th>
                {canWrite ? <th style={{ width: 130 }} /> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="font-medium">{row.name}</td>
                  <td className="a-mono text-[var(--a-soft)]">{row.key}</td>
                  <td>{TYPE_LABEL[row.type]}</td>
                  <td className="max-w-[280px] truncate text-[var(--a-soft)]">{row.description || "—"}</td>
                  {canWrite ? (
                    <td>
                      <span className="flex gap-2">
                        <button type="button" className="a-btn-link" onClick={() => setEditing(row)}>
                          Edit
                        </button>
                        <ConfirmButton
                          className="a-btn-link text-[var(--a-danger)]"
                          confirmLabel="Sure?"
                          disabled={pending}
                          onConfirm={() => runAction(() => deleteMetafieldAction(row.id), { success: "Definition removed" })}
                        >
                          Delete
                        </ConfirmButton>
                      </span>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="a-hint p-3">
          Values live on each product. Deleting a definition hides it; the stored values stay in the database.
        </p>
      </Card>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.id ? "Edit metafield" : "New metafield"}
        width={460}
      >
        {editing ? (
          <>
            <ErrorNote message={error} />
            <div className="space-y-2">
              <div>
                <label htmlFor="mf-name" className="a-label">
                  Name
                </label>
                <input
                  id="mf-name"
                  className="a-input"
                  autoFocus
                  value={editing.name}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      name: e.target.value,
                      key: editing.id ? editing.key : e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, ""),
                    })
                  }
                />
                {fieldErrors.name ? <p className="a-err">{fieldErrors.name}</p> : null}
              </div>
              <div>
                <label htmlFor="mf-key" className="a-label">
                  Key
                </label>
                <input id="mf-key" className="a-input a-mono" value={editing.key} onChange={(e) => setEditing({ ...editing, key: e.target.value })} />
                {fieldErrors.key ? <p className="a-err">{fieldErrors.key}</p> : null}
              </div>
              <div>
                <label htmlFor="mf-type" className="a-label">
                  Type
                </label>
                <select
                  id="mf-type"
                  className="a-select"
                  value={editing.type}
                  onChange={(e) => setEditing({ ...editing, type: e.target.value as MetafieldType })}
                >
                  {METAFIELD_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {TYPE_LABEL[t]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="mf-desc" className="a-label">
                  Description
                </label>
                <input
                  id="mf-desc"
                  className="a-input"
                  value={editing.description}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                />
              </div>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" className="a-btn" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="a-btn a-btn-primary"
                disabled={pending}
                onClick={() =>
                  runAction(() => saveMetafieldAction(editing), {
                    success: "Metafield saved",
                    onDone: () => setEditing(null),
                  })
                }
              >
                {pending ? "Saving…" : "Save"}
              </button>
            </div>
          </>
        ) : null}
      </Modal>
    </>
  );
}
