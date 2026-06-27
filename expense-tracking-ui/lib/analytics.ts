import type { Member, Transaction } from "@/components/expense/types"
import { getCategory, type Category } from "@/components/expense/categories"

export type Mode = "expense" | "income"

export type Slice = { id: string; label: string; value: number; color: string }

/** Palette used for member slices (categories carry their own color). */
export const MEMBER_COLORS = [
  "#ef4444", "#f59e0b", "#10b981", "#3b82f6",
  "#8b5cf6", "#ec4899", "#14b8a6", "#eab308",
]

function round2(n: number) {
  return Math.round(n * 100) / 100
}

/**
 * One transaction's contribution to the given member's cash flow.
 *  - income  = money others owe the member (they fronted the bill)
 *  - expense = the member's own share they owe to the payer
 */
function contribution(t: Transaction, memberId: string): { income: number; expense: number } {
  const shares = t.shares ?? {}
  if (t.payerId === memberId) {
    const othersOwe = Object.entries(shares).reduce(
      (s, [id, v]) => (id === memberId ? s : s + (Number(v) || 0)),
      0,
    )
    return { income: othersOwe, expense: 0 }
  }
  return { income: 0, expense: Number(shares[memberId]) || 0 }
}

export type MonthPoint = { label: string; income: number; expense: number; expenseNeg: number; net: number }

/** Per-member income/expense/net for the last `monthsBack` calendar months. */
export function monthlyCashflow(
  transactions: Transaction[],
  memberId: string,
  monthsBack = 6,
): MonthPoint[] {
  const now = new Date()
  const buckets = new Map<string, { income: number; expense: number }>()
  const order: { key: string; label: string }[] = []

  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${d.getMonth()}`
    buckets.set(key, { income: 0, expense: 0 })
    order.push({ key, label: d.toLocaleDateString("th-TH", { month: "short" }) })
  }

  for (const t of transactions) {
    const d = new Date(t.createdAt)
    const key = `${d.getFullYear()}-${d.getMonth()}`
    const bucket = buckets.get(key)
    if (!bucket) continue
    const c = contribution(t, memberId)
    bucket.income += c.income
    bucket.expense += c.expense
  }

  return order.map(({ key, label }) => {
    const b = buckets.get(key)!
    const income = round2(b.income)
    const expense = round2(b.expense)
    return { label, income, expense, expenseNeg: -expense, net: round2(income - expense) }
  })
}

/** Breakdown of the member's cash flow by category, for the chosen mode. */
export function categoryBreakdown(
  transactions: Transaction[],
  memberId: string,
  mode: Mode,
  categories: Category[],
): { slices: Slice[]; total: number } {
  const map = new Map<string, number>()
  for (const t of transactions) {
    const c = contribution(t, memberId)
    const v = mode === "income" ? c.income : c.expense
    if (v <= 0) continue
    map.set(t.categoryId, (map.get(t.categoryId) ?? 0) + v)
  }
  const slices = [...map.entries()]
    .map(([id, value]) => {
      const cat = getCategory(id, categories)
      return { id, label: cat.label, value: round2(value), color: cat.color }
    })
    .sort((a, b) => b.value - a.value)
  return { slices, total: round2(slices.reduce((s, x) => s + x.value, 0)) }
}

/** Breakdown of the member's cash flow by the other member involved. */
export function memberBreakdown(
  transactions: Transaction[],
  members: Member[],
  memberId: string,
  mode: Mode,
): { slices: Slice[]; total: number } {
  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? "—"
  const map = new Map<string, number>()

  for (const t of transactions) {
    const shares = t.shares ?? {}
    if (mode === "expense") {
      // What I owe the payer of each bill I didn't pay.
      if (t.payerId === memberId) continue
      const myShare = Number(shares[memberId]) || 0
      if (myShare > 0) map.set(t.payerId, (map.get(t.payerId) ?? 0) + myShare)
    } else {
      // What each other member owes me on bills I fronted.
      if (t.payerId !== memberId) continue
      for (const [id, v] of Object.entries(shares)) {
        if (id === memberId) continue
        const owed = Number(v) || 0
        if (owed > 0) map.set(id, (map.get(id) ?? 0) + owed)
      }
    }
  }

  const slices = [...map.entries()]
    .map(([id, value], i) => ({
      id,
      label: nameOf(id),
      value: round2(value),
      color: MEMBER_COLORS[i % MEMBER_COLORS.length],
    }))
    .sort((a, b) => b.value - a.value)
    // reassign colors by sorted order so the largest is always the first hue
    .map((s, i) => ({ ...s, color: MEMBER_COLORS[i % MEMBER_COLORS.length] }))

  return { slices, total: round2(slices.reduce((s, x) => s + x.value, 0)) }
}
