"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { OrderRow } from "@/lib/queries/orders";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/db/schema";
import { displayPkPhone } from "@/lib/phone";
import { formatPKR } from "@/lib/money";
import { DateCell, ORDER_STATUS_LABEL, OrderStatusPill } from "./ui";
import { ConfirmButton, ErrorNote, Modal, useAction, useRowSelection } from "./client-ui";
import { bulkOrderAction } from "@/app/admin/(panel)/orders/actions";
import { bulkBookAction } from "@/app/admin/(panel)/orders/courier-actions";

export interface CourierChoice {
  id: string;
  name: string;
  verified: boolean;
}

export function OrdersTable({
  rows,
  canWrite,
  couriers = [],
  defaultCourier = "",
}: {
  rows: OrderRow[];
  canWrite: boolean;
  couriers?: CourierChoice[];
  defaultCourier?: string;
}) {
  const ids = useMemo(() => rows.map((r) => r.id), [rows]);
  const selection = useRowSelection(ids);
  const { pending, error, runAction, show } = useAction();
  const [modal, setModal] = useState<null | "status" | "tag" | "untag" | "book">(null);
  const [status, setStatus] = useState<OrderStatus>("confirmed");
  const [tag, setTag] = useState("");
  const [note, setNote] = useState("");
  const [provider, setProvider] = useState(defaultCourier || couriers[0]?.id || "");
  const [pickup, setPickup] = useState("");

  /* Bulk booking is queued rather than run inline: forty courier calls in one
     request is how a page times out halfway with nobody sure what got booked. */
  function submitBooking() {
    runAction(
      () => bulkBookAction({ ids: selection.ids, provider, pickupAddressCode: pickup || undefined }),
      {
        onDone: (data) => {
          setModal(null);
          selection.clear();
          show(
            data.unmappedCities.length
              ? `${data.queued} queued. Watch out: ${data.unmappedCities.slice(0, 4).join(", ")} ${data.unmappedCities.length > 4 ? "and others are" : "are"} not mapped for this courier.`
              : `${data.queued} booking${data.queued === 1 ? "" : "s"} queued. Track them on the jobs page.`,
          );
        },
      },
    );
  }

  function submit() {
    const action = modal;
    if (!action || action === "book") return;
    runAction(
      () =>
        bulkOrderAction({
          ids: selection.ids,
          action,
          status: action === "status" ? status : undefined,
          tag: action === "status" ? undefined : tag,
          note: note || undefined,
        }),
      {
        success: "Applied",
        onDone: () => {
          setModal(null);
          setNote("");
          selection.clear();
        },
      },
    );
  }

  return (
    <>
      <ErrorNote message={error} />

      {canWrite && selection.count > 0 ? (
        <div
          role="region"
          aria-label="Bulk actions"
          className="mb-2 flex flex-wrap items-center gap-2 rounded border border-[var(--a-border)] bg-[var(--a-info-bg)] px-2.5 py-1.5"
        >
          <strong className="text-[12px]">{selection.count} selected</strong>
          <button type="button" className="a-btn a-btn-xs" onClick={() => setModal("status")}>
            Change status
          </button>
          {couriers.length ? (
            <button type="button" className="a-btn a-btn-xs" onClick={() => setModal("book")}>
              Book with courier
            </button>
          ) : null}
          <button type="button" className="a-btn a-btn-xs" onClick={() => setModal("tag")}>
            Add tag
          </button>
          <button type="button" className="a-btn a-btn-xs" onClick={() => setModal("untag")}>
            Remove tag
          </button>
          <a
            className="a-btn a-btn-xs"
            href={`/api/admin/orders/export?ids=${selection.ids.join(",")}`}
            download
          >
            Export selected
          </a>
          <a
            className="a-btn a-btn-xs"
            href={`/admin/orders/print?ids=${selection.ids.join(",")}`}
            target="_blank"
            rel="noopener"
          >
            Print packing slips
          </a>
          <button type="button" className="a-btn-link ml-auto" onClick={selection.clear}>
            Clear selection
          </button>
        </div>
      ) : null}

      <div className="a-card a-scroll">
        <table className="a-table">
          <thead>
            <tr>
              {canWrite ? (
                <th style={{ width: 30 }}>
                  <input
                    type="checkbox"
                    aria-label="Select all orders on this page"
                    checked={selection.allSelected}
                    onChange={selection.toggleAll}
                  />
                </th>
              ) : null}
              <th>Order</th>
              <th>Customer</th>
              <th>City</th>
              <th>Tags</th>
              <th className="a-num">Items</th>
              <th className="a-num">Total</th>
              <th>Status</th>
              <th>Staff</th>
              <th>Placed</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const risky = (row.riskBad ?? 0) >= 2;
              return (
                <tr key={row.id} data-selected={selection.isSelected(row.id) || undefined}>
                  {canWrite ? (
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Select order ${row.orderNumber}`}
                        checked={selection.isSelected(row.id)}
                        onChange={() => selection.toggle(row.id)}
                      />
                    </td>
                  ) : null}
                  <td>
                    <Link href={`/admin/orders/${row.id}`} prefetch={false} className="font-semibold text-[var(--a-info)] hover:underline">
                      {row.orderNumber}
                    </Link>
                  </td>
                  <td>
                    <span className="block max-w-[180px] truncate">{row.customerName}</span>
                    <span className="block text-[11.5px] text-[var(--a-soft)]">
                      {displayPkPhone(row.phone)}
                      {risky ? (
                        <span className="a-badge a-badge-danger ml-1.5" title="Repeated refusals or returns">
                          risk
                        </span>
                      ) : null}
                    </span>
                  </td>
                  <td className="max-w-[120px] truncate">{row.city}</td>
                  <td>
                    <span className="flex flex-wrap gap-1">
                      {row.tags.slice(0, 3).map((t) => (
                        <span key={t} className="a-tag">
                          {t}
                        </span>
                      ))}
                      {row.tags.length > 3 ? <span className="text-[11px] text-[var(--a-soft)]">+{row.tags.length - 3}</span> : null}
                    </span>
                  </td>
                  <td className="a-num">{row.itemCount}</td>
                  <td className="a-num">
                    {formatPKR(row.totalPaisa)}
                    {row.discountPaisa > 0 ? (
                      <span className="block text-[11px] text-[var(--a-ok)]">-{formatPKR(row.discountPaisa)}</span>
                    ) : null}
                  </td>
                  <td>
                    <OrderStatusPill status={row.status} />
                  </td>
                  <td className="max-w-[110px] truncate text-[var(--a-soft)]">{row.actorName ?? "—"}</td>
                  <td>
                    <DateCell value={row.createdAt} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal
        open={modal !== null}
        onClose={() => setModal(null)}
        title={
          modal === "status"
            ? "Change status"
            : modal === "book"
              ? "Book with a courier"
              : modal === "tag"
                ? "Add a tag"
                : "Remove a tag"
        }
      >
        <ErrorNote message={error} />
        <p className="mb-2 text-[12px] text-[var(--a-soft)]">Applies to {selection.count} selected orders.</p>
        {modal === "book" ? (
          <>
            <label htmlFor="bulk-courier" className="a-label">
              Courier
            </label>
            <select id="bulk-courier" className="a-select" value={provider} onChange={(e) => setProvider(e.target.value)}>
              {couriers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.verified ? "" : " (unverified)"}
                </option>
              ))}
            </select>
            <label htmlFor="bulk-pickup" className="a-label mt-2">
              Pickup address code (optional)
            </label>
            <input
              id="bulk-pickup"
              className="a-input"
              value={pickup}
              onChange={(e) => setPickup(e.target.value)}
              placeholder="Leave blank to use the courier default"
            />
            <p className="a-hint">
              Each booking runs as its own job, so one refusal does not stop the rest. Cities without a mapping are
              reported back before anything is sent.
            </p>
          </>
        ) : modal === "status" ? (
          <>
            <label htmlFor="bulk-status" className="a-label">
              New status
            </label>
            <select id="bulk-status" className="a-select" value={status} onChange={(e) => setStatus(e.target.value as OrderStatus)}>
              {ORDER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {ORDER_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
            <label htmlFor="bulk-note" className="a-label mt-2">
              Note for each timeline (optional)
            </label>
            <input id="bulk-note" className="a-input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
            {status === "cancelled" || status === "returned" ? (
              <p className="a-hint">Stock for every item on these orders will be added back.</p>
            ) : null}
          </>
        ) : (
          <>
            <label htmlFor="bulk-tag" className="a-label">
              Tag
            </label>
            <input id="bulk-tag" className="a-input" value={tag} onChange={(e) => setTag(e.target.value)} maxLength={40} autoFocus />
          </>
        )}
        <div className="mt-3 flex justify-end gap-2">
          <button type="button" className="a-btn" onClick={() => setModal(null)}>
            Cancel
          </button>
          {modal === "book" ? (
            <button type="button" className="a-btn a-btn-primary" onClick={submitBooking} disabled={pending || !provider}>
              {pending ? "Queueing…" : `Queue ${selection.count} booking${selection.count === 1 ? "" : "s"}`}
            </button>
          ) : modal === "status" && (status === "cancelled" || status === "returned") ? (
            <ConfirmButton
              className="a-btn a-btn-primary"
              confirmLabel={`Yes, ${ORDER_STATUS_LABEL[status].toLowerCase()} ${selection.count}`}
              onConfirm={submit}
              disabled={pending}
            >
              Apply
            </ConfirmButton>
          ) : (
            <button type="button" className="a-btn a-btn-primary" onClick={submit} disabled={pending}>
              {pending ? "Applying…" : "Apply"}
            </button>
          )}
        </div>
      </Modal>
    </>
  );
}
