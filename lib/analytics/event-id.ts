import { createHash } from "node:crypto";

/**
 * The shared event id.
 *
 * One id per (event, subject): the purchase of order X is the same event
 * whether the browser or the job runner reports it, so both send
 * `evt_purchase_<hash of the order id>` and the platform keeps exactly one.
 *
 * Kept in its own module because it needs node:crypto, and the pixel names it
 * sits beside are imported by the browser bundle.
 */
export function eventIdFor(event: string, subject: string): string {
  const digest = createHash("sha256").update(`${event}:${subject}`).digest("hex").slice(0, 24);
  return `evt_${event}_${digest}`;
}
