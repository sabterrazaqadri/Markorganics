"use client";

import { useState } from "react";
import { ORDER_STATUS_LABEL, formatPkDateTime } from "./ui";
import { Card } from "./ui";
import { ErrorNote, useAction } from "./client-ui";
import { addTimelineNoteAction } from "@/app/admin/(panel)/orders/actions";
import type { OrderStatus } from "@/lib/db/schema";

export interface TimelineEvent {
  id: string;
  type: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus | null;
  message: string | null;
  note: string | null;
  userName: string | null;
  createdAt: string;
}

const TYPE_LABEL: Record<string, string> = {
  created: "Created",
  status: "Status",
  note: "Note",
  edit: "Edit",
  tag: "Tags",
  discount: "Discount",
  customer: "Customer",
};

function describe(event: TimelineEvent): string {
  if (event.message) return event.message;
  if (event.toStatus) {
    return event.fromStatus
      ? `${ORDER_STATUS_LABEL[event.fromStatus]} → ${ORDER_STATUS_LABEL[event.toStatus]}`
      : ORDER_STATUS_LABEL[event.toStatus];
  }
  return "Updated";
}

/** Everything that ever happened to this order, newest last. */
export function OrderTimeline({
  orderId,
  events,
  canWrite,
}: {
  orderId: string;
  events: TimelineEvent[];
  canWrite: boolean;
}) {
  const { pending, error, runAction } = useAction();
  const [draft, setDraft] = useState("");

  return (
    <Card title="Timeline">
      <div className="p-3">
        <ErrorNote message={error} />
        {events.length === 0 ? (
          <p className="text-[12px] text-[var(--a-soft)]">Nothing recorded yet.</p>
        ) : (
          <ol className="space-y-0">
            {events.map((event, i) => (
              <li key={event.id} className="relative flex gap-3 pb-3">
                <span className="mt-1.5 flex-none">
                  <span className="block h-2 w-2 rounded-full bg-[var(--a-border-strong)]" aria-hidden="true" />
                  {i < events.length - 1 ? (
                    <span className="absolute left-[3px] top-4 h-[calc(100%-14px)] w-px bg-[var(--a-border)]" aria-hidden="true" />
                  ) : null}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px]">
                    <span className="a-badge a-badge-neutral mr-1.5">{TYPE_LABEL[event.type] ?? event.type}</span>
                    {describe(event)}
                  </p>
                  {event.note ? <p className="text-[11.5px] text-[var(--a-soft)]">{event.note}</p> : null}
                  <p className="text-[11px] text-[var(--a-soft)]">
                    {event.userName ?? "System"} &middot; {formatPkDateTime(event.createdAt)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}

        {canWrite ? (
          <div className="mt-2 flex gap-2 border-t border-[var(--a-border)] pt-3">
            <input
              className="a-input"
              value={draft}
              maxLength={500}
              placeholder="Add a note to the timeline"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && draft.trim()) {
                  e.preventDefault();
                  runAction(() => addTimelineNoteAction(orderId, draft), {
                    success: "Note added",
                    onDone: () => setDraft(""),
                  });
                }
              }}
            />
            <button
              type="button"
              className="a-btn"
              disabled={pending || !draft.trim()}
              onClick={() =>
                runAction(() => addTimelineNoteAction(orderId, draft), {
                  success: "Note added",
                  onDone: () => setDraft(""),
                })
              }
            >
              Add
            </button>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
