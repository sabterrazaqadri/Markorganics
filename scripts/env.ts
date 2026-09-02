import { createRequire } from "node:module";
import { config as loadEnv } from "dotenv";

// Imported first so DATABASE_URL is set before any module that reads it is evaluated.
loadEnv({ path: [".env.local", ".env"] });

/**
 * `server-only` throws outside a React Server Component, and these scripts
 * legitimately import the same query modules the server uses. Pre-seeding the
 * module cache with an empty export makes the guard a no-op here without
 * weakening it anywhere the bundler actually enforces it.
 */
const req = createRequire(import.meta.url);
try {
  req.cache[req.resolve("server-only")] = {
    id: "server-only",
    filename: "server-only",
    loaded: true,
    exports: {},
  } as unknown as NodeJS.Module;
} catch {
  // Not installed: nothing to stub.
}
