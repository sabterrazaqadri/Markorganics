import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { codRemittanceLines, codRemittances, orders, shipments, type CodRemittance } from "@/lib/db/schema";

/**
 * COD reconciliation: what each courier says it collected, against what it
 * actually paid.
 *
 * A remittance is recorded as a header (the payment that landed in the bank)
 * plus one line per tracking number. Anything that does not reconcile stays
 * visible rather than being quietly absorbed.
 */

export interface RemittanceLineInput {
  trackingNumber: string;
  paidPaisa: number;
}

export interface RecordRemittanceInput {
  provider: string;
  reference: string;
  paidOn: Date;
  amountPaisa: number;
  note?: string;
  lines: RemittanceLineInput[];
  userId: string;
}

export interface RecordRemittanceResult {
  id: string;
  matched: number;
  unmatched: string[];
  allocatedPaisa: number;
  /** Header amount minus the sum of the lines. Non-zero means something is off. */
  variancePaisa: number;
}

export async function recordRemittance(input: RecordRemittanceInput): Promise<RecordRemittanceResult> {
  return db.transaction(async (tx) => {
    const [header] = await tx
      .insert(codRemittances)
      .values({
        provider: input.provider,
        reference: input.reference.trim(),
        paidOn: input.paidOn,
        amountPaisa: input.amountPaisa,
        note: input.note?.trim() ?? "",
        createdById: input.userId,
      })
      .returning();

    const unmatched: string[] = [];
    let matched = 0;
    let allocated = 0;

    for (const line of input.lines) {
      const tracking = line.trackingNumber.trim();
      if (!tracking) continue;

      const [shipment] = await tx
        .select()
        .from(shipments)
        .where(sql`${shipments.trackingNumber} = ${tracking} AND ${shipments.provider} = ${input.provider}`)
        .limit(1);

      if (!shipment) unmatched.push(tracking);
      else matched += 1;
      allocated += line.paidPaisa;

      await tx
        .insert(codRemittanceLines)
        .values({
          remittanceId: header.id,
          shipmentId: shipment?.id ?? null,
          orderId: shipment?.orderId ?? null,
          trackingNumber: tracking,
          expectedPaisa: shipment?.codAmountPaisa ?? 0,
          paidPaisa: line.paidPaisa,
        })
        .onConflictDoNothing({ target: [codRemittanceLines.remittanceId, codRemittanceLines.trackingNumber] });

      if (shipment) {
        await tx
          .update(shipments)
          .set({
            remittedPaisa: shipment.remittedPaisa + line.paidPaisa,
            remittanceId: header.id,
            updatedAt: new Date(),
          })
          .where(eq(shipments.id, shipment.id));
      }
    }

    await tx.update(codRemittances).set({ allocatedPaisa: allocated }).where(eq(codRemittances.id, header.id));

    return {
      id: header.id,
      matched,
      unmatched,
      allocatedPaisa: allocated,
      variancePaisa: input.amountPaisa - allocated,
    };
  });
}

export async function listRemittances(provider?: string): Promise<CodRemittance[]> {
  const query = db.select().from(codRemittances).orderBy(desc(codRemittances.paidOn)).limit(100);
  return provider ? query.where(eq(codRemittances.provider, provider)) : query;
}

export async function remittanceLines(remittanceId: string) {
  return db
    .select({
      line: codRemittanceLines,
      orderNumber: orders.orderNumber,
    })
    .from(codRemittanceLines)
    .leftJoin(orders, eq(orders.id, codRemittanceLines.orderId))
    .where(eq(codRemittanceLines.remittanceId, remittanceId))
    .orderBy(codRemittanceLines.trackingNumber);
}

export interface CodSummary {
  provider: string;
  deliveredCount: number;
  collectedPaisa: number;
  remittedPaisa: number;
  outstandingPaisa: number;
}

export async function codSummary(): Promise<CodSummary[]> {
  const rows = await db
    .select({
      provider: shipments.provider,
      deliveredCount: sql<number>`count(*)::int`,
      collectedPaisa: sql<number>`coalesce(sum(${shipments.codAmountPaisa}), 0)::int`,
      remittedPaisa: sql<number>`coalesce(sum(${shipments.remittedPaisa}), 0)::int`,
    })
    .from(shipments)
    .where(eq(shipments.status, "delivered"))
    .groupBy(shipments.provider);

  return rows.map((r) => ({
    ...r,
    outstandingPaisa: Math.max(0, r.collectedPaisa - r.remittedPaisa),
  }));
}

/**
 * Parses the "tracking, amount" lines pasted from a courier's remittance sheet.
 *
 * Sheets arrive with commas, tabs or semicolons between the two fields, with
 * "Rs" in front of the number and with thousands separators inside it. So the
 * tracking number is the first token and everything after it is reduced to
 * digits, rather than trusting a naive split.
 *
 * A line whose amount cannot be read is reported, never quietly counted as
 * zero: "the courier paid nothing" and "I could not read this line" are very
 * different claims, and only one of them should reach the discrepancy list.
 */
export function parseRemittanceLines(text: string): { lines: RemittanceLineInput[]; errors: string[] } {
  const lines: RemittanceLineInput[] = [];
  const errors: string[] = [];

  for (const [i, raw] of text.split(/\r?\n/).entries()) {
    const trimmed = raw.trim();
    if (!trimmed) continue;

    const match = trimmed.match(/^([^\s,;\t]+)[\s,;\t]+(.*)$/);
    if (!match) {
      errors.push(`Line ${i + 1}: "${trimmed}" has a tracking number but no amount.`);
      continue;
    }

    const tracking = match[1].trim();
    if (!tracking) continue;

    // "Rs 1,850.00" -> "1850.00". A comma is a thousands separator here, never
    // a decimal point: this is a Pakistani rupee sheet.
    const numeric = match[2].replace(/[^0-9.,-]/g, "").replace(/,/g, "");
    const amount = Number(numeric);
    if (!/\d/.test(numeric) || !Number.isFinite(amount)) {
      errors.push(`Line ${i + 1}: "${trimmed}" has no readable amount.`);
      continue;
    }

    lines.push({ trackingNumber: tracking, paidPaisa: Math.round(amount * 100) });
  }
  return { lines, errors };
}
