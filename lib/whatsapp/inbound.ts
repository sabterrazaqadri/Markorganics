import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { customers, whatsappMessages } from "@/lib/db/schema";
import { logCall } from "@/lib/integrations/http";
import { normalizePkPhone } from "@/lib/phone";

/**
 * Inbound Cloud API webhooks: customer messages, and delivery receipts for
 * what MARK sent.
 *
 * Signature verification is mandatory and constant-time. An unverified body
 * is dropped before it is parsed — the endpoint is public, so anything less
 * would let a stranger write rows into the customer's message history.
 */

/** Meta signs the raw request body with the app secret, hex, sha256 prefixed. */
export function verifySignature(rawBody: string, header: string | null, appSecret: string): boolean {
  if (!header || !appSecret) return false;
  const [algorithm, provided] = header.split("=");
  if (algorithm !== "sha256" || !provided) return false;

  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(provided, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

interface CloudApiPayload {
  entry?: Array<{
    changes?: Array<{
      value?: {
        contacts?: Array<{ wa_id?: string; profile?: { name?: string } }>;
        messages?: Array<{
          id?: string;
          from?: string;
          timestamp?: string;
          type?: string;
          text?: { body?: string };
          button?: { text?: string };
          interactive?: { button_reply?: { title?: string }; list_reply?: { title?: string } };
        }>;
        statuses?: Array<{ id?: string; status?: string; recipient_id?: string }>;
      };
    }>;
  }>;
}

export interface WebhookOutcome {
  messages: number;
  statuses: number;
}

export async function processWebhook(payload: unknown): Promise<WebhookOutcome> {
  const data = payload as CloudApiPayload;
  let messages = 0;
  let statuses = 0;

  for (const entry of data.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value ?? {};
      const nameByWaId = new Map(
        (value.contacts ?? []).map((c) => [c.wa_id ?? "", c.profile?.name ?? ""]),
      );

      for (const message of value.messages ?? []) {
        const from = (message.from ?? "").replace(/\D/g, "");
        if (!from) continue;

        const text =
          message.text?.body ??
          message.button?.text ??
          message.interactive?.button_reply?.title ??
          message.interactive?.list_reply?.title ??
          `[${message.type ?? "message"}]`;

        const customerId = await findCustomerId(from);
        const at = message.timestamp ? new Date(Number(message.timestamp) * 1000) : new Date();

        const inserted = await db
          .insert(whatsappMessages)
          .values({
            direction: "inbound",
            phone: from,
            customerId,
            templateName: "",
            category: "service",
            trigger: nameByWaId.get(from) ? `from:${nameByWaId.get(from)}` : "",
            body: text.slice(0, 4000),
            wamid: message.id ?? null,
            status: "received",
            billable: false,
            isRead: false,
            createdAt: at,
          })
          .onConflictDoNothing({ target: whatsappMessages.wamid })
          .returning({ id: whatsappMessages.id });
        if (inserted.length) messages += 1;
      }

      for (const status of value.statuses ?? []) {
        if (!status.id || !status.status) continue;
        const mapped =
          status.status === "delivered" ? "delivered" : status.status === "read" ? "read" : status.status === "failed" ? "failed" : "sent";
        const updated = await db
          .update(whatsappMessages)
          .set({ status: mapped as never })
          .where(eq(whatsappMessages.wamid, status.id))
          .returning({ id: whatsappMessages.id });
        if (updated.length) statuses += 1;
      }
    }
  }

  await logCall({
    provider: "whatsapp",
    direction: "inbound",
    operation: "webhook",
    method: "POST",
    endpoint: "/api/webhooks/whatsapp",
    requestBody: { messages, statuses },
    responseStatus: 200,
    ok: true,
    dryRun: false,
    durationMs: 0,
    error: null,
  });

  return { messages, statuses };
}

async function findCustomerId(waId: string): Promise<string | null> {
  const e164 = normalizePkPhone(`+${waId}`) ?? normalizePkPhone(waId);
  if (!e164) return null;
  const [row] = await db.select({ id: customers.id }).from(customers).where(eq(customers.phone, e164)).limit(1);
  return row?.id ?? null;
}
