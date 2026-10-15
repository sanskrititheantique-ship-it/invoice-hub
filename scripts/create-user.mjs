// Creates a user, or updates the password and access of an existing one.
//
//   npm run user:create -- --email you@example.com --password "a long password" --name "Deepanshu"
//       -> full admin of every business (default)
//   npm run user:create -- --email partner@example.com --password "..." --access '{"sanskriti":"editor"}'
//       -> can only see and issue Sanskriti invoices
//
// Roles: viewer (read only), editor (issue/edit/cancel invoices, record payments), admin (also settings, numbering, API keys).
import bcrypt from "bcryptjs";
import postgres from "postgres";

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith("--") ? [...acc, [a.slice(2), all[i + 1]]] : acc), []));
const email = String(args.email || "").trim().toLowerCase();
const password = String(args.password || "");
const name = String(args.name || "");
let access;
try { access = JSON.parse(args.access || '{"*":"admin"}'); } catch { console.error("--access must be JSON, e.g. '{\"sanskriti\":\"editor\"}'"); process.exit(1); }
const roles = new Set(["viewer", "editor", "admin"]);
if (!email.includes("@")) { console.error("Pass --email"); process.exit(1); }
if (password.length < 10) { console.error("Pass --password with at least 10 characters"); process.exit(1); }
if (!Object.values(access).every((r) => roles.has(r))) { console.error("Roles must be viewer, editor or admin"); process.exit(1); }

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!url) { console.error("No DATABASE_URL found. Run `vercel env pull .env.local` first."); process.exit(1); }
const sql = postgres(url, { ssl: /localhost|127\.0\.0\.1/.test(url) ? false : "require", max: 1 });
try {
  const hash = await bcrypt.hash(password, 12);
  const [u] = await sql`insert into users (email, name, password_hash, access) values (${email}, ${name}, ${hash}, ${sql.json(access)})
    on conflict (email) do update set password_hash = excluded.password_hash, access = excluded.access, name = case when excluded.name = '' then users.name else excluded.name end
    returning id, email, access`;
  console.log(`Saved ${u.email} with access ${JSON.stringify(u.access)}`);
} catch (e) {
  console.error("Failed:", e.message, "(did you run npm run db:migrate?)");
  process.exitCode = 1;
} finally {
  await sql.end();
}
