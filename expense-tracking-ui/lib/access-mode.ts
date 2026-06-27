/**
 * Access modes for visitors who are NOT signed in with a Supabase account.
 *
 *  - "guest" — fully offline. All data lives in localStorage (see guest-store).
 *    Capped at GUEST_TX_LIMIT transactions, after which we nudge to sign in.
 *  - "room"  — a shareable Room Code points at one cloud group. The visitor
 *    reads/writes that group through the normal Supabase anon client (RLS is
 *    permissive), without creating their own account.
 *
 * A signed-in account always takes precedence; logging in (or out) clears both
 * flags via exitLocalModes().
 */

const GUEST_KEY = "haanhaan:guest"
const ROOM_KEY = "haanhaan:room-code"

/** Max transactions a guest may store locally before being asked to sign in. */
export const GUEST_TX_LIMIT = 100

export function isGuestMode(): boolean {
  if (typeof window === "undefined") return false
  try {
    return window.localStorage.getItem(GUEST_KEY) === "1"
  } catch {
    return false
  }
}

export function enterGuestMode() {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(GUEST_KEY, "1")
    window.localStorage.removeItem(ROOM_KEY)
  } catch {
    /* storage disabled */
  }
}

/** The Room Code the visitor is currently browsing through (null = not in a room). */
export function getRoomCode(): string | null {
  if (typeof window === "undefined") return null
  try {
    return window.localStorage.getItem(ROOM_KEY)
  } catch {
    return null
  }
}

export function enterRoomMode(code: string) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(ROOM_KEY, code.trim().toUpperCase())
    window.localStorage.removeItem(GUEST_KEY)
  } catch {
    /* storage disabled */
  }
}

/** Drop both guest + room flags — called whenever a real account is active. */
export function exitLocalModes() {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(GUEST_KEY)
    window.localStorage.removeItem(ROOM_KEY)
  } catch {
    /* ignore */
  }
}
