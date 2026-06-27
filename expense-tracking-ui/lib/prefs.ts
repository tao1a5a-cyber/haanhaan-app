/**
 * Lightweight, client-only persistence of the user's last context so the app
 * can skip the "pick a group / who are you" steps on the next open.
 * Stored in localStorage — no sensitive data, just the last selected ids.
 */

const KEY = "haanhaan:last-context"

export type LastContext = {
  groupId: string
  memberId: string
}

export function loadLastContext(): LastContext | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed.groupId === "string" && typeof parsed.memberId === "string") {
      return parsed
    }
  } catch {
    /* ignore malformed storage */
  }
  return null
}

export function saveLastContext(ctx: LastContext) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(KEY, JSON.stringify(ctx))
  } catch {
    /* storage may be full or disabled */
  }
}

export function clearLastContext() {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}
