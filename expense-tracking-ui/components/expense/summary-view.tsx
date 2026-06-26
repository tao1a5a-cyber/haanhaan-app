"use client"

import { useMemo, useState } from "react"
import { PieChart } from "lucide-react"
import { getCategory, formatBaht, type Category, type Transaction } from "./categories"
import { CategoryGlyph } from "./category-glyph"
import { DonutChart } from "./donut-chart"
import type { User } from "./users"

type Period = "day" | "month" | "year"

const periods: { id: Period; label: string }[] = [
  { id: "day", label: "วันนี้" },
  { id: "month", label: "เดือนนี้" },
  { id: "year", label: "ปีนี้" },
]

function inPeriod(ts: number, p: Period) {
  const d = new Date(ts)
  const now = new Date()
  if (p === "day")
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    )
  if (p === "month")
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  return d.getFullYear() === now.getFullYear()
}

function periodLabel(p: Period) {
  const now = new Date()
  if (p === "day")
    return now.toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long" })
  if (p === "month") return now.toLocaleDateString("th-TH", { month: "long", year: "numeric" })
  return "ปี " + now.toLocaleDateString("th-TH", { year: "numeric" })
}

export function SummaryView({
  transactions,
  categories,
  user,
  partner,
}: {
  transactions: Transaction[]
  categories: Category[]
  user: User
  partner: User
}) {
  const [period, setPeriod] = useState<Period>("month")
  const periodIndex = periods.findIndex((p) => p.id === period)

  const data = useMemo(() => {
    const txs = transactions.filter((t) => inPeriod(t.createdAt, period))
    const total = txs.reduce((s, t) => s + t.amount, 0)
    const paidByUser = txs
      .filter((t) => t.payerId === user.id)
      .reduce((s, t) => s + t.amount, 0)
    const paidByPartner = txs
      .filter((t) => t.payerId === partner.id)
      .reduce((s, t) => s + t.amount, 0)

    const byCatMap = new Map<string, number>()
    txs.forEach((t) => {
      byCatMap.set(t.categoryId, (byCatMap.get(t.categoryId) ?? 0) + t.amount)
    })
    const byCat = [...byCatMap.entries()]
      .map(([id, value]) => ({ cat: getCategory(id, categories), value }))
      .sort((a, b) => b.value - a.value)

    const now = new Date()
    let days = 1
    if (period === "month") days = now.getDate()
    else if (period === "year")
      days = Math.round((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 86400000) + 1

    return {
      count: txs.length,
      total,
      paidByUser,
      paidByPartner,
      byCat,
      avgPerTx: txs.length ? total / txs.length : 0,
      avgPerDay: period === "day" ? total : total / days,
    }
  }, [transactions, categories, period, user.id, partner.id])

  return (
    <div className="space-y-5 px-5 pt-2">
      {/* Period switch */}
      <div className="relative grid grid-cols-3 rounded-2xl bg-secondary p-1">
        <span
          className="absolute inset-y-1 w-[calc(33.333%-0.25rem)] rounded-xl bg-card shadow-sm ring-1 ring-border transition-transform duration-300 ease-out"
          style={{ transform: `translateX(calc(${periodIndex * 100}% + ${periodIndex * 0.25}rem))` }}
        />
        {periods.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPeriod(p.id)}
            className={`relative z-10 rounded-xl py-2 text-sm font-medium transition-colors ${
              period === p.id ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <p className="-mt-2 text-center text-xs text-muted-foreground">{periodLabel(period)}</p>

      {/* Total card */}
      <div className="relative overflow-hidden rounded-[1.75rem] bg-primary p-6 text-primary-foreground shadow-[0_18px_40px_-18px_oklch(0.3_0.04_55/0.7)]">
        <div className="pointer-events-none absolute -right-10 -top-12 size-44 rounded-full bg-accent/25 blur-2xl" />
        <p className="text-sm font-medium text-primary-foreground/75">ค่าใช้จ่ายรวม</p>
        <div className="mt-1 flex items-end gap-1.5">
          <span className="mb-1 text-2xl font-medium text-primary-foreground/70">฿</span>
          <span className="text-5xl font-bold tracking-tight tabular-nums">{formatBaht(data.total)}</span>
        </div>
        <p className="mt-1 text-sm text-primary-foreground/80">
          {data.count ? `${data.count} รายการ` : "ยังไม่มีรายการ"}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white/15 p-3 backdrop-blur-sm">
            <p className="text-xs text-primary-foreground/75">{user.name} จ่าย</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums">฿{formatBaht(data.paidByUser)}</p>
          </div>
          <div className="rounded-2xl bg-white/15 p-3 backdrop-blur-sm">
            <p className="text-xs text-primary-foreground/75">{partner.name} จ่าย</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums">฿{formatBaht(data.paidByPartner)}</p>
          </div>
        </div>
      </div>

      {/* Chart + breakdown */}
      <div className="rounded-[1.75rem] bg-card p-5 ring-1 ring-border">
        <h2 className="mb-4 text-base font-semibold text-foreground">แยกตามหมวดหมู่</h2>

        {data.byCat.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10">
            <div className="grid size-12 place-items-center rounded-full bg-secondary text-muted-foreground">
              <PieChart className="size-6" />
            </div>
            <p className="text-sm text-muted-foreground">ยังไม่มีข้อมูลในช่วงนี้</p>
          </div>
        ) : (
          <>
            <div className="flex justify-center">
              <div className="relative grid place-items-center">
                <DonutChart
                  slices={data.byCat.map((c) => ({
                    label: c.cat.label,
                    value: c.value,
                    color: c.cat.color,
                  }))}
                  total={data.total}
                />
                <div className="absolute flex flex-col items-center">
                  <span className="text-xs text-muted-foreground">รวม</span>
                  <span className="text-xl font-bold tabular-nums text-foreground">
                    ฿{formatBaht(data.total)}
                  </span>
                </div>
              </div>
            </div>

            <ul className="mt-5 space-y-3">
              {data.byCat.map(({ cat, value }) => {
                const pct = data.total ? Math.round((value / data.total) * 100) : 0
                return (
                  <li key={cat.id} className="flex items-center gap-3">
                    <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${cat.tint}`}>
                      <CategoryGlyph category={cat} size={17} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-foreground">{cat.label}</span>
                        <span className="text-muted-foreground">{pct}%</span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, backgroundColor: cat.color }}
                        />
                      </div>
                    </div>
                    <span className="text-sm font-semibold tabular-nums text-foreground">
                      ฿{formatBaht(value)}
                    </span>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </div>

      {/* Averages */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-card p-4 ring-1 ring-border">
          <p className="text-xs text-muted-foreground">เฉลี่ยต่อรายการ</p>
          <p className="mt-0.5 text-xl font-semibold tabular-nums text-foreground">
            ฿{formatBaht(data.avgPerTx)}
          </p>
        </div>
        <div className="rounded-2xl bg-card p-4 ring-1 ring-border">
          <p className="text-xs text-muted-foreground">
            {period === "day" ? "วันนี้ทั้งหมด" : "เฉลี่ยต่อวัน"}
          </p>
          <p className="mt-0.5 text-xl font-semibold tabular-nums text-foreground">
            ฿{formatBaht(data.avgPerDay)}
          </p>
        </div>
      </div>
    </div>
  )
}
