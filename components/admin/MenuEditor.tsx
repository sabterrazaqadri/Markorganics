"use client";

import { useState } from "react";
import { ErrorNote, useAction } from "./client-ui";
import { saveMenuAction } from "@/app/admin/(panel)/content/actions";

export interface MenuItemDraft {
  id: string;
  parentId: string | null;
  label: string;
  url: string;
  resourceType: "custom" | "collection" | "product" | "page";
  resourceId: string;
}

export interface LinkOption {
  /** `${resourceType}:${resourceId}` — unique across every group. */
  value: string;
  label: string;
  group: string;
  url: string;
  resourceType: MenuItemDraft["resourceType"];
  resourceId: string;
}

let counter = 0;
const nextId = () => `new-${++counter}`;

/**
 * Header and footer menus. Items nest one level, which is all a storefront
 * header needs, and order is set by dragging or the arrow buttons.
 */
export function MenuEditor({
  handle,
  initial,
  links,
}: {
  handle: "header" | "footer";
  initial: MenuItemDraft[];
  links: LinkOption[];
}) {
  const { pending, error, runAction } = useAction();
  const [items, setItems] = useState<MenuItemDraft[]>(initial);

  const roots = items.filter((i) => !i.parentId);
  const childrenOf = (id: string) => items.filter((i) => i.parentId === id);

  function patch(id: string, next: Partial<MenuItemDraft>) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...next } : i)));
  }

  function remove(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id && i.parentId !== id));
  }

  function add(parentId: string | null) {
    setItems((prev) => [
      ...prev,
      { id: nextId(), parentId, label: "New link", url: "/", resourceType: "custom", resourceId: "" },
    ]);
  }

  function moveRoot(from: number, to: number) {
    if (to < 0 || to >= roots.length) return;
    const order = [...roots];
    const [item] = order.splice(from, 1);
    order.splice(to, 0, item);
    // Rebuild the array so parents keep their children next to them.
    setItems(order.flatMap((root) => [root, ...childrenOf(root.id)]));
  }

  const groups = [...new Set(links.map((l) => l.group))];

  function itemRow(item: MenuItemDraft, index: number, isChild: boolean) {
    return (
      <li
        key={item.id}
        draggable={!isChild}
        onDragStart={(e) => !isChild && e.dataTransfer.setData("text/plain", String(index))}
        onDragOver={(e) => !isChild && e.preventDefault()}
        onDrop={(e) => {
          if (isChild) return;
          e.preventDefault();
          moveRoot(Number(e.dataTransfer.getData("text/plain")), index);
        }}
        className={`rounded border border-[var(--a-border)] bg-white p-2 ${isChild ? "ml-6" : ""}`}
      >
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <div>
            <label htmlFor={`label-${item.id}`} className="a-label">
              Label
            </label>
            <input
              id={`label-${item.id}`}
              className="a-input"
              value={item.label}
              onChange={(e) => patch(item.id, { label: e.target.value })}
            />
          </div>
          <div>
            <label htmlFor={`url-${item.id}`} className="a-label">
              Links to
            </label>
            <select
              className="a-select mb-1"
              aria-label={`Pick a destination for ${item.label}`}
              value={item.resourceType === "custom" ? "" : `${item.resourceType}:${item.resourceId}`}
              onChange={(e) => {
                const link = links.find((l) => l.value === e.target.value);
                if (link) {
                  patch(item.id, {
                    url: link.url,
                    label: item.label === "New link" ? link.label : item.label,
                    resourceType: link.resourceType,
                    resourceId: link.resourceId,
                  });
                } else {
                  patch(item.id, { resourceType: "custom", resourceId: "" });
                }
              }}
            >
              <option value="">Custom URL</option>
              {groups.map((group) => (
                <optgroup key={group} label={group}>
                  {links
                    .filter((l) => l.group === group)
                    .map((l) => (
                      <option key={l.value} value={l.value}>
                        {l.label}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
            <input
              id={`url-${item.id}`}
              className="a-input"
              value={item.url}
              onChange={(e) => patch(item.id, { url: e.target.value, resourceType: "custom", resourceId: "" })}
            />
          </div>
          <div className="flex items-end gap-1">
            {!isChild ? (
              <>
                <button type="button" className="a-btn a-btn-xs" aria-label={`Move ${item.label} up`} onClick={() => moveRoot(index, index - 1)}>
                  ↑
                </button>
                <button type="button" className="a-btn a-btn-xs" aria-label={`Move ${item.label} down`} onClick={() => moveRoot(index, index + 1)}>
                  ↓
                </button>
                <button type="button" className="a-btn a-btn-xs" onClick={() => add(item.id)}>
                  + Sub-item
                </button>
              </>
            ) : null}
            <button type="button" className="a-btn a-btn-xs a-btn-danger" onClick={() => remove(item.id)}>
              Remove
            </button>
          </div>
        </div>
      </li>
    );
  }

  return (
    <div className="space-y-2">
      <ErrorNote message={error} />

      {roots.length === 0 ? (
        <p className="text-[12px] text-[var(--a-soft)]">
          No items. The storefront falls back to its built-in links until you add some.
        </p>
      ) : null}

      <ul className="space-y-2">
        {roots.map((root, i) => (
          <li key={root.id} className="space-y-2">
            <ul>{itemRow(root, i, false)}</ul>
            {childrenOf(root.id).length ? <ul className="space-y-2">{childrenOf(root.id).map((c) => itemRow(c, 0, true))}</ul> : null}
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="a-btn a-btn-xs" onClick={() => add(null)}>
          Add a link
        </button>
        <button
          type="button"
          className="a-btn a-btn-primary a-btn-xs"
          disabled={pending}
          onClick={() =>
            runAction(
              () =>
                saveMenuAction({
                  handle,
                  items: items.map((i) => ({
                    id: i.id,
                    parentId: i.parentId ?? "",
                    label: i.label,
                    url: i.url,
                    resourceType: i.resourceType,
                    resourceId: i.resourceId,
                  })),
                }),
              { success: `${handle === "header" ? "Header" : "Footer"} menu saved` },
            )
          }
        >
          {pending ? "Saving…" : "Save menu"}
        </button>
        <span className="text-[11.5px] text-[var(--a-soft)]">Drag a top-level row to reorder.</span>
      </div>
    </div>
  );
}
