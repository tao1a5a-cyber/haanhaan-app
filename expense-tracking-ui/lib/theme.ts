"use client"

import { useCallback, useEffect, useState } from "react"

/**
 * Light/Dark theme, driven by an explicit `.dark` / `.light` class on <html>
 * and persisted in localStorage. The no-flash inline script in app/layout.tsx
 * applies the stored choice before React hydrates.
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

export function setTheme(mode: ThemeMode) {
  try {
    window.localStorage.setItem(KEY, mode)
  } catch {
    /* storage disabled */
  }
  applyThemeClass(mode)
}

/** Reactive [mode, toggle] for the settings switch. */
export function useThemeMode(): [ThemeMode, () => void] {
  const [mode, setMode] = useState<ThemeMode>("light")

  // Sync from storage on mount (server render is always "light").
  useEffect(() => {
    setMode(getStoredTheme())
  }, [])

  const toggle = useCallback(() => {
    setMode((prev) => {
      const next: ThemeMode = prev === "dark" ? "light" : "dark"
      setTheme(next)
      return next
    })
  }, [])

  return [mode, toggle]
}
