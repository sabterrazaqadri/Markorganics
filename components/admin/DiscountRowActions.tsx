"use client";

import Link from "next/link";
import { useOptimistic } from "react";
import { ConfirmButton, useAction } from "./client-ui";
import { deleteDiscountAction, toggleDiscountAction } from "@/app/admin/(panel)/discounts/actions";

export function DiscountRowActions({
  id,
  isEnabled,
  canWrite,
}: {
  id: string;
  isEnabled: boolean;
  canWrite: boolean;
}) {
  const { pending, runAction } = useAction();
  const [enabled, setEnabled] = useOptimistic(isEnabled);

  if (!canWrite) {
    return (
      <Link href={`/admin/discounts/${id}`} prefetch={false} className="a-btn-link">
        View
      </Link>
    );
  }

  return (
    <span className="flex items-center gap-2">
      <Link href={`/admin/discounts/${id}`} prefetch={false} className="a-btn-link">
        Edit
      </Link>
      <button
        type="button"
        className="a-btn-link"
        disabled={pending}
        onClick={() =>
          runAction(
            async () => {
              setEnabled(!enabled);
              return toggleDiscountAction(id, !enabled);
            },
            { success: enabled ? "Discount disabled" : "Discount enabled" },
          )
        }
      >
        {enabled ? "Disable" : "Enable"}
      </button>
      <ConfirmButton
        className="a-btn-link text-[var(--a-danger)]"
        confirmLabel="Sure?"
        disabled={pending}
        onConfirm={() => runAction(() => deleteDiscountAction(id), { success: "Discount deleted" })}
      >
        Delete
      </ConfirmButton>
    </span>
  );
}
