"use client";

import { useState, type FormEvent } from "react";
import type { PublicIntegration } from "@/lib/integrations/config";
import type { ProviderSpec } from "@/lib/integrations/registry";
import { Card } from "./ui";
import { ErrorNote, useAction } from "./client-ui";
import { saveIntegrationAction, testIntegrationAction } from "@/app/admin/(panel)/integrations/actions";

/**
 * One provider.
 *
 * Secret inputs start empty and show the stored last-4 as their placeholder:
 * a blank field means "leave it alone", which is the only safe default when
 * the real value can never be sent back to the browser.
 */
export function IntegrationCard({
  spec,
  state,
  canWrite,
  globalDryRun,
}: {
  spec: ProviderSpec;
  state: PublicIntegration;
  canWrite: boolean;
  globalDryRun: boolean;
}) {
  const { pending, error, runAction, show } = useAction();
  const [isEnabled, setEnabled] = useState(state.isEnabled);
  const [dryRun, setDryRun] = useState(state.dryRun);
  const [config, setConfig] = useState<Record<string, string>>(state.config);
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [cleared, setCleared] = useState<string[]>([]);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    runAction(
      () => saveIntegrationAction({ provider: spec.id, isEnabled, dryRun, config, secrets, clearSecrets: cleared }),
      {
        success: `${spec.name} saved`,
        onDone: () => {
          setSecrets({});
          setCleared([]);
        },
      },
    );
  }

  const status = !state.configured
    ? { label: "Not connected", cls: "a-badge-neutral" }
    : !isEnabled
      ? { label: "Connected, switched off", cls: "a-badge-warn" }
      : state.lastErrorAt && (!state.lastSuccessAt || state.lastErrorAt > state.lastSuccessAt)
        ? { label: "Failing", cls: "a-badge-danger" }
        : { label: "Connected", cls: "a-badge-ok" };

  return (
    <Card
      title={
        <span className="flex flex-wrap items-center gap-2">
          {spec.name}
          <span className={`a-badge ${status.cls}`}>{status.label}</span>
          {!spec.verified ? <span className="a-badge a-badge-warn">UNVERIFIED</span> : null}
          {state.effectiveDryRun ? <span className="a-badge a-badge-info">Dry run</span> : null}
        </span>
      }
    >
      <form onSubmit={onSubmit}>
        <div className="space-y-3 p-3">
          <ErrorNote message={error} />
          <p className="text-[12px] text-[var(--a-soft)]">{spec.blurb}</p>

          {!spec.verified && spec.todo ? (
            <details className="rounded border border-[#e6cfa0] bg-[var(--a-warn-bg)] px-2.5 py-2 text-[12px] text-[var(--a-warn)]">
              <summary className="cursor-pointer font-semibold">
                This adapter cannot be switched on yet. Here is exactly what it needs.
              </summary>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {spec.todo.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </details>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            {spec.fields.map((field) => {
              const id = `${spec.id}-${field.key}`;
              if (field.secret) {
                const stored = state.masked[field.key];
                const isCleared = cleared.includes(field.key);
                return (
                  <div key={field.key}>
                    <label htmlFor={id} className="a-label">
                      {field.label}
                      {field.optional ? <span className="font-normal text-[var(--a-soft)]"> (optional)</span> : null}
                    </label>
                    <input
                      id={id}
                      type="password"
                      autoComplete="off"
                      className="a-input"
                      disabled={!canWrite || isCleared}
                      placeholder={stored ? `Stored ${stored} — type to replace` : "Not set"}
                      value={secrets[field.key] ?? ""}
                      onChange={(e) => setSecrets((s) => ({ ...s, [field.key]: e.target.value }))}
                    />
                    <p className="a-hint">
                      {field.hint ?? "Stored encrypted. Only the last four characters are ever shown."}
                      {stored && canWrite ? (
                        <>
                          {" "}
                          <button
                            type="button"
                            className="a-btn-link text-[var(--a-danger)]"
                            onClick={() =>
                              setCleared((c) => (c.includes(field.key) ? c.filter((k) => k !== field.key) : [...c, field.key]))
                            }
                          >
                            {isCleared ? "Keep it" : "Remove"}
                          </button>
                        </>
                      ) : null}
                    </p>
                  </div>
                );
              }
              return (
                <div key={field.key}>
                  <label htmlFor={id} className="a-label">
                    {field.label}
                  </label>
                  <input
                    id={id}
                    className="a-input"
                    disabled={!canWrite}
                    placeholder={field.placeholder}
                    value={config[field.key] ?? ""}
                    onChange={(e) => setConfig((c) => ({ ...c, [field.key]: e.target.value }))}
                  />
                  {field.hint ? <p className="a-hint">{field.hint}</p> : null}
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-4 border-t border-[var(--a-border)] pt-3">
            <label className="flex items-center gap-2 text-[12.5px]">
              <input
                type="checkbox"
                checked={isEnabled}
                disabled={!canWrite || !spec.verified}
                onChange={(e) => setEnabled(e.target.checked)}
              />
              Switched on
            </label>
            <label className="flex items-center gap-2 text-[12.5px]">
              <input type="checkbox" checked={dryRun} disabled={!canWrite} onChange={(e) => setDryRun(e.target.checked)} />
              Dry run
            </label>
            {globalDryRun ? (
              <span className="text-[11.5px] text-[var(--a-warn)]">
                The global dry-run switch is on, so this provider stays in dry run whatever this box says.
              </span>
            ) : null}
          </div>

          {state.lastTestAt ? (
            <p className={`text-[11.5px] ${state.lastTestOk ? "text-[var(--a-ok)]" : "text-[var(--a-danger)]"}`}>
              Last test {state.lastTestOk ? "passed" : "failed"}: {state.lastTestMessage}
            </p>
          ) : null}
          {state.lastErrorMessage ? (
            <p className="text-[11.5px] text-[var(--a-danger)]">Last error: {state.lastErrorMessage}</p>
          ) : null}
          {testResult ? (
            <pre
              className={`a-mono max-h-40 overflow-auto whitespace-pre-wrap rounded border p-2 text-[11.5px] ${
                testResult.ok
                  ? "border-[var(--a-border)] text-[var(--a-ok)]"
                  : "border-[#e8b4b0] bg-[var(--a-danger-bg)] text-[var(--a-danger)]"
              }`}
            >
              {testResult.message}
            </pre>
          ) : null}
        </div>

        {canWrite ? (
          <div className="flex flex-wrap gap-2 border-t border-[var(--a-border)] p-3">
            <button type="submit" className="a-btn a-btn-primary a-btn-xs" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              className="a-btn a-btn-xs"
              disabled={pending}
              onClick={() =>
                runAction(() => testIntegrationAction(spec.id), {
                  onDone: (data) => {
                    setTestResult({ ok: data.ok, message: data.message });
                    show(data.ok ? "Connection test passed" : "Connection test failed");
                  },
                })
              }
            >
              Test connection
            </button>
            {spec.docs ? (
              <a href={spec.docs} target="_blank" rel="noopener" className="a-btn a-btn-xs">
                Documentation ↗
              </a>
            ) : null}
          </div>
        ) : null}
      </form>
    </Card>
  );
}
