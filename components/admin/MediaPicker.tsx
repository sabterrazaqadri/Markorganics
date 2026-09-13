"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { MediaFile } from "@/lib/db/schema";
import { ErrorNote, Modal } from "./client-ui";
import { listMediaAction } from "@/app/admin/(panel)/files/list-action";
import { uploadImages } from "./upload";

/**
 * Reusable image chooser for the product, collection and blog editors.
 * Uploading here picks the new file straight away, so nobody has to go
 * through Files first.
 */
export function MediaPicker({
  open,
  onClose,
  onPick,
  canUpload = true,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (url: string) => void;
  canUpload?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [pending, start] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(list: FileList | null) {
    if (!list || list.length === 0) return;
    setError(null);
    setUploading(true);
    const result = await uploadImages([list[0]]);
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
    if (result.error) {
      setError(result.error);
      return;
    }
    const file = result.files[0];
    if (file) onPick(file.url);
  }

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      start(async () => setFiles(await listMediaAction(query)));
    }, 150);
    return () => clearTimeout(timer);
  }, [query, open]);

  return (
    <Modal open={open} onClose={onClose} title="Choose an image" width={680}>
      {canUpload ? (
        <div className="mb-2 flex flex-wrap items-center gap-2 rounded border border-dashed border-[var(--a-border)] p-2">
          <label htmlFor="media-picker-upload" className="a-label mb-0">
            Upload new
          </label>
          <input
            ref={inputRef}
            id="media-picker-upload"
            type="file"
            accept="image/*"
            className="a-input w-auto"
            disabled={uploading}
            onChange={(e) => upload(e.target.files)}
          />
          <span className="text-[11.5px] text-[var(--a-soft)]">{uploading ? "Uploading…" : "Converted to WebP, 8 MB max"}</span>
        </div>
      ) : null}
      <ErrorNote message={error} />
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
