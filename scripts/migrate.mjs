// Creates or updates the database tables. Safe to run any number of times.
// Usage: npm run db:migrate
import { readFileSync } from "node:fs";
import postgres from "postgres";

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!url) {
  console.error("No DATABASE_URL found. Run `vercel env pull .env.local` first.");
  process.exit(1);
}
const sql = postgres(url, { ssl: /localhost|127\.0\.0\.1/.test(url) ? false : "require", max: 1, onnotice: () => {} });
const schema = readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8");
try {
  await sql.unsafe(schema);
  const tables = await sql`select table_name from information_schema.tables where table_schema = 'public' order by 1`;
  console.log("Database ready. Tables:", tables.map((t) => t.table_name).join(", "));
} catch (e) {
  console.error("Migration failed:", e.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
