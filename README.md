# Invoice Hub

GST invoicing for Vyrelle, DT.live, LoudCousin and Sanskriti The Antique. One app, one Postgres database, each business kept separate by its own number series, settings and user access.

## What it does

- Brand-styled tax invoices for each business, live preview while typing, print or save as PDF
- Strict invoice numbering per GST Rule 46: `VYR/G/2627/0001` (G = made here, W = from your website), unique per financial year, never reused
- CGST + SGST or IGST worked out from the place of supply; garment rule (5% up to ₹2,500 per piece, else 18%); export invoices under LUT
- Payments and part-payments, balance due, UPI pay QR on unpaid invoices
- Credit notes (`VYRC/G/2627/0001`) for returns and corrections after filing; edit before filing; cancel with reason (number stays)
- Share links customers can open without signing in, and a WhatsApp message
- Register with search, filters, totals, CSV export and HSN/SAC summary for GST filing
- Saved items, saved customers, full history of who changed what
- Users with access per business: viewer, editor, admin
- Website API so your stores issue invoices automatically (`W` series, safe to retry)

## Set up (once)

1. **GitHub**: create a private repo named `invoice-hub`, then in this folder:
   ```bash
   git init && git add . && git commit -m "Invoice Hub"
   git branch -M main
   git remote add origin https://github.com/<you>/invoice-hub.git
   git push -u origin main
   ```
2. **Vercel**: Add New → Project → import `invoice-hub`. Framework: Next.js. Deploy (the first deploy may fail until step 3 is done; that's fine).
3. **Database**: in the Vercel project → Storage → Create → **Neon** (Postgres) → connect it to the project. Choose the Mumbai/Singapore region. This adds `DATABASE_URL` for you.
4. **Secrets**: Project → Settings → Environment Variables, add
   - `AUTH_SECRET` = output of `openssl rand -base64 48`
   - `APP_URL` = your address, e.g. `https://invoices.deepanshutyagi.live` (optional)
5. **On your laptop** (VS Code terminal, inside the project):
   ```bash
   npm install
   npm i -g vercel && vercel link && vercel env pull .env.local
   npm run db:migrate
   npm run user:create -- --email you@example.com --password "a long password" --name "Deepanshu"
   ```
6. Redeploy on Vercel (Deployments → Redeploy). Sign in at your Vercel URL.
7. Open each business → **Settings** and add GSTIN, address, bank and UPI.

Optional: Project → Settings → Domains → add `invoices.yourdomain.com`.

## Day to day

- Run locally: `npm run dev` → http://localhost:3000
- Every `git push` to `main` deploys automatically.
- Schema changes: edit `db/schema.sql`, then `npm run db:migrate` (safe to re-run).

## Give someone access

```bash
# Jyoti Enterprises: only Sanskriti, can issue invoices but not change settings
npm run user:create -- --email partner@example.com --password "their long password" --access '{"sanskriti":"editor"}'
# An accountant who can read everything
npm run user:create -- --email ca@example.com --password "..." --access '{"*":"viewer"}'
```
Running it again for the same email updates the password and access. Access changes apply immediately.

## Website API (W series)

Create a key in the business's **Settings → Website connection**, store it in your store's server env (never in browser code), then after payment:

```js
await fetch("https://invoices.yourdomain.com/api/v1/invoices", {
  method: "POST",
  headers: { "content-type": "application/json", authorization: `Bearer ${process.env.INVOICE_HUB_KEY}` },
  body: JSON.stringify({
    externalId: order.id, // same id = same invoice, so retries are safe
    channel: "Website", orderId: order.number, paymentMode: "Razorpay (online)", paymentRef: payment.id,
    customer: { name, phone, email, address, stateCode: "07" },
    shipping: 99,
    items: [{ desc: "Shubh Owl Candle", note: "Ruby", hsn: "3406", qty: 2, rate: 249, gst: 5 }],
  }),
}); // -> { id, number, total, status, shareUrl }
```
Prices are GST-inclusive for goods series unless you send `"priceMode": "exclusive"`.

## Files

```
app/                      pages (Next.js App Router)
  actions.ts              all saves go through here (checks access, then lib/invoices)
  b/[biz]/                one business: register, new, invoice view, edit, settings
  i/[token]/              public share page
  print/[id]/             print / save-as-PDF page
  api/b/[biz]/export/     CSV exports
  api/v1/invoices/        website API
components/               interactive parts (editor, actions panel, settings forms)
lib/brands.ts             businesses, series, channels, HSN/SAC presets  ← edit to add a business
lib/tax.ts                GST maths, numbering, amount in words (shared by browser and server)
lib/sheets.ts             the four invoice designs
lib/invoices.ts           database logic: numbering, payments, credit notes, exports
db/schema.sql             tables
scripts/                  migrate + create-user
```

GST rates and HSN/SAC codes are defaults you can change per line. Confirm them with your CA.
