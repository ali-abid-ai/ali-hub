import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(
  url &&
  key &&
  !url.includes('YOUR_PROJECT_ID') &&
  !key.includes('YOUR_SUPABASE')
);

async function timedFetch(input, init = {}) {
  const controller = new AbortController();
  const originalSignal = init.signal;
  const abortFromOriginal = () => controller.abort(originalSignal?.reason);

  if (originalSignal?.aborted) {
    abortFromOriginal();
  } else {
    originalSignal?.addEventListener('abort', abortFromOriginal, { once: true });
  }

  const timeout = setTimeout(() => {
    controller.abort(new Error('Network request timed out after 120 seconds.'));
  }, 120000);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
    originalSignal?.removeEventListener('abort', abortFromOriginal);
  }
}

export const supabase = isSupabaseConfigured
  ? createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      global: {
        fetch: timedFetch,
      },
    })
  : null;
