import "server-only";

import { sendTemplate } from "@/lib/whatsapp/client";
import { isReviewPhone } from "@/lib/oauth/core";

export const OTP_TEMPLATE_NAME = process.env.WHATSAPP_OTP_TEMPLATE || "mark_login_otp";

/** Local development only: show the code on screen instead of needing WhatsApp. */
export const showOtpOnScreen = () => process.env.NODE_ENV !== "production" && process.env.OAUTH_DEV_SHOW_OTP === "1";

export type OtpDelivery = { ok: true; devCode?: string } | { ok: false; message: string };

export async function deliverLoginOtp(phone: string, code: string): Promise<OtpDelivery> {
  if (showOtpOnScreen()) return { ok: true, devCode: code };
  // The reviewer test number already knows its fixed code.
  if (isReviewPhone(phone)) return { ok: true };

  const result = await sendTemplate(phone, OTP_TEMPLATE_NAME, [code], { trigger: "login_otp" }, { copyCode: code });
  if (!result.ok) {
    console.error("login OTP not sent", result.message);
    return { ok: false, message: "We could not send the WhatsApp code right now. Please try again in a few minutes." };
  }
  if (result.dryRun) {
    // A dry-run "send" never reaches the phone, so the customer could never sign in.
    console.error("login OTP skipped: WhatsApp integration is in dry run");
    return { ok: false, message: "WhatsApp sign-in is not switched on yet. Please contact us on WhatsApp." };
  }
  return { ok: true };
}
