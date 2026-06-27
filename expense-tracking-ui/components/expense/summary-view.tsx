"use client"

import { useMemo, useState } from "react"
import { Wallet, Layers, Users, Inbox } from "lucide-react"
import { formatBaht, type Category, type Transaction } from "./categories"
import type { Member } from "./types"
import { memberBalances, myNet } from "@/lib/balances"
import { categoryBreakdown, memberBreakdown, type Mode, type Slice } from "@/lib/analytics"

const INCOME_COLOR = "#22c55e"
const EXPENSE_COLOR = "#ef4444"
const OTHER_COLOR = "#9ca3af"

/** Roll up small slices into one "อื่นๆ" row so the list stays short. */
function groupSmall(slices: Slice[], max = 6): Slice[] {
  if (slices.length <= max) return slices
  const head = slices.slice(0, max - 1)
  const tail = slices.slice(max - 1)
  const rest = tail.reduce((s, x) => s + x.value, 0)
  return [...head, { id: "other", label: `อื่นๆ (${tail.length})`, value: Math.round(rest * 100) / 100, color: OTHER_COLOR }]
}

export function SummaryView({
  transactions,
  categories,
  members,
  currentMember,
}: {
  transactions: Transaction[]
  categories: Category[]
  members: Member[]
  currentMember: Member
}) {
  const [mode, setMode] = useState<Mode>("expense")

  // Overall balance — income-aware net for the current member.
  const net = useMemo(
    () => myNet(currentMember.id, memberBalances(members, transactions)),
    [members, transactions, currentMember.id],
  )

  const byCategory = useMemo(() => {
    const r = categoryBreakdown(transactions, currentMember.id, mode, categories)
    return { slices: groupSmall(r.slices), total: r.total }
  }, [transactions, currentMember.id, mode, categories])

  const byMember = useMemo(() => {
    const r = memberBreakdown(transactions, members, currentMember.id, mode)
    return { slices: groupSmall(r.slices), total: r.total }
  }, [transactions, members, currentMember.id, mode])

  return (
    <div className="space-y-4 px-5 pt-2">
      {/* ── Overall balance ── */}
      <section className="rounded-[1.5rem] bg-card p-5 ring-1 ring-border">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Wallet className="size-3.5" />
          ยอดสุทธิของคุณ
        </div>
        <p
          className="mt-1.5 text-3xl font-bold tabular-nums"
          style={{ color: net > 0 ? INCOME_COLOR : net < 0 ? EXPENSE_COLOR : "var(--foreground)" }}
        >
          {net > 0 ? "+" : net < 0 ? "-" : ""}฿{formatBaht(Math.abs(net))}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {net > 0 ? "คนอื่นค้างคุณอยู่" : net < 0 ? "คุณค้างคนอื่นอยู่" : "เคลียร์ยอดแล้ว 🎉"}
        </p>
      </section>

      {/* ── One toggle drives both breakdowns ── */}
      <ModeToggle mode={mode} onChange={setMode} />

      {/* ── By category ── */}
      <BreakdownCard
        icon={<Layers className="size-4" />}
        title="ตามหมวดหมู่"
        mode={mode}
        slices={byCategory.slices}
        total={byCategory.total}
      />

      {/* ── By member ── */}
      <BreakdownCard
        icon={<Users className="size-4" />}
        title="ตามสมาชิก"
        mode={mode}
        slices={byMember.slices}
        total={byMember.total}
      />
    </div>
  )
}

function BreakdownCard({
  icon,
  title,
  mode,
  slices,
  total,
}: {
  icon: React.ReactNode
  title: string
  mode: Mode
  slices: Slice[]
  total: number
}) {
  const accent = mode === "income" ? INCOME_COLOR : EXPENSE_COLOR

  return (
    <section className="rounded-[1.5rem] bg-card p-5 ring-1 ring-border">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <span className="text-muted-foreground">{icon}</span>
          {title}
        </h3>
        <span className="text-sm font-bold tabular-nums" style={{ color: accent }}>
          {mode === "income" ? "+" : "-"}฿{formatBaht(total)}
        </span>
      </div>

      {slices.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8">
          <div className="grid size-11 place-items-center rounded-full bg-secondary text-muted-foreground">
            <Inbox className="size-5" />
          </div>
          <p className="text-xs text-muted-foreground">
            {mode === "income" ? "ยังไม่มีรายรับ" : "ยังไม่มีรายจ่าย"}
          </p>
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {slices.map((s) => {
            const pct = total ? Math.round((s.value / total) * 100) : 0
            return (
              <li key={s.id}>
                <div className="flex items-center gap-2 text-sm">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="min-w-0 flex-1 truncate font-medium text-foreground">{s.label}</span>
                  <span className="text-xs text-muted-foreground">{pct}%</span>
                  <span className="w-20 text-right font-semibold tabular-nums text-foreground">฿{formatBaht(s.value)}</span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: s.color }} />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <div className="relative grid grid-cols-2 rounded-full bg-secondary p-1 text-sm font-medium">
      <span
        className="absolute inset-y-1 w-[calc(50%-0.25rem)] rounded-full bg-card shadow-sm ring-1 ring-border transition-transform duration-300 ease-out"
        style={{ transform: `translateX(calc(${mode === "income" ? "100% + 0.25rem" : "0%"}))` }}
      />
      <button
        type="button"
        onClick={() => onChange("expense")}
        className={`relative z-10 rounded-full py-2 transition-colors ${mode === "expense" ? "text-foreground" : "text-muted-foreground"}`}
      >
        รายจ่าย
      </button>
      <button
        type="button"
        onClick={() => onChange("income")}
        className={`relative z-10 rounded-full py-2 transition-colors ${mode === "income" ? "text-foreground" : "text-muted-foreground"}`}
      >
        รายรับ
      </button>
    </div>
  )
}
