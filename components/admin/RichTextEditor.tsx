"use client";

import { useRef, useState } from "react";
import { renderRichTextClient } from "@/lib/rich-text";

const TOOLBAR = [
  { label: "H2", before: "## ", after: "", title: "Heading" },
  { label: "H3", before: "### ", after: "", title: "Subheading" },
  { label: "B", before: "**", after: "**", title: "Bold" },
  { label: "I", before: "*", after: "*", title: "Italic" },
  { label: "•", before: "- ", after: "", title: "List item" },
  { label: "Link", before: "[", after: "](/)", title: "Link" },
] as const;

/**
 * A plain-text editor with Markdown shortcuts and a live preview.
 *
 * Deliberately not a contenteditable WYSIWYG: the stored text stays readable,
 * diffable in the audit log, and impossible to inject markup through.
 */
export function RichTextEditor({
  id,
  value,
  onChange,
  rows = 14,
}: {
  id: string;
  value: string;
  onChange: (next: string) => void;
  rows?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(false);

  function wrap(before: string, after: string) {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.slice(start, end);
    const next = `${value.slice(0, start)}${before}${selected}${after}${value.slice(end)}`;
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  }

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center gap-1">
        {TOOLBAR.map((t) => (
          <button
            key={t.label}
            type="button"
            className="a-btn a-btn-xs"
            title={t.title}
            onClick={() => wrap(t.before, t.after)}
          >
            {t.label}
          </button>
        ))}
        <button type="button" className="a-btn a-btn-xs ml-auto" onClick={() => setPreview((p) => !p)}>
          {preview ? "Edit" : "Preview"}
        </button>
      </div>

      {preview ? (
        <div
          className="prose-admin min-h-[200px] rounded border border-[var(--a-border)] bg-white p-3"
          // The renderer escapes everything before adding its own tags.
          dangerouslySetInnerHTML={{ __html: renderRichTextClient(value) }}
        />
      ) : (
        <textarea
          id={id}
          ref={ref}
          className="a-textarea font-mono"
          rows={rows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      <p className="a-hint">
        Markdown-ish: <code className="a-mono">## Heading</code>, <code className="a-mono">**bold**</code>,{" "}
        <code className="a-mono">- list</code>, <code className="a-mono">[text](/link)</code>.
      </p>
    </div>
  );
}
