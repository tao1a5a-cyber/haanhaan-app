import {
  UtensilsCrossed,
  ShoppingBag,
  Car,
  PartyPopper,
  PawPrint,
  PiggyBank,
  type LucideIcon,
} from "lucide-react"

export type SplitMode = "split" | "custom" | "request"

export type Category = {
  id: string
  label: string
  /** built-in categories use a Lucide icon */
  icon?: LucideIcon
  /** illustrated categories use an image (public/ path) — takes priority */
  image?: string
  /** custom categories use an emoji glyph */
  emoji?: string
  /** tailwind classes for the soft icon chip background + foreground */
  tint: string
  /** solid color (oklch) used for charts and progress bars */
  color: string
}

// Order follows the illustrated icon sheet (reading order, top-left → bottom-right).
// IDs are kept stable so existing transactions keep their category mapping;
// only labels + artwork changed.
// Illustrated icons render frameless (transparent PNG, no tint circle); `tint`
// is left blank so the icon-chip wrapper draws no background. `color` is still
// used for charts/progress bars.
export const categories: Category[] = [
  { id: "food", label: "อาหาร", icon: UtensilsCrossed, image: "/categories/food.png?v=2", tint: "", color: "oklch(0.64 0.15 45)" },
  { id: "other", label: "เก็บเงิน", icon: PiggyBank, image: "/categories/savings.png?v=2", tint: "", color: "oklch(0.66 0.14 12)" },
  { id: "travel", label: "เดินทาง", icon: Car, image: "/categories/travel.png?v=2", tint: "", color: "oklch(0.58 0.13 250)" },
  { id: "fun", label: "ท่องเที่ยว", icon: PartyPopper, image: "/categories/tourism.png?v=2", tint: "", color: "oklch(0.58 0.15 310)" },
  { id: "pet", label: "สัตว์เลี้ยง", icon: PawPrint, image: "/categories/pet.png?v=2", tint: "", color: "oklch(0.64 0.12 70)" },
  { id: "supplies", label: "ช้อปปิ้ง", icon: ShoppingBag, image: "/categories/shopping.png?v=2", tint: "", color: "oklch(0.56 0.12 155)" },
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
