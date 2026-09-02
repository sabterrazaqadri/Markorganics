"use client";

import { useActionState } from "react";
import { login, type LoginState } from "@/app/admin/login/actions";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  return (
    <form action={action} className="mt-4 space-y-3">
      {state.error ? (
        <p role="alert" className="rounded border border-[#e8b4b0] bg-[var(--a-danger-bg)] px-2.5 py-1.5 text-[12px] text-[var(--a-danger)]">
          {state.error}
        </p>
      ) : null}
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <div>
        <label htmlFor="email" className="a-label">
          Email
        </label>
        <input id="email" name="email" type="email" className="a-input" autoComplete="username" autoFocus required />
      </div>
      <div>
        <label htmlFor="password" className="a-label">
          Password
        </label>
        <input id="password" name="password" type="password" className="a-input" autoComplete="current-password" required />
      </div>
      <button type="submit" className="a-btn a-btn-primary w-full" disabled={pending}>
        {pending ? "Checking…" : "Sign in"}
      </button>
    </form>
  );
}
