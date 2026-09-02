"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Rule, RuleMatch } from "@/lib/admin/rules";
import { ErrorNote, useAction } from "./client-ui";
import { RuleBuilder } from "./RuleBuilder";
import { previewSegmentAction, saveSegmentAction } from "@/app/admin/(panel)/customers/actions";

export interface SegmentFormValues {
  id?: string;
  name: string;
  description: string;
  rulesMatch: RuleMatch;
  rules: Rule[];
}

export const EMPTY_SEGMENT: SegmentFormValues = {
  name: "",
  description: "",
  rulesMatch: "all",
  rules: [{ field: "orders_count", operator: "gte", value: "2" }],
};

/** Segments are live queries — the count updates as the rules change. */
export function SegmentForm({ initial }: { initial: SegmentFormValues }) {
  const router = useRouter();
  const { pending, error, runAction } = useAction();
  const [form, setForm] = useState(initial);
  const [count, setCount] = useState<number | null>(null);
  const [, startPreview] = useTransition();

  useEffect(() => {
    const timer = setTimeout(() => {
      startPreview(async () => {
        const result = await previewSegmentAction(form.rules, form.rulesMatch);
        if (result.ok) setCount(result.data.total);
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [form.rules, form.rulesMatch]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    runAction(() => saveSegmentAction(form), {
      success: form.id ? "Segment saved" : "Segment created",
      refresh: false,
      onDone: (data) => {
        router.push(`/admin/segments/${data.id}`);
        router.refresh();
      },
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <ErrorNote message={error} />

      <section className="a-card space-y-3 p-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="seg-name" className="a-label">
              Name
            </label>
            <input
              id="seg-name"
              className="a-input"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div>
            <label htmlFor="seg-desc" className="a-label">
              Description
            </label>
            <input
              id="seg-desc"
              className="a-input"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
        </div>
      </section>

      <section className="a-card space-y-3 p-3">
        <div className="flex items-center justify-between">
          <h2>Conditions</h2>
          <span className="a-badge a-badge-info">
            {count === null ? "Counting…" : `${count.toLocaleString("en-PK")} customers match`}
          </span>
        </div>
        <RuleBuilder
          resource="customer"
          rules={form.rules}
          match={form.rulesMatch}
          onChange={(rules) => setForm((f) => ({ ...f, rules }))}
          onMatchChange={(rulesMatch) => setForm((f) => ({ ...f, rulesMatch }))}
        />
        <p className="a-hint">
          A segment is a live query, not a frozen list. Anyone who starts matching these rules joins it automatically.
        </p>
      </section>

      <div className="flex gap-2">
        <button type="submit" className="a-btn a-btn-primary" disabled={pending || !form.name.trim() || form.rules.length === 0}>
          {pending ? "Saving…" : form.id ? "Save segment" : "Create segment"}
        </button>
      </div>
    </form>
  );
}
