"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { MediaFile } from "@/lib/db/schema";
import type { MediaUsage } from "@/lib/admin/media";
import { ConfirmButton, ErrorNote, Modal, useAction } from "./client-ui";
import { addFromUrlAction, deleteMediaAction, indexImagesAction, setAltAction, usageAction } from "@/app/admin/(panel)/files/actions";
import { uploadImages } from "./upload";

function kb(bytes: number) {
  if (!bytes) return "—";
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

export function MediaLibrary({ files, canWrite }: { files: MediaFile[]; canWrite: boolean }) {
  const router = useRouter();
  const { pending, error, runAction, setError, show } = useAction();
  const [selected, setSelected] = useState<MediaFile | null>(null);
  const [usage, setUsage] = useState<MediaUsage[] | null>(null);
  const [alt, setAlt] = useState("");
  const [uploading, setUploading] = useState(false);
  const [urlModal, setUrlModal] = useState(false);
  const [urlValue, setUrlValue] = useState("");
  const [urlAlt, setUrlAlt] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setError(null);
    setUploading(true);
    const result = await uploadImages(fileList);
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
    if (result.error) setError(result.error);
    const added = result.files.length;
    if (added) {
      show(`${added} file${added === 1 ? "" : "s"} uploaded`);
      router.refresh();
    }
  }

  function open(file: MediaFile) {
    setSelected(file);
    setAlt(file.alt);
    setUsage(null);
    runAction(() => usageAction(file.id), { success: undefined, refresh: false, onDone: (rows) => setUsage(rows) });
  }

  return (
    <>
      <ErrorNote message={error} />

      {canWrite ? (
        <div className="a-card mb-3 flex flex-wrap items-center gap-2 p-2">
          <label htmlFor="media-upload" className="a-label mb-0">
            Upload images
          </label>
          <input
            ref={inputRef}
            id="media-upload"
            type="file"
            multiple
            accept="image/*"
            className="a-input w-auto"
            onChange={(e) => upload(e.target.files)}
            disabled={uploading}
          />
          <span className="text-[11.5px] text-[var(--a-soft)]">{uploading ? "Uploading…" : "Converted to WebP, 8 MB max"}</span>
          <button type="button" className="a-btn a-btn-xs ml-auto" onClick={() => setUrlModal(true)}>
            Add by URL
          </button>
          <button
            type="button"
            className="a-btn a-btn-xs"
            disabled={pending}
            onClick={() => runAction(() => indexImagesAction(), { success: "Product images indexed" })}
          >
            Index product images
          </button>
        </div>
      ) : null}

      {files.length === 0 ? (
        <div className="a-card a-empty">
          <h2>No files yet</h2>
          <p className="text-[12.5px]">
            Upload an image, or run &ldquo;Index product images&rdquo; to pull in everything already referenced by a product.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
          {files.map((file) => (
            <li key={file.id}>
              <button
                type="button"
                className="a-card block w-full overflow-hidden text-left hover:border-[var(--a-border-strong)]"
                onClick={() => open(file)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={file.url} alt={file.alt} className="aspect-square w-full bg-white object-contain" loading="lazy" />
                <span className="block truncate px-1.5 py-1 text-[11px]" title={file.filename}>
                  {file.filename}
                </span>
                {!file.alt ? <span className="a-badge a-badge-warn mx-1.5 mb-1.5">no alt text</span> : null}
              </button>
            </li>
          ))}
        </ul>
      )}

      <Modal open={selected !== null} onClose={() => setSelected(null)} title={selected?.filename ?? "File"} width={620}>
        {selected ? (
          <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={selected.url} alt={selected.alt} className="w-full rounded border border-[var(--a-border)] bg-white object-contain" />
            <div className="space-y-2">
              <p className="a-mono break-all text-[var(--a-soft)]">{selected.url}</p>
              <p className="text-[11.5px] text-[var(--a-soft)]">
                {selected.width && selected.height ? `${selected.width}×${selected.height} · ` : ""}
                {kb(selected.sizeBytes)} · {selected.mimeType}
              </p>

              <div>
                <label htmlFor="media-alt" className="a-label">
                  Alt text
                </label>
                <input
                  id="media-alt"
                  className="a-input"
                  value={alt}
                  maxLength={200}
                  disabled={!canWrite}
                  onChange={(e) => setAlt(e.target.value)}
                />
                <p className="a-hint">Describe what the image shows. Screen readers and search both use it.</p>
              </div>

              <div className="rounded border border-[var(--a-border)] p-2">
                <p className="a-label mb-1">Used by</p>
                {usage === null ? (
                  <p className="text-[11.5px] text-[var(--a-soft)]">Checking…</p>
                ) : usage.length === 0 ? (
                  <p className="text-[11.5px] text-[var(--a-soft)]">Nothing references this file.</p>
                ) : (
                  <ul className="space-y-0.5 text-[11.5px]">
                    {usage.map((u) => (
                      <li key={`${u.kind}-${u.id}`}>
                        <span className="a-badge a-badge-neutral mr-1.5">{u.kind}</span>
                        {u.label}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {canWrite ? (
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    className="a-btn a-btn-primary a-btn-xs"
                    disabled={pending || alt === selected.alt}
                    onClick={() => runAction(() => setAltAction(selected.id, alt), { success: "Alt text saved" })}
                  >
                    Save alt text
                  </button>
                  <ConfirmButton
                    confirmLabel={usage && usage.length ? "Blocked while in use" : "Yes, delete permanently"}
                    disabled={pending || (usage !== null && usage.length > 0)}
                    onConfirm={() =>
                      runAction(() => deleteMediaAction(selected.id), {
                        success: "File deleted",
                        onDone: () => setSelected(null),
                      })
                    }
                  >
                    Delete file
                  </ConfirmButton>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal open={urlModal} onClose={() => setUrlModal(false)} title="Add an image by URL" width={460}>
        <p className="mb-2 text-[12px] text-[var(--a-soft)]">
          Use this when the file already lives in <code className="a-mono">/public</code> or on a CDN.
        </p>
        <label htmlFor="media-url" className="a-label">
          URL or path
        </label>
        <input
          id="media-url"
          className="a-input"
          value={urlValue}
          placeholder="/products/mustard-oil-200.webp"
          onChange={(e) => setUrlValue(e.target.value)}
        />
        <label htmlFor="media-url-alt" className="a-label mt-2">
          Alt text
        </label>
        <input id="media-url-alt" className="a-input" value={urlAlt} onChange={(e) => setUrlAlt(e.target.value)} />
        <div className="mt-3 flex justify-end gap-2">
          <button type="button" className="a-btn" onClick={() => setUrlModal(false)}>
            Cancel
          </button>
          <button
            type="button"
            className="a-btn a-btn-primary"
            disabled={pending || !urlValue.trim()}
            onClick={() =>
              runAction(() => addFromUrlAction(urlValue, urlAlt), {
                success: "File added",
                onDone: () => {
                  setUrlModal(false);
                  setUrlValue("");
                  setUrlAlt("");
                },
              })
            }
          >
            Add file
          </button>
        </div>
      </Modal>
    </>
  );
}
