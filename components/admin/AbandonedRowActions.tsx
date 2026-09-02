"use client";

import { useAction } from "./client-ui";
import { setAbandonedStatusAction } from "@/app/admin/(panel)/abandoned/actions";

export function AbandonedRowActions({ id, status }: { id: string; status: string }) {
  const { pending, runAction } = useAction();
  const next = status === "dismissed" ? "open" : "dismissed";
  return (
    <button
      type="button"
      className="a-btn-link"
      disabled={pending}
      onClick={() =>
        runAction(() => setAbandonedStatusAction(id, next), {
          success: next === "dismissed" ? "Dismissed" : "Reopened",
        })
      }
    >
      {next === "dismissed" ? "Dismiss" : "Reopen"}
    </button>
  );
}
