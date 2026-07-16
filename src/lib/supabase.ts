import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase client, or null when the project is not configured.
 *
 * Both values below are compiled into the JavaScript bundle by Vite (that is
 * what the VITE_ prefix means) and are therefore PUBLIC. That is fine and by
 * design for the anon key: it grants only what Row Level Security allows, and
 * supabase/schema.sql grants the anon role nothing at all.
 *
 * NEVER put the service_role key in a VITE_ variable, or anywhere else in this
 * directory. It bypasses RLS entirely, and anything reaching the client is
 * readable by every visitor via View Source.
 */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * When false the app runs guest-only: local boards, no login. This is the
 * default for anyone who clones the repo without a Supabase project, and it
 * means a misconfigured deploy degrades to "no knights" rather than a blank
 * screen.
 */
export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, anonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // No inbound OAuth/magic-link redirects to parse — sessions only ever
        // start from the credential challenge.
        detectSessionInUrl: false,
      },
    })
  : null;

if (import.meta.env.DEV && !isSupabaseConfigured) {
  console.info(
    "[belfry] Supabase not configured — running guest-only. " +
      "Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env to enable knight sessions."
  );
}
