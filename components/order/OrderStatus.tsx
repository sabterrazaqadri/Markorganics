import type { OrderStatus as Status } from "@/lib/db/schema";

const STEPS: { key: Status; label: string; note: string }[] = [
  { key: "pending", label: "Placed", note: "We have your order and will call to confirm." },
  { key: "confirmed", label: "Confirmed", note: "Confirmed by phone and being packed." },
  { key: "shipped", label: "Shipped", note: "Handed to the courier." },
  { key: "delivered", label: "Delivered", note: "Delivered and paid." },
];

export const STATUS_LABEL: Record<Status, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  returned: "Returned",
};

export const STATUS_CLASS: Record<Status, string> = {
  pending: "bg-band-oil/15 text-band-oil-ink",
  confirmed: "bg-band-home/15 text-band-home",
  shipped: "bg-band-home/15 text-band-home",
  delivered: "bg-band-care/15 text-band-care",
  cancelled: "bg-danger/10 text-danger",
  returned: "bg-danger/10 text-danger",
};

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${STATUS_CLASS[status]}`}>{STATUS_LABEL[status]}</span>
  );
}

export function OrderTimeline({ status }: { status: Status }) {
  const terminal = status === "cancelled" || status === "returned";
  const currentIndex = STEPS.findIndex((s) => s.key === status);

  return (
    <div>
      {terminal ? (
        <p className="rounded border border-danger/30 bg-white px-4 py-3 text-sm">
          This order was <strong>{STATUS_LABEL[status].toLowerCase()}</strong>.{" "}
          {status === "cancelled"
            ? "If you did not ask for this, message us on WhatsApp and we will sort it out."
            : "Thanks for sending it back. Contact us if you have any questions."}
        </p>
      ) : null}
      <ol className={`mt-4 grid gap-3 sm:grid-cols-4 ${terminal ? "opacity-60" : ""}`} aria-label="Order progress">
        {STEPS.map((step, i) => {
          const done = !terminal && i <= currentIndex;
          const active = !terminal && i === currentIndex;
          return (
            <li key={step.key} className="flex gap-3 sm:block">
              <div className="flex items-center sm:mb-2">
                <span
                  aria-hidden="true"
                  className={`inline-block h-3 w-3 rounded-full ${done ? "bg-band-care" : "border border-rule bg-white"}`}
                />
                <span className="ml-3 h-px flex-1 bg-rule sm:ml-2" />
              </div>
              <div>
                <p className={`text-sm font-semibold ${done ? "" : "text-ink-soft"}`}>
                  {step.label}
                  {active ? <span className="sr-only"> (current)</span> : null}
                </p>
                <p className="text-xs text-ink-soft">{step.note}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
