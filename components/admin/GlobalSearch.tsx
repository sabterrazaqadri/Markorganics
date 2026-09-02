"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { SearchHit } from "@/lib/admin/search";
import { searchEverything } from "@/app/admin/(panel)/search-action";

const KIND_LABEL: Record<SearchHit["kind"], string> = {
  order: "Order",
  product: "Product",
  customer: "Customer",
};

/** Cmd/Ctrl+K search across orders, products and customers. */
export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [active, setActive] = useState(0);
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const requestId = useRef(0);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
    else {
      setQuery("");
      setHits([]);
      setActive(0);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      return;
    }
    const id = ++requestId.current;
    const timer = setTimeout(() => {
      start(async () => {
        const results = await searchEverything(q);
        // Ignore responses that arrived out of order.
        if (id === requestId.current) {
          setHits(results);
          setActive(0);
        }
      });
    }, 160);
    return () => clearTimeout(timer);
  }, [query, open]);

  function go(hit: SearchHit | undefined) {
    if (!hit) return;
    setOpen(false);
    router.push(hit.href);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="a-btn a-btn-xs w-full justify-between gap-6 text-[var(--a-soft)] sm:w-64"
      >
        <span>Search orders, products, customers</span>
        <span className="a-kbd">Ctrl K</span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-[90] flex items-start justify-center bg-black/35 p-4 pt-[10vh]">
          <button type="button" aria-label="Close search" className="fixed inset-0 -z-10 cursor-default" onClick={() => setOpen(false)} tabIndex={-1} />
          <div role="dialog" aria-modal="true" aria-label="Search" className="a-card w-full max-w-lg overflow-hidden shadow-xl">
            <input
              ref={inputRef}
              className="a-input rounded-none border-0 border-b border-[var(--a-border)] px-3 py-2.5 text-[13.5px]"
              style={{ minHeight: 42, boxShadow: "none" }}
              placeholder="Order number, phone, product name or SKU"
              value={query}
              role="combobox"
              aria-expanded={hits.length > 0}
              aria-controls="admin-search-results"
              aria-activedescendant={hits[active] ? `search-hit-${hits[active].id}-${hits[active].kind}` : undefined}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActive((i) => Math.min(i + 1, hits.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive((i) => Math.max(i - 1, 0));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  go(hits[active]);
                }
              }}
            />
            <ul id="admin-search-results" role="listbox" aria-label="Results" className="max-h-80 overflow-y-auto">
              {query.trim().length < 2 ? (
                <li className="px-3 py-6 text-center text-[12px] text-[var(--a-soft)]">
                  Type at least two characters. Arrow keys to move, Enter to open.
                </li>
              ) : pending && hits.length === 0 ? (
                <li className="px-3 py-6 text-center text-[12px] text-[var(--a-soft)]">Searching…</li>
              ) : hits.length === 0 ? (
                <li className="px-3 py-6 text-center text-[12px] text-[var(--a-soft)]">Nothing matched.</li>
              ) : (
                hits.map((hit, i) => (
                  <li key={`${hit.kind}-${hit.id}`} id={`search-hit-${hit.id}-${hit.kind}`} role="option" aria-selected={i === active}>
                    <button
                      type="button"
                      className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left ${i === active ? "bg-[var(--a-info-bg)]" : ""}`}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => go(hit)}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[12.5px] font-medium">{hit.title}</span>
                        <span className="block truncate text-[11.5px] text-[var(--a-soft)]">{hit.subtitle}</span>
                      </span>
                      <span className="a-badge a-badge-neutral">{KIND_LABEL[hit.kind]}</span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      ) : null}
    </>
  );
}
