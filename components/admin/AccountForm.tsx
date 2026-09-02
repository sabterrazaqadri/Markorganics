"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "./ui";
import { ConfirmButton, ErrorNote, useAction } from "./client-ui";
import { changeOwnPasswordAction, signOutEverywhereAction } from "@/app/admin/(panel)/settings/actions";

export function AccountForm({ sessions }: { sessions: number }) {
  const router = useRouter();
  const { pending, error, fieldErrors, runAction } = useAction();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");

  const mismatch = confirm.length > 0 && next !== confirm;

  return (
    <div className="space-y-3">
      <Card title="Change password">
        <div className="space-y-2 p-3">
          <ErrorNote message={error} />
          <div>
            <label htmlFor="cur-pass" className="a-label">
              Current password
            </label>
            <input
              id="cur-pass"
              className="a-input"
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
            {fieldErrors.currentPassword ? <p className="a-err">{fieldErrors.currentPassword}</p> : null}
          </div>
          <div>
            <label htmlFor="new-pass" className="a-label">
              New password
            </label>
            <input
              id="new-pass"
              className="a-input"
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
            <p className="a-hint">At least 10 characters.</p>
            {fieldErrors.newPassword ? <p className="a-err">{fieldErrors.newPassword}</p> : null}
          </div>
          <div>
            <label htmlFor="confirm-pass" className="a-label">
              Confirm new password
            </label>
            <input
              id="confirm-pass"
              className="a-input"
              type="password"
              autoComplete="new-password"
              aria-invalid={mismatch ? "true" : undefined}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            {mismatch ? <p className="a-err">The two passwords do not match.</p> : null}
          </div>
          <button
            type="button"
            className="a-btn a-btn-primary"
            disabled={pending || mismatch || next.length < 10 || !current}
            onClick={() =>
              runAction(() => changeOwnPasswordAction({ currentPassword: current, newPassword: next }), {
                success: "Password changed",
                refresh: false,
                onDone: () => {
                  setCurrent("");
                  setNext("");
                  setConfirm("");
                },
              })
            }
          >
            {pending ? "Saving…" : "Change password"}
          </button>
        </div>
      </Card>

      <Card title="Sessions">
        <div className="space-y-2 p-3">
          <p className="text-[12.5px]">
            You have {sessions} active session{sessions === 1 ? "" : "s"}. Signing out everywhere ends all of them,
            including this one.
          </p>
          <ConfirmButton
            className="a-btn a-btn-danger a-btn-xs"
            confirmLabel="Yes, sign out all devices"
            disabled={pending}
            onConfirm={() =>
              runAction(() => signOutEverywhereAction(), {
                success: "Signed out everywhere",
                refresh: false,
                onDone: () => router.push("/admin/login"),
              })
            }
          >
            Sign out all devices
          </ConfirmButton>
        </div>
      </Card>
    </div>
  );
}
