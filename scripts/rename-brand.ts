/**
 * One-off, idempotent: renames the brand from MARKORGANICS to MARKORGANIC on
 * a database that was already seeded.
 *
 * `config/commerce.ts` only sets the fallback used when the `settings` row is
 * missing (see `DEFAULT_SETTINGS.store.name` in lib/settings.ts) — on a
 * database that already has a `store` row, `db:backfill` will never touch it
 * again (`onConflictDoNothing`). This script is the other half: it updates
 * the live row, but only where its value still matches the *old* default, so
 * a store owner who has since typed in their own name or email is left
 * alone. Safe to run more than once; the second run finds nothing to change.
 *
 *   npx tsx scripts/rename-brand.ts
 */
import "./env";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { notificationTemplates, settings } from "@/lib/db/schema";
import { BRAND_NAME, SUPPORT_EMAIL } from "@/config/commerce";

const OLD_NAME = "MARKORGANICS";
const OLD_EMAIL = "hello@markorganics.pk";

interface StoreValue {
  name?: string;
  contactEmail?: string;
  [key: string]: unknown;
}

async function renameStoreSettings() {
  const [row] = await db.select().from(settings).where(eq(settings.key, "store")).limit(1);
  if (!row) {
    console.log("  no `store` settings row yet — nothing to migrate, the new default will apply on first read");
    return;
  }

  const value = { ...(row.value as StoreValue) };
  let changed = false;

  if (value.name === OLD_NAME) {
    value.name = BRAND_NAME;
    changed = true;
  }
  if (value.contactEmail === OLD_EMAIL) {
    value.contactEmail = SUPPORT_EMAIL;
    changed = true;
  }

  if (!changed) {
    console.log("  store settings already renamed (or customised) — nothing to do");
    return;
  }

  await db.update(settings).set({ value: value as never, updatedAt: new Date() }).where(eq(settings.key, "store"));
  console.log(`  store.name -> "${value.name}", store.contactEmail -> "${value.contactEmail}"`);
}

/**
 * The seeded templates use a `{{store_name}}` placeholder, not a literal
 * brand string, so this is defensive: it only fires if a template was ever
 * hand-edited in the admin to spell the old name out.
 */
async function renameNotificationTemplates() {
  const rows = await db.select().from(notificationTemplates);
  let count = 0;
  for (const row of rows) {
    if (!row.subject.includes(OLD_NAME) && !row.body.includes(OLD_NAME) && !row.name.includes(OLD_NAME)) continue;
    await db
      .update(notificationTemplates)
      .set({
        subject: row.subject.replaceAll(OLD_NAME, BRAND_NAME),
        body: row.body.replaceAll(OLD_NAME, BRAND_NAME),
        name: row.name.replaceAll(OLD_NAME, BRAND_NAME),
        updatedAt: new Date(),
      })
      .where(eq(notificationTemplates.id, row.id));
    count += 1;
  }
  console.log(count > 0 ? `  ${count} notification template(s) updated` : "  no notification templates mention the old name");
}

async function main() {
  console.log(`Renaming ${OLD_NAME} -> ${BRAND_NAME} in the database\n`);
  console.log("Store settings:");
  await renameStoreSettings();
  console.log("Notification templates:");
  await renameNotificationTemplates();
  console.log("\nDone. Content pages, blog posts and FAQ copy already seeded with the old name are");
  console.log("refreshed by re-running their own idempotent seed scripts with --reset, e.g.:");
  console.log("  npm run db:seed-storefront -- --reset");
  console.log("  npm run db:seed-blog -- --reset");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
