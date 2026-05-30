# Supabase Database + Storage Runbook

Project: `https://scycyrrlvlgztnegzuzc.supabase.co` (ref `scycyrrlvlgztnegzuzc`)

Run these yourself — no secrets need to leave your machine. Do them **in order**:
**Part 1 (inspect)** → **Part 2 (wire DB + migrate)** → **Part 3 (image storage)**.

Where to find values in the Supabase dashboard:
- **Connection strings:** top-right **Connect** button → *ORMs* / *Connection string*.
- **API keys:** Project Settings → **API** (`anon` public key, `service_role` secret).

You'll substitute these placeholders:
- `[YOUR-DB-PASSWORD]` — your database password (Connect dialog / Settings → Database).
- `[REGION]` — shown in the pooler host, e.g. `aws-0-ap-south-1`.

---

## Part 1 — Inspect & verify (read-only, do this first)

Open Supabase → **SQL Editor** and run:

```sql
-- What tables already exist?
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;

-- If the app schema is already here, these return counts; if not, they error
-- with "relation does not exist" (which is fine — Part 2 creates them).
select count(*) as properties from public.properties;
select count(*) as hosts      from public.hosts;
```

- **Empty / errors** → fresh database, proceed to Part 2 to create the schema.
- **Tables already present** → the schema exists; in Part 2 run `migrate status`
  first and only `migrate deploy` if migrations are pending. Don't `migrate reset`
  on a database with real data.

---

## Part 2 — Wire as the production database + run migrations

The Prisma datasource now uses two URLs (already committed in
`backend/prisma/schema.prisma`):
- `DATABASE_URL` → **Transaction pooler** (port 6543) for app runtime.
- `DIRECT_URL`  → **Direct connection** (port 5432) for migrations.

### 2a. Set the env vars

**For running migrations from your machine**, set them in `backend/.env`
(replace the localhost values, or export them in your shell just for the migrate):

```bash
# Transaction pooler — app runtime (note ?pgbouncer=true&connection_limit=1)
DATABASE_URL="postgresql://postgres.scycyrrlvlgztnegzuzc:[YOUR-DB-PASSWORD]@[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"

# Direct connection — migrations / introspection
DIRECT_URL="postgresql://postgres.scycyrrlvlgztnegzuzc:[YOUR-DB-PASSWORD]@[REGION].pooler.supabase.com:5432/postgres"
```

> Tip: if the dashboard shows a **Direct connection** host like
> `db.scycyrrlvlgztnegzuzc.supabase.co:5432`, you can use that for `DIRECT_URL`
> instead of the session-pooler host — either works for migrations.

**For production (Vercel)** → Project → Settings → Environment Variables, add the
same `DATABASE_URL` and `DIRECT_URL`, then redeploy.

### 2b. Check status, then deploy the existing migrations

```bash
cd backend
npx prisma generate
npx prisma migrate status      # shows which of the 4 migrations are applied
npx prisma migrate deploy      # applies any pending migrations to Supabase
```

`migrate deploy` is safe and non-destructive — it only applies migrations that
haven't run yet. It will create: hosts, properties, room_types, add_ons,
bookings, reviews, staff, day-outing enquiries, etc.

### 2c. (Optional) seed the default admin

The backend auto-provisions the admin from `ADMIN_DEFAULT_EMAIL` /
`ADMIN_DEFAULT_PASSWORD` on boot, so just start the backend once pointed at
Supabase and log in at `/admin`.

### 2d. Verify

```bash
npx prisma migrate status      # should say "Database schema is up to date!"
```

Or re-run the Part 1 SQL — the tables now exist with 0 rows.

---

## Part 3 — Image storage (removes the 413 save limit)

### 3a. Create a public bucket

Supabase → **Storage** → **New bucket**:
- Name: `property-images`
- **Public bucket: ON**

### 3b. Add upload + read policies

SQL Editor → run:

```sql
-- Browser uploads with the anon key (admin CMS uses its own JWT, not Supabase Auth)
create policy "property-images anon upload"
on storage.objects for insert
to anon
with check (bucket_id = 'property-images');

-- Public read (a public bucket already allows this; explicit for clarity)
create policy "property-images public read"
on storage.objects for select
to anon
using (bucket_id = 'property-images');
```

### 3c. Set the frontend env vars

`anon` `public` key from Settings → API. Add to the **frontend** env — `.env.local`
for dev, and the **Vercel** project env for production, then redeploy:

```bash
VITE_SUPABASE_URL=https://scycyrrlvlgztnegzuzc.supabase.co
VITE_SUPABASE_ANON_KEY=[YOUR-ANON-PUBLIC-KEY]
# optional, defaults to property-images
# VITE_SUPABASE_BUCKET=property-images
```

### 3d. Verify

Admin CMS → Properties → add a property, upload a photo (dropzone shows
**Uploading…**), and Save. It should succeed with **no 413**, and the saved
`images[]` should contain
`https://scycyrrlvlgztnegzuzc.supabase.co/storage/v1/object/public/property-images/...`
URLs instead of base64.

---

## Security reminders

- The **service_role key** and **DB password** are secrets — never put them in
  any `VITE_*` var or commit them. Only the `anon` key belongs in the frontend.
- If you ever pasted a secret into a chat or shared screen, rotate it
  (Settings → Database → reset password; Settings → API → roll keys).
- Optional hardening for storage: replace the anon-insert policy with a backend
  endpoint that mints signed upload URLs using the `service_role` key. The
  upload helper in `src/lib/imageStorage.ts` is isolated for exactly this swap.
```
