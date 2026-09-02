import { createClient } from '@supabase/supabase-js';

// service_role bypasses Row Level Security — appropriate here since this
// app's auth is its own bespoke token system, not Supabase Auth, so there's
// no Supabase user JWT for RLS policies to check against. The backend is
// the trusted party uploading on an already-authenticated user's behalf.
const supabase = (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

export const isStorageConfigured = () => !!supabase;

const BUCKET = 'chat-images';
let bucketReady = null;

// Lazily creates the bucket on first real use rather than at import time —
// keeps a missing/misconfigured Supabase project from crashing server
// startup, and avoids a network call before anyone's actually uploaded
// anything.
async function ensureBucket() {
  if (bucketReady) return bucketReady;
  bucketReady = (async () => {
    const { data: existing } = await supabase.storage.getBucket(BUCKET);
    if (existing) return;
    const { error } = await supabase.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: '8mb',
      allowedMimeTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
    });
    // A harmless race if two requests both find no bucket and both try to
    // create it — the second one's "already exists" is not a real failure.
    if (error && !/already exists/i.test(error.message)) throw error;
  })();
  return bucketReady;
}

// Uploads a data-URI image (what the frontend's <input type="file"> +
// FileReader produces) and returns its public URL. Public bucket + public
// URLs, not signed ones — chat images here don't need to be access-controlled
// beyond "you can see the conversation", which the app itself already gates.
export async function uploadChatImage(dataUri, conversationId) {
  if (!supabase) throw new Error('Image storage is not configured');
  await ensureBucket();

  const match = /^data:(image\/\w+);base64,(.+)$/.exec(dataUri);
  if (!match) throw new Error('Expected a base64 image data URI');
  const [, mimeType, base64] = match;
  const ext = mimeType.split('/')[1] || 'png';
  const buffer = Buffer.from(base64, 'base64');
  if (buffer.length > 8 * 1024 * 1024) throw new Error('Image must be under 8MB');

  const path = `${conversationId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, { contentType: mimeType });
  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
