// Direct browser → Supabase Storage uploads.
//
// Property/room/add-on/day-package images used to be embedded in the property
// JSON as base64 data URLs. On Vercel that meant the whole save request had to
// carry every photo inline, and any body over ~4.5MB was rejected with a 413
// before the API ever ran. Uploading each image straight to object storage and
// persisting only its public URL removes that constraint entirely: the save
// payload is now just a handful of short strings regardless of photo count/size.
//
// Configuration (frontend env, both required to enable storage):
//   VITE_SUPABASE_URL       e.g. https://xyzcompany.supabase.co
//   VITE_SUPABASE_ANON_KEY  the project's anon/public key
//   VITE_SUPABASE_BUCKET    optional, defaults to "property-images"
//
// When the env vars are absent the uploader transparently falls back to a
// compressed data URL, so local dev without storage keys keeps working.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const BUCKET = (import.meta.env.VITE_SUPABASE_BUCKET as string | undefined) || 'property-images';

let client: SupabaseClient | null = null;
if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** True when storage env vars are present and uploads should go to Supabase. */
export const isImageStorageConfigured = (): boolean => client !== null;

const uid = () =>
  (globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`);

/**
 * Upload an image blob to Supabase Storage and return its public URL.
 * Throws if storage is not configured or the upload fails — callers decide
 * whether to surface the error or fall back to an inline data URL.
 */
export async function uploadImageBlob(
  blob: Blob,
  ext: string,
  contentType: string
): Promise<string> {
  if (!client) throw new Error('Image storage is not configured');

  const now = new Date();
  const folder = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const path = `properties/${folder}/${uid()}.${ext}`;

  const { error } = await client.storage.from(BUCKET).upload(path, blob, {
    contentType,
    cacheControl: '31536000', // 1 year — files are content-addressed by uuid.
    upsert: false,
  });
  if (error) throw error;

  const { data } = client.storage.from(BUCKET).getPublicUrl(path);
  if (!data?.publicUrl) throw new Error('Upload succeeded but no public URL was returned');
  return data.publicUrl;
}
