import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

function configProblem(): string | null {
  if (!url || !key || url.includes('your-project') || key.includes('your-public')) {
    return 'Add your Supabase project URL and public anon key to .env.local, then restart the development server.';
  }
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
  } catch {
    return 'The Supabase URL must be a valid HTTP or HTTPS URL.';
  }
  if (key.startsWith('sb_secret_'))
    return 'Use a public anon key. Secret keys must never be included in a frontend.';
  if (key.split('.').length === 3) {
    try {
      const payload = JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      if (payload.role !== 'anon')
        return 'Use the public anon key, not a service role or session key.';
    } catch {
      return 'The public anon key is invalid. Copy it again from your Supabase project settings.';
    }
  }
  return null;
}

export const configurationError = configProblem();
export const supabase: SupabaseClient | null = configurationError
  ? null
  : createClient(url!, key!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    });

let initialSession: Promise<string> | undefined;
export function ensureGuest(): Promise<string> {
  // Share the first sign-in promise across React's development remounts.
  if (!initialSession) {
    initialSession = (async () => {
      if (!supabase) throw new Error(configurationError ?? 'Supabase is not configured.');
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      if (data.session) return data.session.user.id;
      const result = await supabase.auth.signInAnonymously();
      if (result.error) throw result.error;
      return result.data.user!.id;
    })().catch((error) => {
      initialSession = undefined;
      throw error;
    });
  }
  return initialSession;
}
