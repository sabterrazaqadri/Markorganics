"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/admin/session";
import { audit } from "@/lib/admin/audit";
import { ActionError, run, type ActionResult } from "@/lib/admin/result";
import { getSettings, writeSetting, WHATSAPP_TRIGGERS } from "@/lib/settings";
import { revalidateSettings } from "@/lib/admin/revalidate";
import {
  INTEGRATIONS_TAG,
  recordTestResult,
  resolveCredentials,
  saveIntegration,
} from "@/lib/integrations/config";
import { isProvider, PROVIDER_SPECS, type ProviderId } from "@/lib/integrations/registry";
import { encryptionAvailable } from "@/lib/integrations/crypto";
import { getCourier } from "@/lib/courier";
import { deleteMapping, saveMapping } from "@/lib/courier/cities";
import { parseRemittanceLines, recordRemittance } from "@/lib/courier/cod";
import { testConnection as testWhatsapp } from "@/lib/whatsapp/client";
import { testConnection as testMeta } from "@/lib/analytics/meta";
import { testConnection as testGoogle } from "@/lib/analytics/google";
import { testConnection as testTiktok } from "@/lib/analytics/tiktok";
import { DEFAULT_WHATSAPP_TEMPLATES } from "@/lib/whatsapp/defaults";
import { db } from "@/lib/db";
import { whatsappTemplates } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * Owner-only. Every action here either stores an encrypted credential or
 * flips a switch that decides whether real money moves, so nothing in this
 * file is reachable below the Owner role.
 */

function refresh() {
  revalidateTag(INTEGRATIONS_TAG);
  revalidatePath("/admin/integrations");
  revalidatePath("/admin");
}

function requireProvider(value: string): ProviderId {
  if (!isProvider(value)) throw new ActionError(`Unknown provider "${value}".`);
  return value;
}

/* ------------------------------------------------------------ credentials */

export async function saveIntegrationAction(input: {
  provider: string;
  isEnabled: boolean;
  dryRun: boolean;
  config: Record<string, string>;
  secrets: Record<string, string>;
  clearSecrets?: string[];
}): Promise<ActionResult<null>> {
  return run(async () => {
    const ctx = await requirePermission("integrations:write");
    const provider = requireProvider(input.provider);
    const spec = PROVIDER_SPECS[provider];

    const typedSecrets = Object.entries(input.secrets ?? {}).filter(([, v]) => v.trim() !== "");
    if (typedSecrets.length > 0 && !encryptionAvailable()) {
      throw new ActionError(
        "ENCRYPTION_MASTER_KEY is not set, so credentials cannot be encrypted. Set it in the environment and try again — nothing was saved.",
      );
    }
    if (input.isEnabled && !spec.verified) {
      throw new ActionError(
        `${spec.name} is UNVERIFIED — its request shapes have not been confirmed, so it cannot be switched on. Supply the integration document first.`,
      );
    }

    await saveIntegration({
      provider,
      isEnabled: input.isEnabled,
      dryRun: input.dryRun,
      config: input.config,
      secrets: input.secrets,
      clearSecrets: input.clearSecrets,
    });

    await audit(ctx, {
      action: "integration.save",
      entityType: "integration",
      entityId: provider,
      entityLabel: spec.name,
      // Values are never logged; only which fields were touched.
      after: {
        isEnabled: input.isEnabled,
        dryRun: input.dryRun,
        secretsChanged: typedSecrets.map(([k]) => k),
        cleared: input.clearSecrets ?? [],
      },
    });

    refresh();
    return null;
  });
}

/** One harmless read per provider, reported back exactly as it came. */
export async function testIntegrationAction(provider: string): Promise<ActionResult<{ ok: boolean; message: string; dryRun: boolean }>> {
  return run(async () => {
    const ctx = await requirePermission("integrations:write");
    const id = requireProvider(provider);

    let outcome: { ok: boolean; message: string; dryRun: boolean };
    const courier = getCourier(id);
    if (courier) {
      const result = await courier.testConnection();
      outcome = result.ok
        ? { ok: true, message: result.data, dryRun: result.dryRun }
        : { ok: false, message: result.error, dryRun: result.dryRun };
    } else if (id === "whatsapp") {
      outcome = await testWhatsapp();
    } else if (id === "meta") {
      outcome = await testMeta();
    } else if (id === "google") {
      outcome = await testGoogle();
    } else if (id === "tiktok") {
      outcome = await testTiktok();
    } else {
      throw new ActionError(`No connection test exists for "${provider}".`);
    }

    await recordTestResult(id, outcome.ok, outcome.message);
    await audit(ctx, {
      action: "integration.test",
      entityType: "integration",
      entityId: id,
      after: { ok: outcome.ok, dryRun: outcome.dryRun },
    });
    refresh();
    return outcome;
  });
}

/* --------------------------------------------------------------- settings */

const integrationSettingsSchema = z.object({
  dryRun: z.boolean(),
  defaultCourier: z.string().min(1).max(40),
  restockOnReturn: z.boolean(),
  codRemittanceDays: z.coerce.number().int().min(1).max(120),
  abandonedDelayHours: z.coerce.number().int().min(1).max(168),
  consentBanner: z.boolean(),
  whatsappTriggers: z.record(z.string(), z.boolean()),
});

export async function saveIntegrationSettingsAction(
  input: z.input<typeof integrationSettingsSchema>,
): Promise<ActionResult<null>> {
  return run(async () => {
    const ctx = await requirePermission("integrations:write");
    const values = integrationSettingsSchema.parse(input);
    const before = (await getSettings()).integrations;

    const triggers: Record<string, boolean> = {};
    for (const trigger of WHATSAPP_TRIGGERS) triggers[trigger] = Boolean(values.whatsappTriggers[trigger]);

    await writeSetting("integrations", { ...values, whatsappTriggers: triggers });
    await audit(ctx, {
      action: "settings.integrations",
      entityType: "settings",
      entityId: "integrations",
      before: { dryRun: before.dryRun },
      after: { dryRun: values.dryRun, defaultCourier: values.defaultCourier },
    });

    revalidateSettings();
    refresh();
    return null;
  });
}

/* ---------------------------------------------------------- city mapping */

export async function saveCityMappingAction(input: {
  provider: string;
  markCity: string;
  courierCityId: string;
  courierCityName: string;
}): Promise<ActionResult<null>> {
  return run(async () => {
    const ctx = await requirePermission("integrations:write");
    const provider = requireProvider(input.provider);
    if (!input.markCity.trim()) throw new ActionError("Pick a city first.");
    if (!input.courierCityId.trim()) throw new ActionError("Pick the courier's city before saving.");

    await saveMapping({
      provider,
      markCity: input.markCity,
      courierCityId: input.courierCityId,
      courierCityName: input.courierCityName,
      userId: ctx.user.id,
    });
    await audit(ctx, {
      action: "integration.city_map",
      entityType: "courier_city",
      entityId: `${provider}:${input.markCity}`,
      after: { courierCityId: input.courierCityId },
    });
    revalidatePath("/admin/integrations/cities");
    return null;
  });
}

export async function deleteCityMappingAction(provider: string, markCity: string): Promise<ActionResult<null>> {
  return run(async () => {
    const ctx = await requirePermission("integrations:write");
    const id = requireProvider(provider);
    await deleteMapping(id, markCity);
    await audit(ctx, { action: "integration.city_unmap", entityType: "courier_city", entityId: `${id}:${markCity}` });
    revalidatePath("/admin/integrations/cities");
    return null;
  });
}

/* ------------------------------------------------------------------- COD */

export async function recordRemittanceAction(input: {
  provider: string;
  reference: string;
  paidOn: string;
  amountRupees: string | number;
  note?: string;
  lines: string;
}): Promise<ActionResult<{ matched: number; unmatched: string[]; variancePaisa: number }>> {
  return run(async () => {
    const ctx = await requirePermission("integrations:write");
    const provider = requireProvider(input.provider);

    const amount = Number(input.amountRupees);
    if (!Number.isFinite(amount) || amount <= 0) throw new ActionError("Enter the amount that actually landed.");

    const paidOn = new Date(input.paidOn);
    if (Number.isNaN(paidOn.getTime())) throw new ActionError("Pick the date the payment landed.");

    const { lines, errors } = parseRemittanceLines(input.lines);
    if (errors.length) throw new ActionError(errors.slice(0, 3).join(" "));
    if (lines.length === 0) throw new ActionError("Paste at least one line of \"tracking number, amount\".");

    const result = await recordRemittance({
      provider,
      reference: input.reference,
      paidOn,
      amountPaisa: Math.round(amount * 100),
      note: input.note,
      lines,
      userId: ctx.user.id,
    });

    await audit(ctx, {
      action: "cod.remittance",
      entityType: "cod_remittance",
      entityId: result.id,
      entityLabel: `${provider} ${input.reference}`,
      after: { matched: result.matched, unmatched: result.unmatched.length, variancePaisa: result.variancePaisa },
    });

    revalidatePath("/admin/integrations/cod");
    return { matched: result.matched, unmatched: result.unmatched, variancePaisa: result.variancePaisa };
  });
}

/* ------------------------------------------------------ WhatsApp templates */

const templateSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  language: z.string().trim().min(2).max(10),
  category: z.enum(["utility", "marketing", "authentication", "service"]),
  body: z.string().trim().max(2000),
  variables: z.string().trim().max(500),
  approvalStatus: z.enum(["approved", "pending", "rejected", "local"]),
  trigger: z.string().trim().max(50),
  isEnabled: z.boolean(),
});

export async function saveWhatsappTemplateAction(
  input: z.input<typeof templateSchema>,
): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const ctx = await requirePermission("integrations:write");
    const values = templateSchema.parse(input);
    const variables = values.variables.split(",").map((v) => v.trim()).filter(Boolean);

    const row = {
      name: values.name,
      language: values.language,
      category: values.category,
      body: values.body,
      variables,
      approvalStatus: values.approvalStatus,
      trigger: values.trigger || null,
      isEnabled: values.isEnabled,
      updatedAt: new Date(),
    };

    let id = values.id;
    if (id) {
      await db.update(whatsappTemplates).set(row).where(eq(whatsappTemplates.id, id));
    } else {
      const [created] = await db.insert(whatsappTemplates).values(row).returning({ id: whatsappTemplates.id });
      id = created.id;
    }

    await audit(ctx, {
      action: values.id ? "whatsapp.template_update" : "whatsapp.template_create",
      entityType: "whatsapp_template",
      entityId: id,
      entityLabel: values.name,
      after: { approvalStatus: values.approvalStatus, trigger: values.trigger, isEnabled: values.isEnabled },
    });
    revalidatePath("/admin/integrations/whatsapp");
    return { id: id! };
  });
}

export async function deleteWhatsappTemplateAction(id: string): Promise<ActionResult<null>> {
  return run(async () => {
    const ctx = await requirePermission("integrations:write");
    await db.delete(whatsappTemplates).where(eq(whatsappTemplates.id, id));
    await audit(ctx, { action: "whatsapp.template_delete", entityType: "whatsapp_template", entityId: id });
    revalidatePath("/admin/integrations/whatsapp");
    return null;
  });
}

/** Creates the six lifecycle templates so there is something to submit to Meta. */
export async function seedWhatsappTemplatesAction(): Promise<ActionResult<{ created: number }>> {
  return run(async () => {
    const ctx = await requirePermission("integrations:write");
    let created = 0;
    for (const template of DEFAULT_WHATSAPP_TEMPLATES) {
      const rows = await db
        .insert(whatsappTemplates)
        .values({
          name: template.name,
          language: template.language,
          category: template.category,
          body: template.body,
          variables: template.variables,
          trigger: template.trigger,
          approvalStatus: "local",
          isEnabled: false,
        })
        .onConflictDoNothing({ target: [whatsappTemplates.name, whatsappTemplates.language] })
        .returning({ id: whatsappTemplates.id });
      if (rows.length) created += 1;
    }
    await audit(ctx, { action: "whatsapp.template_seed", entityType: "whatsapp_template", after: { created } });
    revalidatePath("/admin/integrations/whatsapp");
    return { created };
  });
}

/* -------------------------------------------------------------- diagnostics */

/** Shows the Owner exactly which fields a provider resolved, values redacted. */
export async function inspectProviderAction(provider: string): Promise<ActionResult<{ configured: boolean; dryRun: boolean; fields: string[] }>> {
  return run(async () => {
    await requirePermission("integrations:read");
    const id = requireProvider(provider);
    const creds = await resolveCredentials(id);
    return {
      configured: creds.configured,
      dryRun: creds.dryRun,
      fields: Object.entries(creds.values)
        .filter(([, v]) => Boolean(v))
        .map(([k]) => k),
    };
  });
}
