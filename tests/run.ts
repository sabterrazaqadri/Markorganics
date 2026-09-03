/**
 * Test entry point.
 *
 *   npm test
 *
 * Loads .env.local (and stubs `server-only`, which throws outside a React
 * Server Component) before importing anything, then pulls in each suite.
 * node:test registers the cases and runs them at exit, setting a non-zero exit
 * code if any fail.
 *
 * The pure suites need nothing. tests/flow.test.ts talks to the database in
 * .env.local and skips itself when DATABASE_URL is unset or global dry-run is
 * off — a test that can book a real parcel is not a test.
 */
import "../scripts/env";

// Plain imports rather than top-level await: tsx compiles these to CommonJS,
// where the env stub above must still run first, and it does — CJS imports are
// evaluated in source order.
import "./unit.test";
import "./meta-hash.test";
import "./flow.test";
