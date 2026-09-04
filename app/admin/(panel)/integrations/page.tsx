import Link from "next/link";
import { requireView } from "@/lib/admin/session";
import { can } from "@/lib/admin/permissions";
import { getIntegrationSettings } from "@/lib/settings";
import { listPublicIntegrations } from "@/lib/integrations/config";
import { encryptionAvailable } from "@/lib/integrations/crypto";
import { PROVIDER_LIST, PROVIDER_SPECS, type ProviderId } from "@/lib/integrations/registry";
import { COURIER_ADAPTERS } from "@/lib/courier";
import { IntegrationCard } from "@/components/admin/IntegrationCard";
import { IntegrationSettingsForm } from "@/components/admin/IntegrationSettingsForm";

export const metadata = { title: "Integrations" };
export const dynamic = "force-dynamic";

const GROUPS: { title: string; kind: "courier" | "messaging" | "analytics"; blurb: string }[] = [
  {
    title: "Couriers",
    kind: "courier",
    blurb: "One interface, many couriers. PostEx is implemented; the rest are scaffolded and refuse live calls until their API documents arrive.",
  },
  { title: "Messaging", kind: "messaging", blurb: "Order lifecycle notifications over the official WhatsApp Cloud API." },
  { title: "Ad platforms", kind: "analytics", blurb: "Browser pixel plus server-side events, deduplicated on a shared event id." },
];

export default async function IntegrationsPage() {
  const ctx = await requireView("integrations:read");
  const canWrite = can(ctx.user.role, "integrations:write");

  const [states, settings] = await Promise.all([listPublicIntegrations(), getIntegrationSettings()]);
  const byProvider = new Map(states.map((s) => [s.provider, s]));

  return (
    <div className="space-y-4">
      {!encryptionAvailable() ? (
        <p
          role="alert"
          className="rounded border border-[#e8b4b0] bg-[var(--a-danger-bg)] px-2.5 py-2 text-[12px] text-[var(--a-danger)]"
        >
          <strong>ENCRYPTION_MASTER_KEY is not set.</strong> Credentials cannot be stored until it is, so every
          integration stays in dry run. Generate one with{" "}
          <code className="a-mono">node -e &quot;console.log(require(&apos;crypto&apos;).randomBytes(32).toString(&apos;hex&apos;))&quot;</code>{" "}
          and put it in the environment.
        </p>
      ) : null}

      {settings.dryRun ? (
        <p className="rounded border border-[#e6cfa0] bg-[var(--a-warn-bg)] px-2.5 py-2 text-[12px] text-[var(--a-warn)]">
          <strong>Global dry run is on.</strong> Every call is logged in full and answered with a realistic fake.
          Nothing reaches a courier, a customer, or an ad platform.
        </p>
      ) : null}

      <IntegrationSettingsForm
        initial={settings}
        canWrite={canWrite}
        couriers={Object.values(COURIER_ADAPTERS).map((a) => ({ id: a.id, name: a.name, verified: a.verified }))}
      />

      {GROUPS.map((group) => (
        <section key={group.kind} className="space-y-3">
          <div>
            <h2 className="text-[13px] font-semibold">{group.title}</h2>
            <p className="text-[12px] text-[var(--a-soft)]">{group.blurb}</p>
          </div>
          {PROVIDER_LIST.filter((spec) => spec.kind === group.kind).map((spec) => {
            const state = byProvider.get(spec.id);
            if (!state) return null;
            return (
              <IntegrationCard
                key={spec.id}
                spec={PROVIDER_SPECS[spec.id as ProviderId]}
                state={state}
                canWrite={canWrite}
                globalDryRun={settings.dryRun}
              />
            );
          })}
        </section>
      ))}

      <p className="text-[11.5px] text-[var(--a-soft)]">
        Every call made by any of these is on the <Link href="/admin/integrations/log" className="a-btn-link">call log</Link>, and
        everything queued for retry is on <Link href="/admin/jobs" className="a-btn-link">jobs</Link>.
      </p>
    </div>
  );
}
