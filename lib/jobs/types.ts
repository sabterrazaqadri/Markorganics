/** Job type names. Constants because they are also stored in the database. */
export const JOB = {
  courierBook: "courier.book",
  courierSync: "courier.sync",
  courierSyncAll: "courier.sync_all",
  courierCancel: "courier.cancel",
  whatsappSend: "whatsapp.send",
  whatsappAbandoned: "whatsapp.abandoned",
  analyticsPurchase: "analytics.purchase",
  metaEvent: "meta.event",
  googleEvent: "google.event",
  tiktokEvent: "tiktok.event",
} as const;

export type JobType = (typeof JOB)[keyof typeof JOB];

export const JOB_LABEL: Record<string, string> = {
  [JOB.courierBook]: "Book shipment",
  [JOB.courierSync]: "Sync one shipment",
  [JOB.courierSyncAll]: "Sync all in-transit shipments",
  [JOB.courierCancel]: "Cancel shipment",
  [JOB.whatsappSend]: "Send WhatsApp message",
  [JOB.whatsappAbandoned]: "Abandoned checkout follow-up",
  [JOB.analyticsPurchase]: "Purchase events (Meta, GA4, TikTok)",
  [JOB.metaEvent]: "Meta Conversions API event",
  [JOB.googleEvent]: "GA4 Measurement Protocol event",
  [JOB.tiktokEvent]: "TikTok Events API event",
};

/**
 * A handler returns the value stored on the job, or throws.
 *
 * Throwing `PermanentJobError` skips the retry ladder: the job is dead
 * immediately, because trying a fifth time will not fix a missing city
 * mapping or an unverified adapter.
 */
export class PermanentJobError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermanentJobError";
  }
}
