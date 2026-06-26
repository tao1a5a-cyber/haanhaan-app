export type ThemePreset = {
  id: string
  label: string
  swatch: string     // vivid color for the swatch circle in settings
  tint: string       // light pastel for avatar background in profile picker
  vars: {
    background: string
    primary: string
    accent: string
    ring: string
    "chart-1": string
  }
}

export const THEMES: ThemePreset[] = [
  {
    id: "amber",
    label: "อำพัน",
    swatch: "oklch(0.62 0.16 52)",
    tint: "oklch(0.93 0.05 70)",
    vars: {
      background: "oklch(0.971 0.011 75)",
      primary: "oklch(0.44 0.09 62)",
      accent: "oklch(0.62 0.16 52)",
      ring: "oklch(0.62 0.16 52)",
      "chart-1": "oklch(0.62 0.16 52)",
    },
  },
  {
    id: "violet",
    label: "ม่วง",
    swatch: "oklch(0.60 0.22 295)",
    tint: "oklch(0.93 0.05 295)",
    vars: {
      background: "oklch(0.975 0.008 295)",
      primary: "oklch(0.42 0.14 295)",
      accent: "oklch(0.60 0.22 295)",
      ring: "oklch(0.60 0.22 295)",
      "chart-1": "oklch(0.60 0.22 295)",
    },
  },
  {
    id: "indigo",
    label: "คราม",
    swatch: "oklch(0.58 0.22 265)",
    tint: "oklch(0.93 0.05 260)",
    vars: {
      background: "oklch(0.975 0.008 260)",
      primary: "oklch(0.42 0.14 260)",
      accent: "oklch(0.58 0.22 265)",
      ring: "oklch(0.58 0.22 265)",
      "chart-1": "oklch(0.58 0.22 265)",
    },
  },
  {
    id: "teal",
    label: "เทอร์คอยซ์",
    swatch: "oklch(0.58 0.18 195)",
    tint: "oklch(0.93 0.05 195)",
    vars: {
      background: "oklch(0.975 0.010 195)",
      primary: "oklch(0.42 0.12 195)",
      accent: "oklch(0.58 0.18 195)",
      ring: "oklch(0.58 0.18 195)",
      "chart-1": "oklch(0.58 0.18 195)",
    },
  },
  {
    id: "forest",
    label: "เขียว",
    swatch: "oklch(0.56 0.18 145)",
    tint: "oklch(0.93 0.05 145)",
    vars: {
      background: "oklch(0.973 0.010 145)",
      primary: "oklch(0.40 0.12 145)",
      accent: "oklch(0.56 0.18 145)",
      ring: "oklch(0.56 0.18 145)",
      "chart-1": "oklch(0.56 0.18 145)",
    },
  },
  {
    id: "rose",
    label: "กุหลาบ",
    swatch: "oklch(0.62 0.22 10)",
    tint: "oklch(0.93 0.05 10)",
    vars: {
      background: "oklch(0.975 0.010 10)",
      primary: "oklch(0.45 0.14 10)",
      accent: "oklch(0.62 0.22 10)",
      ring: "oklch(0.62 0.22 10)",
      "chart-1": "oklch(0.62 0.22 10)",
    },
  },
]

export const DEFAULT_THEME = THEMES[0]

export function getTheme(id: string | undefined): ThemePreset {
  if (!id) return DEFAULT_THEME
  return THEMES.find((t) => t.id === id) ?? DEFAULT_THEME
}
