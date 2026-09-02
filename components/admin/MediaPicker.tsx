"use client";

import { useEffect, useState, useTransition } from "react";
import type { MediaFile } from "@/lib/db/schema";
import { Modal } from "./client-ui";
import { listMediaAction } from "@/app/admin/(panel)/files/list-action";

/** Reusable image chooser for the product, collection and blog editors. */
export function MediaPicker({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (url: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      start(async () => setFiles(await listMediaAction(query)));
    }, 150);
    return () => clearTimeout(timer);
  }, [query, open]);

  return (
    <Modal open={open} onClose={onClose} title="Choose an image" width={680}>
      <label htmlFor="media-picker-search" className="a-label">
        Search files
      </label>
      <input
        id="media-picker-search"
        className="a-input"
        autoFocus
        value={query}
        placeholder="Filename or alt text"
        onChange={(e) => setQuery(e.target.value)}
      />
      {files.length === 0 ? (
        <p className="py-8 text-center text-[12px] text-[var(--a-soft)]">
          {pending ? "Loading…" : "No files. Upload some in Files first."}
        </p>
      ) : (
        <ul className="mt-2 grid max-h-80 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-5">
          {files.map((file) => (
            <li key={file.id}>
              <button
                type="button"
                className="a-card block w-full overflow-hidden text-left hover:border-[var(--a-border-strong)]"
                onClick={() => onPick(file.url)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={file.url} alt={file.alt} className="aspect-square w-full bg-white object-contain" loading="lazy" />
                <span className="block truncate px-1 py-0.5 text-[10.5px]">{file.filename}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
