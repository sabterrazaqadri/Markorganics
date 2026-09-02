"use client";

import Link from "next/link";
import { ConfirmButton, useAction } from "./client-ui";
import { deleteCollectionAction, reevaluateAction } from "@/app/admin/(panel)/collections/actions";

export function CollectionRowActions({ id, isAutomatic }: { id: string; isAutomatic: boolean }) {
  const { pending, runAction } = useAction();
  return (
    <span className="flex items-center gap-2">
      <Link href={`/admin/collections/${id}`} prefetch={false} className="a-btn-link">
        Edit
      </Link>
      {isAutomatic ? (
        <button
          type="button"
          className="a-btn-link"
          disabled={pending}
          onClick={() => runAction(() => reevaluateAction(id), { success: "Re-evaluated" })}
        >
          Re-run
        </button>
      ) : null}
      <ConfirmButton
        className="a-btn-link text-[var(--a-danger)]"
        confirmLabel="Sure?"
        disabled={pending}
        onConfirm={() => runAction(() => deleteCollectionAction(id), { success: "Collection deleted" })}
      >
        Delete
      </ConfirmButton>
    </span>
  );
}
