/**
 * Guest Mode flag for visitors who are NOT signed in with any Supabase session.
 *
 * Guest Mode is fully offline: all data lives in localStorage (see guest-store),
 * capped at GUEST_TX_LIMIT transactions, after which we nudge the user to sign in.
 *
 * Room access is NOT a flag here — a guest who enters a Room Code is signed in
 * anonymously (a real auth uid with a join_room grant), so the Supabase session
 * itself carries that state. A real account always wins and clears this flag.
 */

const GUEST_KEY = "haanhaan:guest"

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
  } catch {
    /* storage disabled */
  }
}

/** Drop the guest flag — called whenever a real account is active. */
export function exitLocalModes() {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(GUEST_KEY)
  } catch {
    /* ignore */
  }
}
