"use client";

import { useState, type FormEvent } from "react";
import { formatPKR } from "@/lib/money";
import { Card } from "./ui";
import { ErrorNote, useAction } from "./client-ui";
import { recordRemittanceAction } from "@/app/admin/(panel)/integrations/actions";

/**
 * Records what a courier actually paid.
 *
 * The paste box takes the courier's own remittance sheet ("tracking, amount"
 * per line) because that is the format it arrives in, and retyping forty rows
 * into a form is how reconciliation stops happening.
 */
export function RemittanceForm({
  providers,
  canWrite,
}: {
  providers: { id: string; name: string }[];
  canWrite: boolean;
}) {
  const { pending, error, runAction, show } = useAction();
  const [provider, setProvider] = useState(providers[0]?.id ?? "postex");
  const [reference, setReference] = useState("");
  const [paidOn, setPaidOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState("");
  const [outcome, setOutcome] = useState<{ matched: number; unmatched: string[]; variancePaisa: number } | null>(null);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    runAction(
      () =>
        recordRemittanceAction({
          provider,
          reference,
          paidOn,
          amountRupees: amount,
          note,
          lines,
        }),
      {
        onDone: (data) => {
          setOutcome(data);
          setLines("");
          setAmount("");
          setReference("");
          show(`${data.matched} shipment${data.matched === 1 ? "" : "s"} reconciled`);
        },
      },
    );
  }

  return (
    <Card title="Record a payout">
      <form onSubmit={onSubmit}>
        <div className="grid gap-3 p-3 sm:grid-cols-2">
          <ErrorNote message={error} />
          <div>
            <label htmlFor="r-provider" className="a-label">
              Courier
            </label>
            <select
              id="r-provider"
              className="a-select"
              value={provider}
              disabled={!canWrite}
              onChange={(e) => setProvider(e.target.value)}
            >
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="r-ref" className="a-label">
              Payment reference
            </label>
            <input
              id="r-ref"
              className="a-input"
              value={reference}
              disabled={!canWrite}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Bank transfer reference"
            />
          </div>
          <div>
            <label htmlFor="r-date" className="a-label">
              Date it landed
            </label>
            <input
              id="r-date"
              type="date"
              className="a-input"
              value={paidOn}
              disabled={!canWrite}
              onChange={(e) => setPaidOn(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="r-amount" className="a-label">
              Amount received (Rs)
            </label>
            <input
              id="r-amount"
              type="number"
              min={0}
              step="0.01"
              className="a-input"
              value={amount}
              disabled={!canWrite}
              onChange={(e) => setAmount(e.target.value)}
            />
            <p className="a-hint">What hit the bank, before you split it across parcels.</p>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="r-lines" className="a-label">
              Lines from the courier&rsquo;s sheet
            </label>
            <textarea
              id="r-lines"
              className="a-textarea"
              rows={7}
              value={lines}
              disabled={!canWrite}
              onChange={(e) => setLines(e.target.value)}
              placeholder={"CN123456789, 1850\nCN123456790, 2400"}
            />
            <p className="a-hint">
              One per line: tracking number, then the amount in rupees. Commas, tabs or semicolons all work.
            </p>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="r-note" className="a-label">
              Note
            </label>
            <input
              id="r-note"
              className="a-input"
              value={note}
              disabled={!canWrite}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Deductions, disputes, anything you want to remember"
            />
          </div>
        </div>

        {outcome ? (
          <div className="border-t border-[var(--a-border)] p-3 text-[12px]">
            <p>
              {outcome.matched} line{outcome.matched === 1 ? "" : "s"} matched a shipment.
              {outcome.variancePaisa !== 0 ? (
                <strong className="text-[var(--a-danger)]">
                  {" "}
                  The lines add up to {formatPKR(Math.abs(outcome.variancePaisa))}{" "}
                  {outcome.variancePaisa > 0 ? "less" : "more"} than the amount you entered.
                </strong>
              ) : (
                <span className="text-[var(--a-ok)]"> The lines add up exactly to the amount received.</span>
              )}
            </p>
            {outcome.unmatched.length ? (
              <p className="mt-1 text-[var(--a-danger)]">
                No shipment found for: <span className="a-mono">{outcome.unmatched.join(", ")}</span>
              </p>
            ) : null}
          </div>
        ) : null}

        {canWrite ? (
          <div className="border-t border-[var(--a-border)] p-3">
            <button type="submit" className="a-btn a-btn-primary a-btn-xs" disabled={pending}>
              {pending ? "Recording…" : "Record payout"}
            </button>
          </div>
        ) : null}
      </form>
    </Card>
  );
}
