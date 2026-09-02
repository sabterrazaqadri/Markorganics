import { sql, type SQL } from "drizzle-orm";
import { z } from "zod";

/**
 * Rule engine shared by automatic collections and customer segments.
 *
 * Rules are stored as JSON and compiled to SQL here, so a segment is always a
 * live query rather than a frozen list, and an automatic collection can be
 * re-evaluated the moment a product is saved.
 */

export const OPERATORS = [
  "eq",
  "neq",
  "gt",
  "gte",
  "lt",
  "lte",
  "contains",
  "not_contains",
] as const;
export type Operator = (typeof OPERATORS)[number];

export const OPERATOR_LABEL: Record<Operator, string> = {
  eq: "is",
  neq: "is not",
  gt: "is greater than",
  gte: "is at least",
  lt: "is less than",
  lte: "is at most",
  contains: "contains",
  not_contains: "does not contain",
};

export const ruleSchema = z.object({
  field: z.string().min(1).max(40),
  operator: z.enum(OPERATORS),
  value: z.string().max(120),
});
export type Rule = z.infer<typeof ruleSchema>;

export const rulesSchema = z.array(ruleSchema).max(15);
export type RuleMatch = "all" | "any";

export interface FieldDef {
  key: string;
  label: string;
  /** How the value input is rendered and parsed. */
  kind: "text" | "number" | "money" | "select";
  options?: { value: string; label: string }[];
  operators: Operator[];
  hint?: string;
  /** Compiles one rule to a boolean SQL expression. */
  build: (operator: Operator, value: string) => SQL | null;
}

function num(value: string): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Rupees typed by a human become paisa in the query. */
function moneyPaisa(value: string): number | null {
  const n = num(value);
  return n === null ? null : Math.round(n * 100);
}

function compare(column: SQL, operator: Operator, n: number): SQL | null {
  switch (operator) {
    case "eq":
      return sql`${column} = ${n}`;
    case "neq":
      return sql`${column} <> ${n}`;
    case "gt":
      return sql`${column} > ${n}`;
    case "gte":
      return sql`${column} >= ${n}`;
    case "lt":
      return sql`${column} < ${n}`;
    case "lte":
      return sql`${column} <= ${n}`;
    default:
      return null;
  }
}

function textCompare(column: SQL, operator: Operator, value: string): SQL | null {
  switch (operator) {
    case "eq":
      return sql`lower(${column}) = lower(${value})`;
    case "neq":
      return sql`lower(${column}) <> lower(${value})`;
    case "contains":
      return sql`${column} ILIKE ${`%${value}%`}`;
    case "not_contains":
      return sql`${column} NOT ILIKE ${`%${value}%`}`;
    default:
      return null;
  }
}

const NUMERIC_OPS: Operator[] = ["eq", "neq", "gt", "gte", "lt", "lte"];
const TEXT_OPS: Operator[] = ["eq", "neq", "contains", "not_contains"];

/* --------------------------------------------------- product / collection */

/** All expressions are written against an outer `products p` alias. */
export const PRODUCT_FIELDS: FieldDef[] = [
  {
    key: "title",
    label: "Product title",
    kind: "text",
    operators: TEXT_OPS,
    build: (op, v) => textCompare(sql`p.name`, op, v),
  },
  {
    key: "tag",
    label: "Tag",
    kind: "text",
    operators: ["eq", "neq"],
    hint: "Matches one tag exactly.",
    build: (op, v) =>
      op === "eq"
        ? sql`EXISTS (SELECT 1 FROM unnest(p.tags) t WHERE lower(t) = lower(${v}))`
        : op === "neq"
          ? sql`NOT EXISTS (SELECT 1 FROM unnest(p.tags) t WHERE lower(t) = lower(${v}))`
          : null,
  },
  {
    key: "product_type",
    label: "Product type",
    kind: "text",
    operators: TEXT_OPS,
    build: (op, v) => textCompare(sql`p.product_type`, op, v),
  },
  {
    key: "vendor",
    label: "Vendor",
    kind: "text",
    operators: TEXT_OPS,
    build: (op, v) => textCompare(sql`p.vendor`, op, v),
  },
  {
    key: "family",
    label: "Family",
    kind: "select",
    options: [
      { value: "oils", label: "Oils" },
      { value: "relief", label: "Relief" },
      { value: "home", label: "Home" },
    ],
    operators: ["eq", "neq"],
    build: (op, v) =>
      op === "eq" ? sql`p.family::text = ${v}` : op === "neq" ? sql`p.family::text <> ${v}` : null,
  },
  {
    key: "price",
    label: "Price (lowest variant)",
    kind: "money",
    operators: NUMERIC_OPS,
    hint: "In rupees.",
    build: (op, v) => {
      const paisa = moneyPaisa(v);
      if (paisa === null) return null;
      return compare(
        sql`COALESCE((SELECT MIN(pv.price_paisa) FROM product_variants pv WHERE pv.product_id = p.id AND pv.deleted_at IS NULL), 0)`,
        op,
        paisa,
      );
    },
  },
  {
    key: "stock",
    label: "Total stock",
    kind: "number",
    operators: NUMERIC_OPS,
    build: (op, v) => {
      const n = num(v);
      if (n === null) return null;
      return compare(
        sql`COALESCE((SELECT SUM(pv.stock) FROM product_variants pv WHERE pv.product_id = p.id AND pv.deleted_at IS NULL), 0)`,
        op,
        n,
      );
    },
  },
];

/* ---------------------------------------------------- customer / segment */

/** Written against an outer `customers c` alias. */
export const CUSTOMER_FIELDS: FieldDef[] = [
  {
    key: "total_spent",
    label: "Lifetime spend",
    kind: "money",
    operators: NUMERIC_OPS,
    hint: "In rupees.",
    build: (op, v) => {
      const paisa = moneyPaisa(v);
      return paisa === null ? null : compare(sql`c.total_spent_paisa`, op, paisa);
    },
  },
  {
    key: "orders_count",
    label: "Number of orders",
    kind: "number",
    operators: NUMERIC_OPS,
    build: (op, v) => {
      const n = num(v);
      return n === null ? null : compare(sql`c.orders_count`, op, n);
    },
  },
  {
    key: "city",
    label: "City",
    kind: "text",
    operators: TEXT_OPS,
    build: (op, v) => textCompare(sql`c.city`, op, v),
  },
  {
    key: "name",
    label: "Name",
    kind: "text",
    operators: TEXT_OPS,
    build: (op, v) => textCompare(sql`c.name`, op, v),
  },
  {
    key: "tag",
    label: "Tag",
    kind: "text",
    operators: ["eq", "neq"],
    build: (op, v) =>
      op === "eq"
        ? sql`EXISTS (SELECT 1 FROM unnest(c.tags) t WHERE lower(t) = lower(${v}))`
        : op === "neq"
          ? sql`NOT EXISTS (SELECT 1 FROM unnest(c.tags) t WHERE lower(t) = lower(${v}))`
          : null,
  },
  {
    key: "days_since_last_order",
    label: "Days since last order",
    kind: "number",
    operators: NUMERIC_OPS,
    hint: "Use “is greater than 90” for lapsed customers.",
    build: (op, v) => {
      const n = num(v);
      if (n === null) return null;
      return compare(
        sql`COALESCE(EXTRACT(DAY FROM (now() - c.last_order_at)), 99999)`,
        op,
        n,
      );
    },
  },
  {
    key: "delivery_rate",
    label: "Delivery success rate",
    kind: "number",
    operators: NUMERIC_OPS,
    hint: "Percent, 0 to 100. Delivered orders divided by total orders.",
    build: (op, v) => {
      const n = num(v);
      if (n === null) return null;
      return compare(
        sql`CASE WHEN c.orders_count = 0 THEN 100 ELSE (c.delivered_count::numeric * 100 / c.orders_count) END`,
        op,
        n,
      );
    },
  },
  {
    key: "returned_count",
    label: "Returns and refusals",
    kind: "number",
    operators: NUMERIC_OPS,
    build: (op, v) => {
      const n = num(v);
      return n === null ? null : compare(sql`(c.returned_count + c.cancelled_count)`, op, n);
    },
  },
  {
    key: "bought_product",
    label: "Bought product (slug)",
    kind: "text",
    operators: ["eq", "neq"],
    build: (op, v) => {
      const exists = sql`EXISTS (
        SELECT 1 FROM orders o
        JOIN order_items oi ON oi.order_id = o.id
        WHERE o.customer_id = c.id AND o.deleted_at IS NULL AND lower(oi.product_slug) = lower(${v})
      )`;
      return op === "eq" ? exists : op === "neq" ? sql`NOT ${exists}` : null;
    },
  },
];

export function fieldsFor(resource: "product" | "customer"): FieldDef[] {
  return resource === "product" ? PRODUCT_FIELDS : CUSTOMER_FIELDS;
}

/**
 * Compiles rules to a single boolean expression.
 * Returns null when nothing usable is left, which callers read as "match none".
 */
export function compileRules(
  rules: Rule[],
  match: RuleMatch,
  resource: "product" | "customer",
): SQL | null {
  const defs = new Map(fieldsFor(resource).map((f) => [f.key, f]));
  const parts: SQL[] = [];

  for (const rule of rules) {
    const def = defs.get(rule.field);
    if (!def || !def.operators.includes(rule.operator)) continue;
    const expr = def.build(rule.operator, rule.value);
    if (expr) parts.push(sql`(${expr})`);
  }

  if (parts.length === 0) return null;
  return sql.join(parts, match === "all" ? sql` AND ` : sql` OR `);
}

export function describeRule(rule: Rule, resource: "product" | "customer"): string {
  const def = fieldsFor(resource).find((f) => f.key === rule.field);
  const label = def?.label ?? rule.field;
  return `${label} ${OPERATOR_LABEL[rule.operator]} ${rule.value}`;
}

/** Parses whatever came out of the jsonb column into rules we trust. */
export function parseRules(raw: unknown): Rule[] {
  const parsed = rulesSchema.safeParse(raw);
  return parsed.success ? parsed.data : [];
}
