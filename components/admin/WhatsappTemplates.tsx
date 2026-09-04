"use client";

import { useState } from "react";
import { WHATSAPP_TRIGGERS, WHATSAPP_TRIGGER_LABEL } from "@/config/whatsapp";
import { Card, EmptyState } from "./ui";
import { ConfirmButton, ErrorNote, useAction } from "./client-ui";
import {
  deleteWhatsappTemplateAction,
  saveWhatsappTemplateAction,
  seedWhatsappTemplatesAction,
} from "@/app/admin/(panel)/integrations/actions";

export interface TemplateView {
  id: string;
  name: string;
  language: string;
  category: string;
  body: string;
  variables: string[];
  approvalStatus: string;
  trigger: string | null;
  isEnabled: boolean;
}

const CATEGORIES = ["utility", "marketing", "authentication", "service"] as const;
const APPROVALS = ["local", "pending", "approved", "rejected"] as const;

const APPROVAL_BADGE: Record<string, string> = {
  approved: "a-badge-ok",
  pending: "a-badge-warn",
  rejected: "a-badge-danger",
  local: "a-badge-neutral",
};

/**
 * Templates are authored and approved in Meta's Business Manager. This table
 * mirrors them so the app knows what it is allowed to send — editing the body
 * here changes what MARK renders in its own logs and previews, not what Meta
 * actually delivers.
 */
export function WhatsappTemplates({ rows, canWrite }: { rows: TemplateView[]; canWrite: boolean }) {
  const { pending, error, runAction, show } = useAction();
  const [editing, setEditing] = useState<TemplateView | null>(null);

  const blank: TemplateView = {
    id: "",
    name: "",
    language: "en",
    category: "utility",
    body: "",
    variables: [],
    approvalStatus: "local",
    trigger: null,
    isEnabled: false,
  };

  return (
    <div className="space-y-3">
      <ErrorNote message={error} />

      <p className="rounded border border-[var(--a-border)] bg-[var(--a-warn-bg)] px-2.5 py-2 text-[12px] text-[var(--a-warn)]">
        <strong>Approval happens in Meta, not here.</strong> Submit each template in Business Manager, then set its
        status to Approved on this page. MARK refuses to send anything that is not marked approved.
      </p>

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            title="No templates yet"
            action={
              canWrite ? (
                <button
                  type="button"
                  className="a-btn a-btn-primary a-btn-xs"
                  disabled={pending}
                  onClick={() =>
                    runAction(() => seedWhatsappTemplatesAction(), {
                      onDone: (data) => show(`${data.created} template${data.created === 1 ? "" : "s"} created`),
                    })
                  }
                >
                  Create the six lifecycle templates
                </button>
              ) : null
            }
          >
            Start from the standard six — order placed, confirmed, shipped, out for delivery, delivered and the
            abandoned-cart follow-up — then submit that exact wording to Meta for approval.
          </EmptyState>
        </Card>
      ) : (
        <Card
          title={`Templates (${rows.length})`}
          actions={
            canWrite ? (
              <button type="button" className="a-btn a-btn-xs" onClick={() => setEditing(blank)}>
                Add a template
              </button>
            ) : null
          }
        >
          <div className="a-scroll">
            <table className="a-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Trigger</th>
                  <th>Category</th>
                  <th>Approval</th>
                  <th>Enabled</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <span className="a-mono text-[11.5px]">{row.name}</span>
                      <div className="max-w-[380px] truncate text-[11px] text-[var(--a-soft)]">{row.body}</div>
                    </td>
                    <td className="text-[11.5px]">
                      {row.trigger ? (WHATSAPP_TRIGGER_LABEL[row.trigger as never] ?? row.trigger) : "Manual only"}
                    </td>
                    <td className="text-[11.5px]">{row.category}</td>
                    <td>
                      <span className={`a-badge ${APPROVAL_BADGE[row.approvalStatus] ?? "a-badge-neutral"}`}>
                        {row.approvalStatus}
                      </span>
                    </td>
                    <td className="text-[11.5px]">{row.isEnabled ? "Yes" : "No"}</td>
                    <td className="whitespace-nowrap">
                      {canWrite ? (
                        <>
                          <button type="button" className="a-btn a-btn-xs" onClick={() => setEditing(row)}>
                            Edit
                          </button>
                          <ConfirmButton
                            className="a-btn a-btn-xs a-btn-danger ml-1"
                            confirmLabel="Yes, delete"
                            disabled={pending}
                            onConfirm={() =>
                              runAction(() => deleteWhatsappTemplateAction(row.id), { success: "Template removed" })
                            }
                          >
                            Delete
                          </ConfirmButton>
                        </>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {editing ? (
        <Card title={editing.id ? `Edit ${editing.name}` : "New template"}>
          <div className="grid gap-3 p-3 sm:grid-cols-2">
            <div>
              <label htmlFor="t-name" className="a-label">
                Template name (exactly as in Meta)
              </label>
              <input
                id="t-name"
                className="a-input a-mono"
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="t-lang" className="a-label">
                Language code
              </label>
              <input
                id="t-lang"
                className="a-input"
                value={editing.language}
                onChange={(e) => setEditing({ ...editing, language: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="t-cat" className="a-label">
                Billing category
              </label>
              <select
                id="t-cat"
                className="a-select"
                value={editing.category}
                onChange={(e) => setEditing({ ...editing, category: e.target.value })}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <p className="a-hint">
                Meta bills by category, and the rates change on 1 October 2026. Utility is what order updates should be.
              </p>
            </div>
            <div>
              <label htmlFor="t-approval" className="a-label">
                Approval status in Meta
              </label>
              <select
                id="t-approval"
                className="a-select"
                value={editing.approvalStatus}
                onChange={(e) => setEditing({ ...editing, approvalStatus: e.target.value })}
              >
                {APPROVALS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="t-trigger" className="a-label">
                Sent on
              </label>
              <select
                id="t-trigger"
                className="a-select"
                value={editing.trigger ?? ""}
                onChange={(e) => setEditing({ ...editing, trigger: e.target.value || null })}
              >
                <option value="">Manual only</option>
                {WHATSAPP_TRIGGERS.map((t) => (
                  <option key={t} value={t}>
                    {WHATSAPP_TRIGGER_LABEL[t]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="t-vars" className="a-label">
                Variables, in order
              </label>
              <input
                id="t-vars"
                className="a-input a-mono"
                value={editing.variables.join(", ")}
                onChange={(e) => setEditing({ ...editing, variables: e.target.value.split(",").map((v) => v.trim()) })}
                placeholder="customer_name, order_number, order_total"
              />
              <p className="a-hint">
                Known names: customer_name, order_number, order_total, courier_name, tracking_number, tracking_url,
                city, cart_summary, cart_total, checkout_url.
              </p>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="t-body" className="a-label">
                Body, with {"{{1}}"} placeholders
              </label>
              <textarea
                id="t-body"
                className="a-textarea"
                rows={4}
                value={editing.body}
                onChange={(e) => setEditing({ ...editing, body: e.target.value })}
              />
            </div>
            <label className="flex items-center gap-2 text-[12.5px] sm:col-span-2">
              <input
                type="checkbox"
                checked={editing.isEnabled}
                onChange={(e) => setEditing({ ...editing, isEnabled: e.target.checked })}
              />
              Use this template for its trigger
            </label>
          </div>
          <div className="flex gap-2 border-t border-[var(--a-border)] p-3">
            <button
              type="button"
              className="a-btn a-btn-primary a-btn-xs"
              disabled={pending}
              onClick={() =>
                runAction(
                  () =>
                    saveWhatsappTemplateAction({
                      id: editing.id || undefined,
                      name: editing.name,
                      language: editing.language,
                      category: editing.category as (typeof CATEGORIES)[number],
                      body: editing.body,
                      variables: editing.variables.join(", "),
                      approvalStatus: editing.approvalStatus as (typeof APPROVALS)[number],
                      trigger: editing.trigger ?? "",
                      isEnabled: editing.isEnabled,
                    }),
                  { success: "Template saved", onDone: () => setEditing(null) },
                )
              }
            >
              {pending ? "Saving…" : "Save template"}
            </button>
            <button type="button" className="a-btn a-btn-xs" onClick={() => setEditing(null)}>
              Cancel
            </button>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
