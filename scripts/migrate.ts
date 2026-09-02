/**
 * Applies drizzle migrations over the Neon HTTP driver.
 *
 * `drizzle-kit migrate` uses the websocket driver, which drops the connection
 * part-way through a large migration on some networks. This runner sends one
 * statement per HTTP request and records the same rows drizzle-kit would in
 * drizzle.__drizzle_migrations, so the two stay interchangeable.
 *
 *   npm run db:migrate
 */
import "./env";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { neon } from "@neondatabase/serverless";

const DIR = join(process.cwd(), "drizzle");

interface JournalEntry {
  idx: number;
  when: number;
  tag: string;
}

async function main() {
  const sql = neon(process.env.DATABASE_URL!);

  await sql`CREATE SCHEMA IF NOT EXISTS drizzle`;
  await sql`CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
    id SERIAL PRIMARY KEY,
    hash text NOT NULL,
    created_at bigint
  )`;

  const applied = new Set(
    (await sql`SELECT hash FROM drizzle.__drizzle_migrations`).map((r) => r.hash as string),
  );

  const journal = JSON.parse(readFileSync(join(DIR, "meta", "_journal.json"), "utf8")) as {
    entries: JournalEntry[];
  };
  const files = new Set(readdirSync(DIR).filter((f) => f.endsWith(".sql")));

  for (const entry of journal.entries.sort((a, b) => a.idx - b.idx)) {
    const file = `${entry.tag}.sql`;
    if (!files.has(file)) throw new Error(`Missing migration file ${file}`);
    const body = readFileSync(join(DIR, file), "utf8");
    const hash = createHash("sha256").update(body).digest("hex");
    if (applied.has(hash)) {
      console.log(`  skip ${entry.tag}`);
      continue;
    }

    const statements = body
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);

    console.log(`  apply ${entry.tag} (${statements.length} statements)`);
    for (const [i, statement] of statements.entries()) {
      try {
        await sql.query(statement);
      } catch (err) {
        const message = (err as Error).message;
        // Re-running a partially applied migration must not wedge the runner.
        if (/already exists|duplicate/i.test(message)) {
          console.log(`    ${i + 1}/${statements.length} exists, skipping`);
          continue;
        }
        console.error(`    failed at statement ${i + 1}/${statements.length}:`);
        console.error(statement.slice(0, 300));
        throw err;
      }
    }
    await sql`INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES (${hash}, ${entry.when})`;
  }

  console.log("Migrations up to date.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
