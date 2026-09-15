"use client";

import { useState } from "react";
import { ConfirmButton, Modal, useAction } from "./client-ui";
import { deleteReviewAction, replyToReviewAction, setReviewStatusAction } from "@/app/admin/(panel)/reviews/actions";
import type { ReviewStatus } from "@/lib/db/schema";

export function ReviewRowActions({
  id,
  status,
  reply,
  canWrite,
}: {
  id: string;
  status: ReviewStatus;
  reply: string;
  canWrite: boolean;
}) {
  const { pending, runAction } = useAction();
  const [replying, setReplying] = useState(false);
  const [text, setText] = useState(reply);

  if (!canWrite) return null;

  return (
    <span className="flex flex-wrap items-center gap-2">
      {status !== "approved" ? (
        <button type="button" className="a-btn-link" disabled={pending} onClick={() => runAction(() => setReviewStatusAction(id, "approved"), { success: "Approved" })}>
          Approve
        </button>
      ) : null}
      {status !== "rejected" ? (
        <button type="button" className="a-btn-link" disabled={pending} onClick={() => runAction(() => setReviewStatusAction(id, "rejected"), { success: "Rejected" })}>
          Reject
        </button>
      ) : null}
      <button type="button" className="a-btn-link" disabled={pending} onClick={() => setReplying(true)}>
        {reply ? "Edit reply" : "Reply"}
      </button>
      <ConfirmButton
        className="a-btn-link text-[var(--a-danger)]"
        confirmLabel="Sure?"
        disabled={pending}
        onConfirm={() => runAction(() => deleteReviewAction(id), { success: "Review deleted" })}
      >
        Delete
      </ConfirmButton>

      <Modal open={replying} onClose={() => setReplying(false)} title="Reply as the store">
        <p className="a-hint mb-2">Shown under the review on the product page. Leave empty to remove a reply.</p>
        <textarea className="a-textarea min-h-24" value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} />
        <div className="mt-3 flex justify-end gap-2">
          <button type="button" className="a-btn a-btn-xs" onClick={() => setReplying(false)}>
            Cancel
          </button>
          <button
            type="button"
            className="a-btn a-btn-primary a-btn-xs"
            disabled={pending}
            onClick={() =>
              runAction(() => replyToReviewAction({ id, reply: text }), {
                success: "Reply saved",
                onDone: () => setReplying(false),
              })
            }
          >
            Save reply
          </button>
        </div>
      </Modal>
    </span>
  );
}
