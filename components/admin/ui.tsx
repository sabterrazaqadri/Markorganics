import Link from "next/link";
import type { ReactNode } from "react";
import type { OrderStatus, ProductStatus, UserRole } from "@/lib/db/schema";
import { ROLE_LABEL } from "@/lib/admin/permissions";
import { formatPKR } from "@/lib/money";

/* ------------------------------------------------------------- headings */

export function PageHeader({
  title,
  subtitle,
  actions,
  breadcrumb,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  breadcrumb?: { href: string; label: string };
}) {
  return (
    <div className="mb-4">
      {breadcrumb ? (
        <nav aria-label="Breadcrumb" className="mb-1 text-[11.5px]">
          <Link href={breadcrumb.href} className="text-[var(--a-soft)] hover:underline">
            &larr; {breadcrumb.label}
          </Link>
        </nav>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1>{title}</h1>
          {subtitle ? <p className="mt-0.5 text-[12px] text-[var(--a-soft)]">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- badges */

const ORDER_BADGE: Record<OrderStatus, string> = {
  pending: "a-badge-warn",
  confirmed: "a-badge-info",
  shipped: "a-badge-info",
  delivered: "a-badge-ok",
  cancelled: "a-badge-danger",
  returned: "a-badge-danger",
};

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  returned: "Returned",
};

export function OrderStatusPill({ status }: { status: OrderStatus }) {
  return <span className={`a-badge ${ORDER_BADGE[status]}`}>{ORDER_STATUS_LABEL[status]}</span>;
}

const PRODUCT_BADGE: Record<ProductStatus, string> = {
  active: "a-badge-ok",
  draft: "a-badge-neutral",
  archived: "a-badge-warn",
};

export const PRODUCT_STATUS_LABEL: Record<ProductStatus, string> = {
  active: "Active",
  draft: "Draft",
  archived: "Archived",
};

export function ProductStatusPill({ status }: { status: ProductStatus }) {
  return <span className={`a-badge ${PRODUCT_BADGE[status]}`}>{PRODUCT_STATUS_LABEL[status]}</span>;
}

export function RolePill({ role }: { role: UserRole }) {
  const cls = role === "owner" ? "a-badge-info" : role === "manager" ? "a-badge-neutral" : "a-badge-neutral";
  return <span className={`a-badge ${cls}`}>{ROLE_LABEL[role]}</span>;
}

export function FamilyDot({ family }: { family: string }) {
  return <span className={`a-dot a-dot-${family}`} aria-hidden="true" title={family} />;
}

export function Tag({ children }: { children: ReactNode }) {
  return <span className="a-tag">{children}</span>;
}

/* ----------------------------------------------------------- formatting */

const DATE_FMT = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Karachi",
});

const DAY_FMT = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Karachi",
});

export function formatPkDateTime(d: Date | string): string {
  return DATE_FMT.format(typeof d === "string" ? new Date(d) : d);
}

export function formatPkDay(d: Date | string): string {
  return DAY_FMT.format(typeof d === "string" ? new Date(d) : d);
}

export function DateCell({ value }: { value: Date | string | null | undefined }) {
  if (!value) return <span className="text-[var(--a-soft)]">&mdash;</span>;
  return (
    <time dateTime={new Date(value).toISOString()} className="whitespace-nowrap text-[var(--a-soft)]">
      {formatPkDateTime(value)}
    </time>
  );
}

export function Money({ paisa, bold }: { paisa: number; bold?: boolean }) {
  return <span className={`a-num ${bold ? "font-semibold" : ""}`}>{formatPKR(paisa)}</span>;
}

/* -------------------------------------------------------------- layout */

export function Card({
  title,
  actions,
  children,
  className = "",
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`a-card ${className}`}>
      {title ? (
        <div className="a-card-head">
          <h2>{title}</h2>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function Field({
  id,
  label,
  hint,
  error,
  children,
  className = "",
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="a-label">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="a-err">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="a-hint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="a-empty">
      <h2>{title}</h2>
      <p className="mx-auto max-w-md text-[12.5px]">{children}</p>
      {action ? <div className="mt-3 flex justify-center gap-2">{action}</div> : null}
    </div>
  );
}

/** Skeleton rows sized to the real table so nothing shifts when data lands. */
export function TableSkeleton({ rows = 8, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <table className="a-table" aria-hidden="true">
      <tbody>
        {Array.from({ length: rows }).map((_, r) => (
          <tr key={r}>
            {Array.from({ length: cols }).map((__, c) => (
              <td key={c}>
                <span className="a-skel block h-3.5" style={{ width: c === 0 ? "70%" : c === cols - 1 ? "40%" : "55%" }} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function StatTile({
  label,
  value,
  sub,
  href,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  href?: string;
  tone?: "warn" | "danger" | "ok";
}) {
  const toneClass =
    tone === "danger" ? "text-[var(--a-danger)]" : tone === "warn" ? "text-[var(--a-warn)]" : tone === "ok" ? "text-[var(--a-ok)]" : "";
  const body = (
    <>
      <p className="text-[11.5px] font-medium uppercase tracking-wide text-[var(--a-soft)]">{label}</p>
      <p className={`a-num mt-1 text-[22px] font-semibold leading-none ${toneClass}`} style={{ textAlign: "left" }}>
        {value}
      </p>
      {sub ? <p className="mt-1 text-[11.5px] text-[var(--a-soft)]">{sub}</p> : null}
    </>
  );
  return href ? (
    <Link href={href} className="a-card block p-3 hover:border-[var(--a-border-strong)]">
      {body}
    </Link>
  ) : (
    <div className="a-card p-3">{body}</div>
  );
}

/** Cursor pagination: one "next" link, plus a way back to the start. */
export function CursorPager({
  basePath,
  params,
  nextCursor,
  hasCursor,
}: {
  basePath: string;
  params: Record<string, string | undefined>;
  nextCursor: string | null;
  hasCursor: boolean;
}) {
  if (!nextCursor && !hasCursor) return null;
  const build = (cursor?: string) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v);
    if (cursor) qs.set("cursor", cursor);
    const q = qs.toString();
    return q ? `${basePath}?${q}` : basePath;
  };
  return (
    <nav aria-label="Pagination" className="mt-3 flex items-center gap-2">
      {hasCursor ? (
        <Link href={build()} className="a-btn a-btn-xs">
          First page
        </Link>
      ) : null}
      {nextCursor ? (
        <Link href={build(nextCursor)} className="a-btn a-btn-xs">
          Next page &rarr;
        </Link>
      ) : (
        <span className="text-[11.5px] text-[var(--a-soft)]">End of results</span>
      )}
    </nav>
  );
}

export function DiffTable({ before, after }: { before: unknown; after: unknown }) {
  const b = (before ?? {}) as Record<string, unknown>;
  const a = (after ?? {}) as Record<string, unknown>;
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])];
  if (keys.length === 0) return <span className="text-[var(--a-soft)]">&mdash;</span>;
  const show = (v: unknown) => (v === null || v === undefined ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v));
  return (
    <table className="a-mono w-full">
      <tbody>
        {keys.map((k) => (
          <tr key={k}>
            <td className="pr-2 align-top text-[var(--a-soft)]">{k}</td>
            <td className="pr-2 align-top text-[var(--a-danger)] line-through">{show(b[k])}</td>
            <td className="align-top text-[var(--a-ok)]">{show(a[k])}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
