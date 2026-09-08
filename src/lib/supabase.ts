import { createClient } from "@supabase/supabase-js";

// These are the public, browser-safe Supabase credentials.
// Never place service-role keys or the Gemini key here.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anonKey) {
  // The app still renders; affected features surface a configuration error.
  console.warn(
    "ACT is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.",
  );
}

export const supabase = createClient(
  url ?? "https://placeholder.supabase.co",
  anonKey ?? "placeholder-anon-key",
);

export const isConfigured = Boolean(url && anonKey);
