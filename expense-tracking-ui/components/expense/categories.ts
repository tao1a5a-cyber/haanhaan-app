import {
  UtensilsCrossed,
  ShoppingBag,
  Car,
  PartyPopper,
  PawPrint,
  Ellipsis,
  type LucideIcon,
} from "lucide-react"

export type SplitMode = "split" | "custom" | "request"

export type Category = {
  id: string
  label: string
  /** built-in categories use a Lucide icon */
  icon?: LucideIcon
  /** custom categories use an emoji glyph */
  emoji?: string
  /** tailwind classes for the soft icon chip background + foreground */
  tint: string
  /** solid color (oklch) used for charts and progress bars */
  color: string
}

export const categories: Category[] = [
  { id: "food", label: "อาหาร", icon: UtensilsCrossed, tint: "bg-[oklch(0.94_0.05_55)] text-[oklch(0.5_0.13_45)]", color: "oklch(0.64 0.15 45)" },
  { id: "supplies", label: "ของใช้", icon: ShoppingBag, tint: "bg-[oklch(0.93_0.05_300)] text-[oklch(0.5_0.13_310)]", color: "oklch(0.58 0.15 310)" },
  { id: "travel", label: "เดินทาง", icon: Car, tint: "bg-[oklch(0.92_0.06_240)] text-[oklch(0.5_0.13_250)]", color: "oklch(0.58 0.13 250)" },
  { id: "fun", label: "เที่ยว", icon: PartyPopper, tint: "bg-[oklch(0.93_0.06_150)] text-[oklch(0.48_0.12_155)]", color: "oklch(0.56 0.12 155)" },
  { id: "pet", label: "สัตว์เลี้ยง", icon: PawPrint, tint: "bg-[oklch(0.93_0.05_80)] text-[oklch(0.5_0.12_70)]", color: "oklch(0.64 0.12 70)" },
  { id: "other", label: "อื่นๆ", icon: Ellipsis, tint: "bg-muted text-muted-foreground", color: "oklch(0.62 0.02 60)" },
]

/** soft tint palette cycled through for user-created categories */
export const customTints = [
  "bg-[oklch(0.93_0.05_20)] text-[oklch(0.52_0.16_25)]",
  "bg-[oklch(0.93_0.05_180)] text-[oklch(0.48_0.1_190)]",
  "bg-[oklch(0.94_0.06_110)] text-[oklch(0.5_0.12_120)]",
  "bg-[oklch(0.93_0.05_330)] text-[oklch(0.5_0.14_340)]",
  "bg-[oklch(0.92_0.05_265)] text-[oklch(0.5_0.14_275)]",
]

export const customColors = [
  "oklch(0.6 0.16 25)",
  "oklch(0.56 0.1 190)",
  "oklch(0.6 0.12 120)",
  "oklch(0.58 0.14 340)",
  "oklch(0.56 0.14 275)",
]

/** cute, curated emoji set for the category picker */
export const emojiChoices = [
  "🍜", "☕", "🍰", "🍣", "🍻", "🛒", "🏠", "💡",
  "🚕", "⛽", "✈️", "🏖️", "🎬", "🎮", "🎁", "💊",
  "🐶", "🐱", "🌷", "💅", "👕", "📚", "💻", "🧾",
]

export function makeCustomCategory(label: string, emoji: string, index: number): Category {
  return {
    id: `custom-${Date.now()}`,
    label: label.trim() || "หมวดใหม่",
    emoji,
    tint: customTints[index % customTints.length],
    color: customColors[index % customColors.length],
  }
}

export const splitModes: { id: SplitMode; label: string; hint: string }[] = [
  { id: "split", label: "หารเท่ากัน", hint: "แบ่งเท่ากันทุกคน" },
  { id: "custom", label: "กำหนดเอง", hint: "ระบุสัดส่วนเอง" },
  { id: "request", label: "ฝากจ่าย", hint: "คนอื่นจ่ายคืนเต็ม" },
]

// Transaction now lives in ./types (multi-member shares model).
export type { Transaction } from "./types"

export function getCategory(id: string, list: Category[] = categories): Category {
  return (
    list.find((c) => c.id === id) ??
    categories.find((c) => c.id === id) ??
    categories[categories.length - 1]
  )
}

export function formatBaht(n: number) {
  return new Intl.NumberFormat("th-TH", {
    minimumFractionDigits: n % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(n)
}
