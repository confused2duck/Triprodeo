# Supabase Storage Setup — Property Images

Property, room, add-on, and day-package images now upload **directly from the
browser to Supabase Storage**, and only the resulting public URL is saved on the
property. This removes the old failure where saving a property with real photos
returned **HTTP 413 (Payload Too Large)** — Vercel rejects request bodies over
~4.5 MB, and base64 images inlined in the save payload blew past that limit.

With storage configured, the save payload carries only short URLs, so there is
no practical limit on the number or size of photos.

## What happens without configuration

If `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are **not** set, the uploader
transparently falls back to compressed inline data URLs (downscaled to 1600px,
WebP/JPEG). Saving still works for a handful of photos, but the 4.5 MB payload
limit applies again. Configure storage to remove it entirely.

## One-time setup

### 1. Create a public bucket

Supabase Dashboard → **Storage** → **New bucket**:

- Name: `property-images` (or any name — set `VITE_SUPABASE_BUCKET` to match)
- **Public bucket: ON** (so the saved URLs are readable by all site visitors)

### 2. Allow uploads from the browser

The admin CMS authenticates with its own JWT, not Supabase Auth, so the browser
uploads using the project's **anon** key. Add a policy allowing the `anon` role
to insert into this bucket. Run in Supabase → **SQL Editor**:

```sql
-- Allow anyone with the anon key to upload into the property-images bucket.
create policy "property-images anon upload"
on storage.objects for insert
to anon
with check (bucket_id = 'property-images');

-- Public read (already covered by a public bucket, included here for clarity).
create policy "property-images public read"
on storage.objects for select
to anon
using (bucket_id = 'property-images');
```

### 3. Set the frontend env vars

From Supabase → **Project Settings → API**, copy the Project URL and the
`anon` `public` key. Then:

- **Local dev:** add them to `.env.local` (see `.env.example`).
- **Production (Vercel):** Project → Settings → Environment Variables, add:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `VITE_SUPABASE_BUCKET` (optional)

  Then redeploy so the new build picks them up.

## Verifying

1. Open the admin CMS → Properties → Add/Edit a property.
2. On the Photos tab, upload an image — the dropzone shows **Uploading…**.
3. Save the property. It should succeed with no 413.
4. Inspect the saved record (or the network request): `images[]` now contains
   `https://<project>.supabase.co/storage/v1/object/public/property-images/...`
   URLs instead of long `data:image/...;base64,...` strings.

## Security note (optional hardening)

The anon-insert policy above lets anyone holding the (public) anon key upload to
the bucket. For an internal admin tool this is usually acceptable. To lock it
down further, route uploads through a backend endpoint that mints short-lived
**signed upload URLs** with the Supabase `service_role` key, and remove the
anon-insert policy. The frontend upload helper in `src/lib/imageStorage.ts` is
isolated so this can be swapped in without touching the editor UI.
