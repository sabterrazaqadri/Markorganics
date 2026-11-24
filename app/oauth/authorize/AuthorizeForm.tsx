"use client";

import { useState, useTransition } from "react";
import type { AuthorizeParams } from "@/lib/oauth/core";
import { denyAction, sendCodeAction, verifyCodeAction } from "./actions";

export function AuthorizeForm({ params, assistant, brand }: { params: AuthorizeParams; assistant: string; brand: string }) {
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [devCode, setDevCode] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const send = () =>
    start(async () => {
      setError(null);
      const res = await sendCodeAction(params, phone);
      if (!res.ok) return setError(res.message);
      setChallengeId(res.challengeId);
      setDevCode(res.devCode);
      setCode("");
      setStep("code");
    });

  const verify = () =>
    start(async () => {
      setError(null);
      const res = await verifyCodeAction(params, challengeId, code);
      if (!res.ok) return setError(res.message);
      window.location.assign(res.redirectTo);
    });

  const cancel = () =>
    start(async () => {
      const res = await denyAction(params);
      if (res.redirectTo) window.location.assign(res.redirectTo);
    });

  const input = "mt-1 w-full rounded-lg border border-rule bg-paper px-3 py-2.5 text-base outline-none focus:border-ink";
  const primary = "mt-4 w-full rounded-lg bg-ink px-4 py-3 text-sm font-semibold text-paper disabled:opacity-60";

  return (
    <div>
      <h1 className="font-display text-xl font-semibold">Connect {brand} to {assistant}</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Sign in with your WhatsApp number so {assistant} can show products, place cash-on-delivery orders and track them for you.
      </p>
      <p className="mt-1 text-sm text-ink-soft" lang="ur">
        Apna WhatsApp number likhein, hum aapko 6 digits ka code bhejenge.
      </p>

      {step === "phone" ? (
        <form
          className="mt-5"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <label className="text-sm font-medium" htmlFor="phone">
            WhatsApp number
          </label>
          <input
            id="phone"
            className={input}
            inputMode="tel"
            autoComplete="tel"
            placeholder="0300 1234567"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
          <button className={primary} disabled={pending || phone.trim().length < 10}>
            {pending ? "Sending…" : "Send code on WhatsApp"}
          </button>
        </form>
      ) : (
        <form
          className="mt-5"
          onSubmit={(e) => {
            e.preventDefault();
            verify();
          }}
        >
          <label className="text-sm font-medium" htmlFor="code">
            Code sent to {phone}
          </label>
          <input
            id="code"
            className={`${input} tracking-[0.4em]`}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="••••••"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            autoFocus
            required
          />
          {devCode ? <p className="mt-2 text-xs text-ink-soft">Dev mode code: {devCode}</p> : null}
          <button className={primary} disabled={pending || code.length !== 6}>
            {pending ? "Checking…" : "Verify and connect"}
          </button>
          <button
            type="button"
            className="mt-3 w-full text-sm text-ink-soft underline"
            disabled={pending}
            onClick={() => {
              setStep("phone");
              setError(null);
            }}
          >
            Change number or resend code
          </button>
        </form>
      )}

      {error ? (
        <p role="alert" className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <button type="button" className="mt-6 w-full text-xs text-ink-soft underline" onClick={cancel} disabled={pending}>
        Cancel
      </button>
      <p className="mt-4 text-xs text-ink-soft">
        {assistant} will only see your name, number, address and orders with {brand}. You can disconnect it any time from
        {" "}{assistant}&apos;s connector settings.
      </p>
    </div>
  );
}
