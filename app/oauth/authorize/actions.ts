"use server";

import { headers } from "next/headers";
import { normalizePkPhone } from "@/lib/phone";
import { rateLimit } from "@/lib/rate-limit";
import {
  createOtp,
  issueAuthorizationCode,
  otpCooldownSeconds,
  validateAuthorize,
  verifyOtp,
  type AuthorizeParams,
} from "@/lib/oauth/core";
import { deliverLoginOtp } from "@/lib/oauth/otp-delivery";

async function ip(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim();
}

export type SendCodeResult =
  | { ok: true; challengeId: string; phone: string; devCode?: string }
  | { ok: false; message: string };

export async function sendCodeAction(params: AuthorizeParams, rawPhone: string): Promise<SendCodeResult> {
  const valid = await validateAuthorize(params);
  if (!valid.ok) return { ok: false, message: valid.message };

  const phone = normalizePkPhone(rawPhone ?? "");
  if (!phone) return { ok: false, message: "Enter a Pakistani WhatsApp number like 0300 1234567." };

  if (!rateLimit(`otp:ip:${await ip()}`, 10, 10 * 60_000).ok || !rateLimit(`otp:phone:${phone}`, 4, 10 * 60_000).ok) {
    return { ok: false, message: "Too many codes requested. Please wait 10 minutes and try again." };
  }
  const wait = await otpCooldownSeconds(phone);
  if (wait > 0) return { ok: false, message: `Please wait ${wait} seconds before requesting another code.` };

  const { challengeId, code } = await createOtp(phone);
  const sent = await deliverLoginOtp(phone, code);
  if (!sent.ok) return { ok: false, message: sent.message };
  return { ok: true, challengeId, phone, devCode: sent.devCode };
}

export type VerifyCodeResult = { ok: true; redirectTo: string } | { ok: false; message: string };

export async function verifyCodeAction(params: AuthorizeParams, challengeId: string, code: string): Promise<VerifyCodeResult> {
  const valid = await validateAuthorize(params);
  if (!valid.ok) return { ok: false, message: valid.message };
  if (!rateLimit(`otp:verify:${await ip()}`, 30, 10 * 60_000).ok) {
    return { ok: false, message: "Too many attempts. Please wait a few minutes." };
  }
  const checked = await verifyOtp(challengeId, (code ?? "").replace(/\D/g, ""));
  if (!checked.ok) return { ok: false, message: checked.message };
  return { ok: true, redirectTo: await issueAuthorizationCode(valid.params, checked.phone) };
}

export async function denyAction(params: AuthorizeParams): Promise<{ redirectTo: string | null }> {
  const valid = await validateAuthorize(params);
  if (!valid.ok) return { redirectTo: valid.redirect ?? null };
  const u = new URL(valid.params.redirectUri);
  u.searchParams.set("error", "access_denied");
  u.searchParams.set("error_description", "The customer cancelled sign-in.");
  if (valid.params.state) u.searchParams.set("state", valid.params.state);
  return { redirectTo: u.toString() };
}
