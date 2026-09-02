"use client";

import { useState } from "react";
import { USER_ROLES, type UserRole } from "@/lib/db/schema";
import { ROLE_BLURB, ROLE_LABEL } from "@/lib/admin/permissions";
import { Card, DateCell, RolePill } from "./ui";
import { ConfirmButton, ErrorNote, Modal, useAction } from "./client-ui";
import {
  createStaffAction,
  deleteStaffAction,
  resetStaffPasswordAction,
  updateStaffAction,
} from "@/app/admin/(panel)/settings/actions";

export interface StaffRow {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: "active" | "suspended";
  lastLoginAt: string | null;
  createdAt: string;
  sessions: number;
}

export function StaffManager({ rows, currentUserId }: { rows: StaffRow[]; currentUserId: string }) {
  const { pending, error, fieldErrors, runAction } = useAction();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<StaffRow | null>(null);
  const [resetting, setResetting] = useState<StaffRow | null>(null);
  const [form, setForm] = useState({ email: "", name: "", role: "staff" as UserRole, password: "" });
  const [newPassword, setNewPassword] = useState("");

  return (
    <>
      <Card
        title="Staff accounts"
        actions={
          <button type="button" className="a-btn a-btn-xs" onClick={() => setCreating(true)}>
            Add staff
          </button>
        }
      >
        <ErrorNote message={error} />
        <div className="a-scroll">
          <table className="a-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th className="a-num">Sessions</th>
                <th>Last sign-in</th>
                <th style={{ width: 190 }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="font-medium">
                    {row.name}
                    {row.id === currentUserId ? <span className="a-badge a-badge-info ml-1.5">you</span> : null}
                  </td>
                  <td className="text-[var(--a-soft)]">{row.email}</td>
                  <td>
                    <RolePill role={row.role} />
                  </td>
                  <td>
                    <span className={`a-badge ${row.status === "active" ? "a-badge-ok" : "a-badge-warn"}`}>{row.status}</span>
                  </td>
                  <td className="a-num">{row.sessions}</td>
                  <td>{row.lastLoginAt ? <DateCell value={row.lastLoginAt} /> : <span className="text-[var(--a-soft)]">never</span>}</td>
                  <td>
                    <span className="flex flex-wrap items-center gap-2">
                      <button type="button" className="a-btn-link" onClick={() => setEditing(row)}>
                        Edit
                      </button>
                      <button type="button" className="a-btn-link" onClick={() => setResetting(row)}>
                        Reset password
                      </button>
                      {row.id !== currentUserId ? (
                        <ConfirmButton
                          className="a-btn-link text-[var(--a-danger)]"
                          confirmLabel="Sure?"
                          disabled={pending}
                          onConfirm={() => runAction(() => deleteStaffAction(row.id), { success: "Staff member removed" })}
                        >
                          Remove
                        </ConfirmButton>
                      ) : null}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-3">
        <Card title="What each role can do">
          <ul className="divide-y divide-[var(--a-border)]">
            {USER_ROLES.map((role) => (
              <li key={role} className="flex items-start gap-3 px-3 py-2">
                <RolePill role={role} />
                <p className="text-[12.5px] text-[var(--a-soft)]">{ROLE_BLURB[role]}</p>
              </li>
            ))}
          </ul>
          <p className="a-hint p-3">
            Permissions are checked inside every Server Action, not just by hiding buttons.
          </p>
        </Card>
      </div>

      <Modal open={creating} onClose={() => setCreating(false)} title="Add a staff account" width={440}>
        <ErrorNote message={error} />
        <div className="space-y-2">
          <div>
            <label htmlFor="new-name" className="a-label">
              Name
            </label>
            <input id="new-name" className="a-input" autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            {fieldErrors.name ? <p className="a-err">{fieldErrors.name}</p> : null}
          </div>
          <div>
            <label htmlFor="new-email" className="a-label">
              Email
            </label>
            <input
              id="new-email"
              className="a-input"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            {fieldErrors.email ? <p className="a-err">{fieldErrors.email}</p> : null}
          </div>
          <div>
            <label htmlFor="new-role" className="a-label">
              Role
            </label>
            <select id="new-role" className="a-select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}>
              {USER_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
            <p className="a-hint">{ROLE_BLURB[form.role]}</p>
          </div>
          <div>
            <label htmlFor="new-password" className="a-label">
              Temporary password
            </label>
            <input
              id="new-password"
              className="a-input"
              type="text"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            <p className="a-hint">At least 10 characters. Share it once and ask them to change it.</p>
            {fieldErrors.password ? <p className="a-err">{fieldErrors.password}</p> : null}
          </div>
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <button type="button" className="a-btn" onClick={() => setCreating(false)}>
            Cancel
          </button>
          <button
            type="button"
            className="a-btn a-btn-primary"
            disabled={pending}
            onClick={() =>
              runAction(() => createStaffAction(form), {
                success: "Staff account created",
                onDone: () => {
                  setCreating(false);
                  setForm({ email: "", name: "", role: "staff", password: "" });
                },
              })
            }
          >
            {pending ? "Creating…" : "Create account"}
          </button>
        </div>
      </Modal>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title="Edit staff account" width={440}>
        {editing ? (
          <>
            <ErrorNote message={error} />
            <div className="space-y-2">
              <div>
                <label htmlFor="edit-name" className="a-label">
                  Name
                </label>
                <input id="edit-name" className="a-input" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div>
                <label htmlFor="edit-role" className="a-label">
                  Role
                </label>
                <select
                  id="edit-role"
                  className="a-select"
                  value={editing.role}
                  onChange={(e) => setEditing({ ...editing, role: e.target.value as UserRole })}
                >
                  {USER_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </option>
                  ))}
                </select>
                <p className="a-hint">{ROLE_BLURB[editing.role]}</p>
              </div>
              <div>
                <label htmlFor="edit-status" className="a-label">
                  Status
                </label>
                <select
                  id="edit-status"
                  className="a-select"
                  value={editing.status}
                  onChange={(e) => setEditing({ ...editing, status: e.target.value as StaffRow["status"] })}
                >
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                </select>
                <p className="a-hint">Suspending signs them out of every device immediately.</p>
              </div>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" className="a-btn" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="a-btn a-btn-primary"
                disabled={pending}
                onClick={() =>
                  runAction(
                    () => updateStaffAction({ id: editing.id, name: editing.name, role: editing.role, status: editing.status }),
                    { success: "Staff account updated", onDone: () => setEditing(null) },
                  )
                }
              >
                {pending ? "Saving…" : "Save changes"}
              </button>
            </div>
          </>
        ) : null}
      </Modal>

      <Modal open={resetting !== null} onClose={() => setResetting(null)} title="Reset password" width={420}>
        {resetting ? (
          <>
            <ErrorNote message={error} />
            <p className="mb-2 text-[12px] text-[var(--a-soft)]">
              Sets a new password for <strong>{resetting.email}</strong> and signs them out of every device.
            </p>
            <label htmlFor="reset-password" className="a-label">
              New password
            </label>
            <input
              id="reset-password"
              className="a-input"
              type="text"
              autoFocus
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            {fieldErrors.password ? <p className="a-err">{fieldErrors.password}</p> : null}
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" className="a-btn" onClick={() => setResetting(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="a-btn a-btn-primary"
                disabled={pending || newPassword.length < 10}
                onClick={() =>
                  runAction(() => resetStaffPasswordAction({ id: resetting.id, password: newPassword }), {
                    success: "Password reset and sessions revoked",
                    onDone: () => {
                      setResetting(null);
                      setNewPassword("");
                    },
                  })
                }
              >
                {pending ? "Resetting…" : "Reset password"}
              </button>
            </div>
          </>
        ) : null}
      </Modal>
    </>
  );
}
