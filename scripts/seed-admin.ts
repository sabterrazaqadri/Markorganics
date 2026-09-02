/**
 * Creates the first Owner account from the environment.
 *
 * A no-op the moment any user exists, so it can never mint a second account.
 * The login page runs the same check, so this script is only for setting up
 * without opening a browser.
 *
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=... npm run db:seed-admin
 */
import "./env";
import { countUsers, createUser } from "@/lib/admin/users";
import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";

async function main() {
  const existing = await countUsers();
  if (existing > 0) {
    console.log(`${existing} staff account${existing === 1 ? "" : "s"} already exist. Nothing to do.`);
    process.exit(0);
  }

  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME ?? "Owner";

  if (!email || !password) {
    console.error("Set ADMIN_EMAIL and ADMIN_PASSWORD in .env.local first.");
    process.exit(1);
  }
  if (password.length < 10) {
    console.error("ADMIN_PASSWORD must be at least 10 characters.");
    process.exit(1);
  }

  const user = await createUser({ email, password, name, role: "owner" });
  await db.insert(auditLogs).values({
    userId: user.id,
    userEmail: user.email,
    action: "user.seed",
    entityType: "user",
    entityId: user.id,
    entityLabel: user.email,
    after: { role: "owner", source: "seed script" } as never,
  });

  console.log(`Owner created: ${user.email}`);
  console.log("Sign in at /admin/login, then change the password under My account.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
