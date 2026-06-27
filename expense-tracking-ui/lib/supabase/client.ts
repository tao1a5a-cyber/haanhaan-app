"use client"

import { getSupabase } from "@/lib/supabase"

// Single source of truth for the browser client. Re-uses the app-wide
// singleton in lib/supabase.ts (now cookie-based via @supabase/ssr) so there
// is exactly one GoTrueClient instance and one shared session.
export function createClient() {
  return getSupabase()
}
