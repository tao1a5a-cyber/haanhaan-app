import { tryGetSupabase } from "./supabase"

/** A logged-in person (one identity across all their groups). */
export type AuthUser = {
  id: string
  email: string
  /** display name from the social provider */
  name: string
  /** provider profile picture URL ("" if none) */
  avatar: string
  /** true for a guest signed in anonymously to access a Room Code (no real account) */
  isAnonymous: boolean
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Map a raw Supabase auth user into the app's AuthUser (null when signed out). */
export function mapAuthUser(u: any): AuthUser | null {
  if (!u) return null
  const meta = u.user_metadata ?? {}
  const fallbackName = typeof u.email === "string" ? u.email.split("@")[0] : "ผู้ใช้"
  return {
    id: u.id,
    email: u.email ?? "",
    name: meta.full_name ?? meta.name ?? fallbackName,
    avatar: meta.avatar_url ?? meta.picture ?? "",
    isAnonymous: Boolean(u.is_anonymous),
  }
}

/**
 * Sign in anonymously (reusing any existing session) so a guest gets a real
 * auth uid — required for the join_room() grant + membership RLS to apply.
 * Returns the user id, or null if anonymous sign-in is disabled/unavailable.
 */
export async function ensureAnonymousSession(): Promise<string | null> {
  const db = tryGetSupabase()
  if (!db) return null
  const { data: { user } } = await db.auth.getUser()
  if (user) return user.id
  const { data, error } = await db.auth.signInAnonymously()
  if (error) { console.error("ensureAnonymousSession", error); return null }
  return data.user?.id ?? null
}

/** Current session's user, or null. */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const db = tryGetSupabase()
  if (!db) return null
  const { data } = await db.auth.getSession()
  return mapAuthUser(data.session?.user ?? null)
}

/** Subscribe to login/logout. Returns an unsubscribe function. */
export function onAuthChange(cb: (user: AuthUser | null) => void): () => void {
  const db = tryGetSupabase()
  if (!db) return () => {}
  const { data } = db.auth.onAuthStateChange((_event, session) => {
    cb(mapAuthUser(session?.user ?? null))
  })
  return () => data.subscription.unsubscribe()
}

/**
 * Start the Google OAuth flow. After the user authorizes, Google redirects
 * back to `redirectTo` (defaults to the current origin); the session is then
 * picked up automatically via detectSessionInUrl.
 */
export async function signInWithGoogle(redirectTo?: string) {
  const db = tryGetSupabase()
  if (!db) throw new Error("Supabase is not configured")
  const { error } = await db.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: redirectTo ?? (typeof window !== "undefined" ? window.location.origin : undefined),
    },
  })
  if (error) throw error
}

export async function signOut() {
  const db = tryGetSupabase()
  if (!db) return
  await db.auth.signOut()
}
