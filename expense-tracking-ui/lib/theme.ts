"use client"

import { useCallback, useSyncExternalStore } from "react"

/**
 * Light/Dark theme, driven by an explicit `.dark` / `.light` class on <html>
 * and persisted in localStorage. The no-flash inline script in app/layout.tsx
 * applies the stored choice before React hydrates.
 *
 * A tiny module-level store lets EVERY useThemeMode() consumer re-render the
 * instant the theme changes — without it, two separate hooks (e.g. the page and
 * the settings switch) keep independent state and drift out of sync until a
 * reload.
 */

export type ThemeMode = "light" | "dark"

const KEY = "haanhaan:theme"

export function getStoredTheme(): ThemeMode {
  if (typeof window === "undefined") return "light"
  try {
    return window.localStorage.getItem(KEY) === "dark" ? "dark" : "light"
  } catch {
    return "light"
  }
}

function applyThemeClass(mode: ThemeMode) {
  if (typeof document === "undefined") return
  const el = document.documentElement
  el.classList.toggle("dark", mode === "dark")
  el.classList.toggle("light", mode === "light")
}

// ── Shared store so all hook instances update together ─────
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  // Also react to changes from other tabs.
  if (typeof window !== "undefined") window.addEventListener("storage", cb)
  return () => {
    listeners.delete(cb)
    if (typeof window !== "undefined") window.removeEventListener("storage", cb)
  }
}

export function setTheme(mode: ThemeMode) {
  try {
    window.localStorage.setItem(KEY, mode)
  } catch {
    /* storage disabled */
  }
  applyThemeClass(mode)
  emit()
}

/** Reactive [mode, toggle] for the settings switch. Shared across all callers. */
export function useThemeMode(): [ThemeMode, () => void] {
  const mode = useSyncExternalStore(subscribe, getStoredTheme, () => "light" as ThemeMode)

  const toggle = useCallback(() => {
    setTheme(getStoredTheme() === "dark" ? "light" : "dark")
  }, [])

  return [mode, toggle]
}
