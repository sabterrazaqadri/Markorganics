"use client";

import { useOptimistic, useState } from "react";
import { useRouter } from "next/navigation";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/db/schema";
import { ORDER_STATUS_LABEL, OrderStatusPill } from "./ui";
import { ConfirmButton, ErrorNote, TagInput, useAction } from "./client-ui";
import { changeStatusAction, deleteOrderAction, saveInternalNoteAction, setTagsAction } from "@/app/admin/(panel)/orders/actions";

/** Sensible next steps first; the rest stay reachable under "skip ahead". */
const NEXT: Record<OrderStatus, OrderStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["shipped", "cancelled"],
  shipped: ["delivered", "returned", "cancelled"],
  delivered: ["returned"],
  cancelled: ["pending"],
  returned: [],
};

export function OrderSidebar({
  orderId,
  status,
  internalNote,
  tags,
  addressText,
  canWrite,
  canDelete,
}: {
  orderId: string;
  status: OrderStatus;
  statusLabel: string;
  internalNote: string;
  tags: string[];
  addressText: string;
  canWrite: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const { pending, error, runAction, show, setError } = useAction();

  // Optimistic: the pill flips immediately and rolls back if the action fails.
  const [shownStatus, setShownStatus] = useOptimistic(status);
  const options = NEXT[status];
  const [target, setTarget] = useState<OrderStatus>(options[0] ?? status);
  const [eventNote, setEventNote] = useState("");
  const [note, setNote] = useState(internalNote);
  const [tagList, setTagList] = useState(tags);

  const restocking = (target === "cancelled" || target === "returned") && !["cancelled", "returned"].includes(status);

  function applyStatus() {
    runAction(
      async () => {
        setShownStatus(target);
        return changeStatusAction(orderId, target, eventNote || undefined);
      },
      { success: `Marked ${ORDER_STATUS_LABEL[target].toLowerCase()}`, onDone: () => setEventNote("") },
    );
  }

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(addressText);
      show("Address copied");
    } catch {
      setError("Could not copy. Select the address text and copy it by hand.");
    }
  }

  return (
    <div className="space-y-3">
      <ErrorNote message={error} />

      <section className="a-card p-3">
        <div className="mb-2 flex items-center justify-between">
          <h2>Status</h2>
          <OrderStatusPill status={shownStatus} />
        </div>
        {!canWrite ? (
          <p className="text-[12px] text-[var(--a-soft)]">Your role cannot change order status.</p>
        ) : options.length === 0 ? (
          <p className="text-[12px] text-[var(--a-soft)]">This order is closed.</p>
        ) : (
          <div className="space-y-2">
            <div>
              <label htmlFor="status-target" className="a-label">
                Move to
              </label>
              <select
                id="status-target"
                className="a-select"
                value={target}
                onChange={(e) => setTarget(e.target.value as OrderStatus)}
              >
                {options.map((s) => (
                  <option key={s} value={s}>
                    {ORDER_STATUS_LABEL[s]}
                  </option>
                ))}
                {ORDER_STATUSES.filter((s) => !options.includes(s) && s !== status).map((s) => (
                  <option key={s} value={s}>
                    {ORDER_STATUS_LABEL[s]} (skip ahead)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="event-note" className="a-label">
                Note for the timeline
              </label>
              <input
                id="event-note"
                className="a-input"
                value={eventNote}
                onChange={(e) => setEventNote(e.target.value)}
                placeholder="e.g. Leopards CN 12345"
                maxLength={300}
              />
            </div>
            {restocking ? (
              <ConfirmButton
                className="a-btn a-btn-primary w-full"
                confirmLabel={`Yes, ${ORDER_STATUS_LABEL[target].toLowerCase()} and restock`}
                onConfirm={applyStatus}
                disabled={pending}
              >
                Mark {ORDER_STATUS_LABEL[target].toLowerCase()}
              </ConfirmButton>
            ) : (
              <button type="button" className="a-btn a-btn-primary w-full" onClick={applyStatus} disabled={pending}>
                {pending ? "Saving…" : `Mark ${ORDER_STATUS_LABEL[target].toLowerCase()}`}
              </button>
            )}
            {restocking ? <p className="a-hint">Every item goes back on the shelf and the ledger records it.</p> : null}
          </div>
        )}
      </section>

      <section className="a-card p-3">
        <h2 className="mb-2">Tags</h2>
        <TagInput value={tagList} onChange={setTagList} placeholder="Add a tag, press Enter" />
        <button
          type="button"
          className="a-btn a-btn-xs mt-2"
          disabled={pending || !canWrite || tagList.join(",") === tags.join(",")}
          onClick={() => runAction(() => setTagsAction(orderId, tagList.join(", ")), { success: "Tags saved" })}
        >
          Save tags
        </button>
      </section>

      <section className="a-card p-3">
        <h2 className="mb-1">Internal note</h2>
        <p className="a-hint mb-2">Only visible here, never to the customer.</p>
        <textarea
          className="a-textarea"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={2000}
          disabled={!canWrite}
        />
        <button
          type="button"
          className="a-btn a-btn-xs mt-2"
          disabled={pending || !canWrite || note === internalNote}
          onClick={() => runAction(() => saveInternalNoteAction(orderId, note), { success: "Note saved" })}
        >
          Save note
        </button>
      </section>

      <section className="a-card p-3">
        <h2 className="mb-2">Courier</h2>
        <button type="button" className="a-btn a-btn-xs w-full" onClick={copyAddress}>
          Copy address block
        </button>
        <a
          href={`/admin/orders/${orderId}/print`}
          target="_blank"
          rel="noopener"
          className="a-btn a-btn-xs mt-2 w-full"
        >
          Print packing slip
        </a>
      </section>

      {canDelete ? (
        <section className="a-card p-3">
          <h2 className="mb-1">Danger zone</h2>
          <p className="a-hint mb-2">Deleting hides the order from every list. Nothing is erased.</p>
          <ConfirmButton
            className="a-btn a-btn-xs a-btn-danger w-full"
            confirmLabel="Yes, delete this order"
            disabled={pending}
            onConfirm={() =>
              runAction(() => deleteOrderAction(orderId), {
                success: "Order deleted",
                refresh: false,
                onDone: () => router.push("/admin/orders"),
              })
            }
          >
            Delete order
          </ConfirmButton>
        </section>
      ) : null}
    </div>
  );
}
