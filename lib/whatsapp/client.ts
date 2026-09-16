import "server-only";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { whatsappMessages, whatsappTemplates, type WhatsappTemplate } from "@/lib/db/schema";
import { callProvider } from "@/lib/integrations/http";
import { resolveCredentials } from "@/lib/integrations/config";
import { waNumber } from "@/lib/phone";

/**
 * WhatsApp Cloud API.
 *
 * Two rules are enforced here rather than left to callers:
 *
 *  1. Free-form text is only ever attempted inside the 24-hour service window
 *     opened by the customer's own last message. Outside it, an approved
 *     template is the only legal send, so a text request is skipped, logged,
 *     and reported as skipped rather than failing loudly.
 *  2. Every send is recorded in whatsapp_messages with its template name and
 *     billing category, because Meta's pricing changes on 1 October 2026 and
 *     the per-category counts are the only way to see the bill coming.
 */

const GRAPH = "https://graph.facebook.com";
const DEFAULT_VERSION = "v21.0";
export const SERVICE_WINDOW_MS = 24 * 3600_000;

export interface SendResult {
  ok: boolean;
  /** "sent" | "skipped" | "failed" */
  outcome: "sent" | "skipped" | "failed";
  wamid?: string;
  message: string;
  dryRun: boolean;
}

export interface SendContext {
  orderId?: string | null;
  customerId?: string | null;
  trigger?: string;
}

async function ctx() {
  const creds = await resolveCredentials("whatsapp");
  const token = creds.values.accessToken ?? "";
  const version = creds.values.graphVersion || DEFAULT_VERSION;
  return {
    creds,
    token,
    version,
    phoneNumberId: creds.values.phoneNumberId ?? "",
    headers: { Authorization: `Bearer ${token}` },
    secrets: [token, creds.values.appSecret, creds.values.verifyToken].filter(Boolean) as string[],
  };
}

/** Meta wants a bare international number: no plus, no spaces. */
export function toWaNumber(phone: string): string {
  return waNumber(phone.trim());
}

/** True while the customer's own last inbound message is less than 24h old. */
export async function insideServiceWindow(phone: string): Promise<boolean> {
  const since = new Date(Date.now() - SERVICE_WINDOW_MS);
  const [row] = await db
    .select({ id: whatsappMessages.id })
    .from(whatsappMessages)
    .where(
      and(
        eq(whatsappMessages.phone, phone),
        eq(whatsappMessages.direction, "inbound"),
        gte(whatsappMessages.createdAt, since),
      ),
    )
    .limit(1);
  return Boolean(row);
}

async function record(input: {
  phone: string;
  templateName: string;
  category: string;
  body: string;
  status: "sent" | "failed" | "skipped";
  wamid?: string | null;
  error?: string | null;
  dryRun: boolean;
  billable: boolean;
  context: SendContext;
}): Promise<void> {
  try {
    await db
      .insert(whatsappMessages)
      .values({
        direction: "outbound",
        phone: input.phone,
        customerId: input.context.customerId ?? null,
        orderId: input.context.orderId ?? null,
        templateName: input.templateName,
        category: input.category,
        trigger: input.context.trigger ?? "",
        body: input.body.slice(0, 4000),
        wamid: input.wamid ?? null,
        status: input.status,
        error: input.error?.slice(0, 1000) ?? null,
        billable: input.billable,
        dryRun: input.dryRun,
      })
      .onConflictDoNothing({ target: whatsappMessages.wamid });
  } catch (err) {
    console.error("whatsapp message log failed", err);
  }
}

export async function sendTemplate(
  to: string,
  templateName: string,
  variables: string[],
  context: SendContext = {},
): Promise<SendResult> {
  const c = await ctx();
  const phone = toWaNumber(to);
  const template = await findTemplate(templateName);

  if (!c.creds.isEnabled) {
    return { ok: false, outcome: "skipped", message: "WhatsApp is not switched on.", dryRun: c.creds.dryRun };
  }
  if (!template) {
    await record({
      phone,
      templateName,
      category: "utility",
      body: "",
      status: "skipped",
      dryRun: c.creds.dryRun,
      billable: false,
      error: "Template is not registered in MARK.",
      context,
    });
    return {
      ok: false,
      outcome: "skipped",
      dryRun: c.creds.dryRun,
      message: `Template "${templateName}" is not registered. Add it under Integrations → WhatsApp templates once Meta has approved it.`,
    };
  }
  if (template.approvalStatus !== "approved" && !c.creds.dryRun) {
    await record({
      phone,
      templateName,
      category: template.category,
      body: renderTemplate(template, variables),
      status: "skipped",
      dryRun: false,
      billable: false,
      error: `Template is ${template.approvalStatus}, not approved.`,
      context,
    });
    return {
      ok: false,
      outcome: "skipped",
      dryRun: false,
      message: `Template "${templateName}" is ${template.approvalStatus} in Meta. Nothing was sent.`,
    };
  }

  const body = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: phone,
    type: "template",
    template: {
      name: template.name,
      language: { code: template.language },
      components: variables.length
        ? [{ type: "body", parameters: variables.map((text) => ({ type: "text", text })) }]
        : [],
    },
  };

  const result = await callProvider<{ messages?: Array<{ id?: string }> }>({
    provider: "whatsapp",
    operation: "sendTemplate",
    method: "POST",
    url: `${GRAPH}/${c.version}/${c.phoneNumberId}/messages`,
    headers: c.headers,
    body,
    secrets: c.secrets,
    dryRun: c.creds.dryRun,
    dryRunResponse: () => ({ messages: [{ id: `wamid.DRY.${Date.now()}.${Math.random().toString(36).slice(2, 8)}` }] }),
  });

  const rendered = renderTemplate(template, variables);
  if (!result.ok) {
    await record({
      phone,
      templateName: template.name,
      category: template.category,
      body: rendered,
      status: "failed",
      error: result.error,
      dryRun: result.dryRun,
      billable: false,
      context,
    });
    return { ok: false, outcome: "failed", message: result.error, dryRun: result.dryRun };
  }

  const wamid = result.data.messages?.[0]?.id ?? null;
  await record({
    phone,
    templateName: template.name,
    category: template.category,
    body: rendered,
    status: "sent",
    wamid,
    dryRun: result.dryRun,
    // Marketing and utility templates open a billable conversation; service replies do not.
    billable: template.category !== "service",
    context,
  });
  return {
    ok: true,
    outcome: "sent",
    wamid: wamid ?? undefined,
    dryRun: result.dryRun,
    message: result.dryRun ? "Logged in dry-run; nothing left the building." : "Sent.",
  };
}

/**
 * Free-form text. Only legal inside the 24-hour service window, so this
 * checks first and skips rather than burning a failed API call.
 */
export async function sendText(to: string, body: string, context: SendContext = {}): Promise<SendResult> {
  const c = await ctx();
  const phone = toWaNumber(to);

  if (!c.creds.isEnabled) {
    return { ok: false, outcome: "skipped", message: "WhatsApp is not switched on.", dryRun: c.creds.dryRun };
  }
  if (!(await insideServiceWindow(phone))) {
    await record({
      phone,
      templateName: "",
      category: "service",
      body,
      status: "skipped",
      dryRun: c.creds.dryRun,
      billable: false,
      error: "Outside the 24-hour service window.",
      context,
    });
    return {
      ok: false,
      outcome: "skipped",
      dryRun: c.creds.dryRun,
      message: "Outside the 24-hour window — this needs an approved template, so nothing was sent.",
    };
  }

  const result = await callProvider<{ messages?: Array<{ id?: string }> }>({
    provider: "whatsapp",
    operation: "sendText",
    method: "POST",
    url: `${GRAPH}/${c.version}/${c.phoneNumberId}/messages`,
    headers: c.headers,
    body: {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: phone,
      type: "text",
      text: { preview_url: true, body },
    },
    secrets: c.secrets,
    dryRun: c.creds.dryRun,
    dryRunResponse: () => ({ messages: [{ id: `wamid.DRY.${Date.now()}` }] }),
  });

  if (!result.ok) {
    await record({
      phone,
      templateName: "",
      category: "service",
      body,
      status: "failed",
      error: result.error,
      dryRun: result.dryRun,
      billable: false,
      context,
    });
    return { ok: false, outcome: "failed", message: result.error, dryRun: result.dryRun };
  }

  const wamid = result.data.messages?.[0]?.id ?? null;
  await record({
    phone,
    templateName: "",
    category: "service",
    body,
    status: "sent",
    wamid,
    dryRun: result.dryRun,
    // Service replies inside the window are free today. That changes 1 Oct 2026.
    billable: false,
    context,
  });
  return { ok: true, outcome: "sent", wamid: wamid ?? undefined, message: "Sent.", dryRun: result.dryRun };
}

/** One harmless read: the phone number's own profile. */
export async function testConnection(): Promise<{ ok: boolean; message: string; dryRun: boolean }> {
  const c = await ctx();
  const result = await callProvider<Record<string, unknown>>({
    provider: "whatsapp",
    operation: "testConnection",
    url: `${GRAPH}/${c.version}/${c.phoneNumberId}`,
    query: { fields: "display_phone_number,verified_name,quality_rating" },
    headers: c.headers,
    secrets: c.secrets,
    dryRun: c.creds.dryRun,
    dryRunResponse: () => ({
      display_phone_number: "+92 300 0000000",
      verified_name: "MARKORGANIC (dry run)",
      quality_rating: "GREEN",
    }),
  });
  return result.ok
    ? { ok: true, dryRun: result.dryRun, message: `Meta answered: ${JSON.stringify(result.data).slice(0, 300)}` }
    : { ok: false, dryRun: result.dryRun, message: result.error };
}

/* ------------------------------------------------------------ templates */

export async function findTemplate(name: string): Promise<WhatsappTemplate | undefined> {
  const [row] = await db.select().from(whatsappTemplates).where(eq(whatsappTemplates.name, name)).limit(1);
  return row;
}

export async function templateForTrigger(trigger: string): Promise<WhatsappTemplate | undefined> {
  const [row] = await db
    .select()
    .from(whatsappTemplates)
    .where(and(eq(whatsappTemplates.trigger, trigger), eq(whatsappTemplates.isEnabled, true)))
    .limit(1);
  return row;
}

/** {{1}}, {{2}} … replaced positionally, exactly as Meta does it. */
export function renderTemplate(template: WhatsappTemplate, variables: string[]): string {
  return template.body.replace(/\{\{(\d+)\}\}/g, (match, index) => variables[Number(index) - 1] ?? match);
}

/* ----------------------------------------------------------------- cost */

export interface CostRow {
  category: string;
  count: number;
  billable: number;
}

/** Per-category counts for the current month, plus a rough rupee estimate. */
export async function monthlyCost(): Promise<{ rows: CostRow[]; month: string; estimatePaisa: number }> {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);

  const rows = await db
    .select({
      category: whatsappMessages.category,
      count: sql<number>`count(*)::int`,
      billable: sql<number>`count(*) filter (where ${whatsappMessages.billable})::int`,
    })
    .from(whatsappMessages)
    .where(
      and(
        eq(whatsappMessages.direction, "outbound"),
        eq(whatsappMessages.status, "sent"),
        gte(whatsappMessages.createdAt, start),
      ),
    )
    .groupBy(whatsappMessages.category);

  // Indicative Pakistan rates in paisa per billable conversation. Meta publishes
  // the real card per country and changes it; this is a planning number only.
  const RATE_PAISA: Record<string, number> = { utility: 130, marketing: 800, authentication: 200, service: 0 };
  const estimatePaisa = rows.reduce((n, r) => n + r.billable * (RATE_PAISA[r.category] ?? 0), 0);

  return {
    rows,
    month: new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(start),
    estimatePaisa,
  };
}

export async function recentMessagesFor(phone: string, limit = 50) {
  return db
    .select()
    .from(whatsappMessages)
    .where(eq(whatsappMessages.phone, toWaNumber(phone)))
    .orderBy(desc(whatsappMessages.createdAt))
    .limit(limit);
}

export async function unreadInboundCount(): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(whatsappMessages)
    .where(and(eq(whatsappMessages.direction, "inbound"), eq(whatsappMessages.isRead, false)));
  return row?.n ?? 0;
}

export async function markThreadRead(phone: string): Promise<void> {
  await db
    .update(whatsappMessages)
    .set({ isRead: true })
    .where(and(eq(whatsappMessages.phone, toWaNumber(phone)), eq(whatsappMessages.direction, "inbound")));
}
