"use client";

import { useEffect, useId, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import type { ActionResult } from "@/lib/admin/result";

/* --------------------------------------------------------------- modal */

export function Modal({
  open,
  onClose,
  title,
  children,
  width = 520,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  width?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const node = ref.current;
    node?.querySelector<HTMLElement>("input,select,textarea,button,[tabindex]")?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !node) return;
      // Keep focus inside the dialog.
      const focusable = [...node.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      previous?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/35 p-4 pt-[8vh]">
      <button type="button" aria-label="Close" className="fixed inset-0 -z-10 cursor-default" onClick={onClose} tabIndex={-1} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="a-card w-full shadow-xl"
        style={{ maxWidth: width }}
      >
        <div className="a-card-head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="a-btn a-btn-xs" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="p-3">{children}</div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- action glue */

export function useAction() {
  const router = useRouter();
  const show = useToast((s) => s.show);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function runAction<T>(
    fn: () => Promise<ActionResult<T>>,
    opts: { success?: string; onDone?: (data: T) => void; refresh?: boolean } = {},
  ) {
    setError(null);
    setFieldErrors({});
    start(async () => {
      const result = await fn();
      if (!result.ok) {
        setError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
        show(result.error);
        return;
      }
      if (opts.success) show(opts.success);
      opts.onDone?.(result.data as T);
      if (opts.refresh !== false) router.refresh();
    });
  }

  return { pending, error, fieldErrors, runAction, setError, router, show };
}

export function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="mb-2 rounded border border-[#e8b4b0] bg-[var(--a-danger-bg)] px-2.5 py-1.5 text-[12px] text-[var(--a-danger)]">
      {message}
    </p>
  );
}

/** Two-step destructive button: click, confirm, act. */
export function ConfirmButton({
  onConfirm,
  children,
  confirmLabel = "Confirm",
  className = "a-btn a-btn-xs a-btn-danger",
  disabled,
}: {
  onConfirm: () => void;
  children: ReactNode;
  confirmLabel?: string;
  className?: string;
  disabled?: boolean;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);

  return (
    <button
      type="button"
      className={className}
      disabled={disabled}
      onClick={() => {
        if (armed) {
          setArmed(false);
          onConfirm();
        } else {
          setArmed(true);
        }
      }}
    >
      {armed ? confirmLabel : children}
    </button>
  );
}

/* ------------------------------------------------------------ tag input */

export function TagInput({
  name,
  value,
  onChange,
  suggestions = [],
  placeholder = "Add a tag and press Enter",
}: {
  name?: string;
  value: string[];
  onChange: (next: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");
  const listId = useId();

  function add(raw: string) {
    const tag = raw.trim();
    if (!tag) return;
    if (value.some((t) => t.toLowerCase() === tag.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange([...value, tag]);
    setDraft("");
  }

  return (
    <div>
      {name ? <input type="hidden" name={name} value={value.join(", ")} /> : null}
      <div className="mb-1.5 flex flex-wrap gap-1">
        {value.map((tag) => (
          <span key={tag} className="a-tag">
            {tag}
            <button
              type="button"
              aria-label={`Remove ${tag}`}
              className="text-[var(--a-soft)] hover:text-[var(--a-danger)]"
              onClick={() => onChange(value.filter((t) => t !== tag))}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <input
        className="a-input"
        value={draft}
        list={suggestions.length ? listId : undefined}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add(draft);
          } else if (e.key === "Backspace" && !draft && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={() => add(draft)}
      />
      {suggestions.length ? (
        <datalist id={listId}>
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------ selection state */

export function useRowSelection(ids: string[]) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Drop ids that left the page so a stale selection cannot act on them.
  useEffect(() => {
    setSelected((prev) => {
      const next = new Set([...prev].filter((id) => ids.includes(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [ids]);

  const allSelected = ids.length > 0 && ids.every((id) => selected.has(id));
  return {
    selected,
    isSelected: (id: string) => selected.has(id),
    toggle: (id: string) =>
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    toggleAll: () => setSelected(allSelected ? new Set() : new Set(ids)),
    clear: () => setSelected(new Set()),
    allSelected,
    count: selected.size,
    ids: [...selected],
  };
}

/** Auto-submitting filter form: change a select, the list reloads. */
export function AutoSubmit({ children, action = "" }: { children: ReactNode; action?: string }) {
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={ref}
      method="get"
      action={action}
      onChange={(e) => {
        const target = e.target as HTMLElement;
        if (target.tagName === "SELECT") ref.current?.requestSubmit();
      }}
    >
      {children}
    </form>
  );
}
