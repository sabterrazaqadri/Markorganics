import { neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "./schema";

// Node < 22 has no global WebSocket; Neon's Pool driver needs one for transactions.
if (typeof WebSocket === "undefined") {
  neonConfig.webSocketConstructor = ws;
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
}

const globalForDb = globalThis as unknown as { __mrkPool?: Pool };
const pool = globalForDb.__mrkPool ?? new Pool({ connectionString });
if (process.env.NODE_ENV !== "production") globalForDb.__mrkPool = pool;

export const db = drizzle(pool, { schema });
export type Db = typeof db;
