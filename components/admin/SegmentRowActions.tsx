"use client";

import Link from "next/link";
import { ConfirmButton, useAction } from "./client-ui";
import { deleteSegmentAction } from "@/app/admin/(panel)/customers/actions";

export function SegmentRowActions({ id, canWrite }: { id: string; canWrite: boolean }) {
  const { pending, runAction } = useAction();
  return (
    <span className="flex items-center gap-2">
      <Link href={`/admin/customers?segmentId=${id}`} prefetch={false} className="a-btn-link">
        View customers
      </Link>
      <a href={`/api/admin/customers/export?segmentId=${id}`} className="a-btn-link" download>
        Export
      </a>
      {canWrite ? (
        <>
          <Link href={`/admin/segments/${id}`} prefetch={false} className="a-btn-link">
            Edit
          </Link>
          <ConfirmButton
            className="a-btn-link text-[var(--a-danger)]"
            confirmLabel="Sure?"
            disabled={pending}
            onConfirm={() => runAction(() => deleteSegmentAction(id), { success: "Segment deleted" })}
          >
            Delete
          </ConfirmButton>
        </>
      ) : null}
    </span>
  );
}
