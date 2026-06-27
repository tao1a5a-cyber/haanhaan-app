import { createBrowserClient } from "@supabase/ssr"
import { type SupabaseClient } from "@supabase/supabase-js"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""

export const isSupabaseConfigured = Boolean(url && anonKey)

let _client: SupabaseClient | null = null

/**
 * The single browser Supabase client for the whole app.
 *
 * Uses @supabase/ssr's createBrowserClient so the session is stored in
 * COOKIES (not localStorage). This makes the login shared with the
 * server-side SSR client (middleware, /ledger, route handlers): sign in
 * anywhere and you're authenticated everywhere.
 */
export function getSupabase(): SupabaseClient {
  if (!_client) {
    if (!isSupabaseConfigured) {
      throw new Error("Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local")
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _client = createBrowserClient<any>(url, anonKey)
  }
  return _client
}

/** Use supabase only if configured — returns null otherwise (offline mode). */
export function tryGetSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null
  return getSupabase()
}
