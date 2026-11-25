"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { AuthorizeParams } from "@/lib/oauth/core";
import { denyAction, pollReverseAction, sendCodeAction, startReverseAction, verifyCodeAction } from "./actions";

type Step = "start" | "reverse" | "phone" | "code";

interface Reverse {
  challengeId: string;
  message: string;
  waLink: string;
  number: string;
}

export function AuthorizeForm({ params, assistant, brand }: { params: AuthorizeParams; assistant: string; brand: string }) {
  const [step, setStep] = useState<Step>("start");
  const [reverse, setReverse] = useState<Reverse | null>(null);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [devCode, setDevCode] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  const polling = useRef(false);

  /* Reverse OTP: wait for the customer's WhatsApp message to arrive at our webhook. */
  useEffect(() => {
    if (step !== "reverse" || !reverse) return;
    let stopped = false;
    const startedAt = Date.now();
    const tick = async () => {
      if (stopped || polling.current) return;
      polling.current = true;
      try {
        const res = await pollReverseAction(params, reverse.challengeId);
        if (res.state === "done") {
          stopped = true;
          window.location.assign(res.redirectTo);
        } else if (res.state === "expired" || Date.now() - startedAt > 10 * 60_000) {
          stopped = true;
          setError("This login code expired. Tap the button again to get a new one.");
          setStep("start");
        }
      } catch {
        /* network blip: keep waiting */
      } finally {
        polling.current = false;
      }
    };
    const id = window.setInterval(tick, 2000);
    const onFocus = () => void tick();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      stopped = true;
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [step, reverse, params]);

  const beginReverse = () =>
    start(async () => {
      setError(null);
      const res = await startReverseAction(params);
      if (!res.ok) return setError(res.message);
      setReverse({ challengeId: res.challengeId, message: res.message, waLink: res.waLink, number: res.number });
      setStep("reverse");
      window.open(res.waLink, "_blank", "noopener");
    });

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

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked: the text is visible to copy by hand */
    }
  };

  const input = "mt-1 w-full rounded-lg border border-rule bg-paper px-3 py-2.5 text-base outline-none focus:border-ink";
  const primary = "mt-4 block w-full rounded-lg bg-ink px-4 py-3 text-center text-sm font-semibold text-paper disabled:opacity-60";
  const whatsapp = "mt-4 block w-full rounded-lg bg-[#1f8a4c] px-4 py-3 text-center text-sm font-semibold text-white disabled:opacity-60";
  const link = "mt-3 w-full text-sm text-ink-soft underline";

  return (
    <div>
      <h1 className="font-display text-xl font-semibold">
        Connect {brand} to {assistant}
      </h1>
      <p className="mt-2 text-sm text-ink-soft">
        Verify your WhatsApp number once so {assistant} can show products, place cash-on-delivery orders and track them for you.
      </p>

      {step === "start" ? (
        <div className="mt-5">
          <p className="text-sm text-ink-soft" lang="ur">
            Neeche button dabayein, WhatsApp khulega aur ek message pehle se likha hoga. Bas <strong>Send</strong> dabayein, aur
            phir is page par wapas aa jayein.
          </p>
          <button type="button" className={whatsapp} onClick={beginReverse} disabled={pending}>
            {pending ? "Opening WhatsApp…" : "Verify with WhatsApp"}
          </button>
          <button type="button" className={link} disabled={pending} onClick={() => (setError(null), setStep("phone"))}>
            I have a login code
          </button>
        </div>
      ) : null}

      {step === "reverse" && reverse ? (
        <div className="mt-5">
          <ol className="list-decimal space-y-1 pl-5 text-sm text-ink-soft">
            <li>WhatsApp mein yeh message bhejein (Send dabayein):</li>
          </ol>
          <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-rule bg-paper px-3 py-2.5">
            <code className="text-base font-semibold tracking-wide">{reverse.message}</code>
            <button type="button" className="text-xs underline" onClick={() => copy(reverse.message)}>
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="mt-2 text-xs text-ink-soft">
            To: +{reverse.number}. Computer par hain? Phone se is number par yahi message bhej dein.
          </p>
          <a className={whatsapp} href={reverse.waLink} target="_blank" rel="noopener noreferrer">
            Open WhatsApp again
          </a>
          <p className="mt-4 flex items-center gap-2 text-sm text-ink-soft" role="status">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[#1f8a4c]" />
            Waiting for your message… this page will continue by itself.
          </p>
        </div>
      ) : null}

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
            {pending ? "Please wait…" : "Continue"}
          </button>
          <button type="button" className={link} disabled={pending} onClick={() => (setError(null), setStep("start"))}>
            Back
          </button>
        </form>
      ) : null}

      {step === "code" ? (
        <form
          className="mt-5"
          onSubmit={(e) => {
            e.preventDefault();
            verify();
          }}
        >
          <label className="text-sm font-medium" htmlFor="code">
            Code for {phone}
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
          <button type="button" className={link} disabled={pending} onClick={() => (setError(null), setStep("phone"))}>
            Change number or resend code
          </button>
        </form>
      ) : null}

      {error ? (
        <p role="alert" className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <button type="button" className="mt-6 w-full text-xs text-ink-soft underline" onClick={cancel} disabled={pending}>
        Cancel
      </button>
      <p className="mt-4 text-xs text-ink-soft">
        {assistant} will only see your name, number, address and orders with {brand}. You can disconnect it any time from{" "}
        {assistant}&apos;s connector settings.
      </p>
    </div>
  );
}
