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
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
const AUDIO_TYPES = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/x-m4a'];
let bucketReady = null;

// Lazily creates (or, for a bucket that already existed before voice
// messages shipped, widens) the bucket on first real use rather than at
// import time — keeps a missing/misconfigured Supabase project from
// crashing server startup, and avoids a network call before anyone's
// actually uploaded anything.
async function ensureBucket() {
  if (bucketReady) return bucketReady;
  bucketReady = (async () => {
    const allowedMimeTypes = [...IMAGE_TYPES, ...AUDIO_TYPES];
    const { data: existing } = await supabase.storage.getBucket(BUCKET);
    if (existing) {
      const { error } = await supabase.storage.updateBucket(BUCKET, { public: true, fileSizeLimit: '8mb', allowedMimeTypes });
      if (error) throw error;
      return;
    }
    const { error } = await supabase.storage.createBucket(BUCKET, { public: true, fileSizeLimit: '8mb', allowedMimeTypes });
    // A harmless race if two requests both find no bucket and both try to
    // create it — the second one's "already exists" is not a real failure.
    if (error && !/already exists/i.test(error.message)) throw error;
  })();
  return bucketReady;
}

// Uploads a data-URI image or voice clip (what the frontend's file input /
// MediaRecorder + FileReader produce) and returns its public URL. Public
// bucket + public URLs, not signed ones — chat attachments here don't need
// to be access-controlled beyond "you can see the conversation", which the
// app itself already gates.
export async function uploadChatFile(dataUri, conversationId, kind) {
  if (!supabase) throw new Error(`${kind === 'audio' ? 'Voice messages' : 'Image sharing'} is not configured on this server`);
  await ensureBucket();

  // The media-type segment can carry extra `;param=value` parts before
  // `;base64,` — e.g. MediaRecorder.mimeType is commonly reported as
  // "audio/webm;codecs=opus", which flows straight into the Blob's type and
  // then into this data URI. A stricter pattern (type/subtype immediately
  // followed by ;base64,) rejects every real voice recording.
  const match = /^data:([\w-]+\/[\w-]+)(?:;[^;,]+)*;base64,([\s\S]+)$/.exec(dataUri);
  if (!match) throw new Error(`Expected a base64 ${kind} data URI`);
  const [, mimeType, base64] = match;
  const allowed = kind === 'audio' ? AUDIO_TYPES : IMAGE_TYPES;
  if (!allowed.includes(mimeType)) throw new Error(`Unsupported ${kind} type: ${mimeType}`);
  const ext = mimeType.split('/')[1] || (kind === 'audio' ? 'webm' : 'png');
  const buffer = Buffer.from(base64, 'base64');
  if (buffer.length > 8 * 1024 * 1024) throw new Error(`${kind === 'audio' ? 'Voice message' : 'Image'} must be under 8MB`);

  const path = `${conversationId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, { contentType: mimeType });
  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
