"use client";

import { OPERATOR_LABEL, fieldsFor, type Operator, type Rule, type RuleMatch } from "@/lib/admin/rules";

/** Shared rule editor for automatic collections and customer segments. */
export function RuleBuilder({
  resource,
  rules,
  match,
  onChange,
  onMatchChange,
}: {
  resource: "product" | "customer";
  rules: Rule[];
  match: RuleMatch;
  onChange: (rules: Rule[]) => void;
  onMatchChange: (match: RuleMatch) => void;
}) {
  const fields = fieldsFor(resource);

  function patch(index: number, next: Partial<Rule>) {
    onChange(rules.map((r, i) => (i === index ? { ...r, ...next } : r)));
  }

  function addRule() {
    const first = fields[0];
    onChange([...rules, { field: first.key, operator: first.operators[0], value: "" }]);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <label htmlFor="rule-match" className="a-label mb-0">
          Products must match
        </label>
        <select
          id="rule-match"
          className="a-select w-auto"
          value={match}
          onChange={(e) => onMatchChange(e.target.value as RuleMatch)}
        >
          <option value="all">all conditions</option>
          <option value="any">any condition</option>
        </select>
      </div>

      {rules.length === 0 ? (
        <p className="text-[12px] text-[var(--a-soft)]">No conditions yet. Without one, nothing matches.</p>
      ) : null}

      <ul className="space-y-2">
        {rules.map((rule, i) => {
          const def = fields.find((f) => f.key === rule.field) ?? fields[0];
          return (
            <li key={i} className="grid gap-1.5 sm:grid-cols-[1fr_1fr_1fr_auto]">
              <select
                className="a-select"
                aria-label={`Field for condition ${i + 1}`}
                value={rule.field}
                onChange={(e) => {
                  const next = fields.find((f) => f.key === e.target.value)!;
                  patch(i, {
                    field: next.key,
                    operator: next.operators.includes(rule.operator) ? rule.operator : next.operators[0],
                    value: "",
                  });
                }}
              >
                {fields.map((f) => (
                  <option key={f.key} value={f.key}>
                    {f.label}
                  </option>
                ))}
              </select>

              <select
                className="a-select"
                aria-label={`Operator for condition ${i + 1}`}
                value={rule.operator}
                onChange={(e) => patch(i, { operator: e.target.value as Operator })}
              >
                {def.operators.map((op) => (
                  <option key={op} value={op}>
                    {OPERATOR_LABEL[op]}
                  </option>
                ))}
              </select>

              {def.kind === "select" ? (
                <select
                  className="a-select"
                  aria-label={`Value for condition ${i + 1}`}
                  value={rule.value}
                  onChange={(e) => patch(i, { value: e.target.value })}
                >
                  <option value="">Choose…</option>
                  {(def.options ?? []).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="a-input"
                  type={def.kind === "number" || def.kind === "money" ? "number" : "text"}
                  step={def.kind === "money" ? "0.01" : undefined}
                  aria-label={`Value for condition ${i + 1}`}
                  value={rule.value}
                  onChange={(e) => patch(i, { value: e.target.value })}
                />
              )}

              <button
                type="button"
                className="a-btn a-btn-xs a-btn-danger"
                aria-label={`Remove condition ${i + 1}`}
                onClick={() => onChange(rules.filter((_, idx) => idx !== i))}
              >
                Remove
              </button>
              {def.hint ? <p className="a-hint sm:col-span-4">{def.hint}</p> : null}
            </li>
          );
        })}
      </ul>

      <button type="button" className="a-btn a-btn-xs" onClick={addRule}>
        Add condition
      </button>
    </div>
  );
}
