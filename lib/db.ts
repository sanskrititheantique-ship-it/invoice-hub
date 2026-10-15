import "server-only";
import postgres from "postgres";

// Vercel's Neon integration sets DATABASE_URL (pooled). POSTGRES_URL is accepted as a fallback.
declare global {
  // eslint-disable-next-line no-var
  var __invoiceSql: postgres.Sql | undefined;
}

export function db(): postgres.Sql {
  if (globalThis.__invoiceSql) return globalThis.__invoiceSql;
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Add a Neon database to the Vercel project, then run `vercel env pull .env.local`.");
  const local = /localhost|127\.0\.0\.1/.test(url);
  const sql = postgres(url, {
    ssl: local ? false : "require",
    prepare: false, // required for Neon's pooled (PgBouncer) connection
    max: 5,
    idle_timeout: 20,
    types: {
      numeric: { to: 1700, from: [1700], serialize: (x: unknown) => String(x), parse: (x: string) => Number(x) },
      date: { to: 1082, from: [1082], serialize: (x: unknown) => String(x), parse: (x: string) => x }, // keep dates as YYYY-MM-DD
    },
  });
  globalThis.__invoiceSql = sql;
  return sql;
}
