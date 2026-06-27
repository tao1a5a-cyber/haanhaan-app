"use client"

import { useMemo, useState } from "react"
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts"
import { PieChart as PieIcon } from "lucide-react"
import { formatBaht, type Category, type Transaction } from "./categories"
import type { Member } from "./types"
import {
  monthlyCashflow,
  categoryBreakdown,
  memberBreakdown,
  type Mode,
  type Slice,
} from "@/lib/analytics"

const INCOME_COLOR = "#22c55e"
const EXPENSE_COLOR = "#ef4444"
const NET_COLOR = "#64748b"
const OTHER_COLOR = "#9ca3af"

function compact(n: number) {
  return new Intl.NumberFormat("th-TH", { notation: "compact", maximumFractionDigits: 1 }).format(n)
}

/** Aggregate small slices into a single "อื่นๆ (n)" slice to keep labels readable. */
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
  const series = useMemo(
    () => monthlyCashflow(transactions, currentMember.id, 6),
    [transactions, currentMember.id],
  )
  const hasData = series.some((p) => p.income !== 0 || p.expense !== 0)

  return (
    <div className="space-y-5 px-5 pt-2">
      {/* ── Combo bar + line: income vs expense over time ── */}
      <section className="rounded-[1.75rem] bg-card p-5 ring-1 ring-border">
        <h2 className="text-center text-base font-semibold text-foreground">รายรับ / รายจ่าย</h2>

        {hasData ? (
          <div className="mt-4 h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={series} margin={{ top: 8, right: 6, bottom: 0, left: -8 }} stackOffset="sign">
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                <YAxis tickFormatter={compact} tickLine={false} axisLine={false} width={46} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
                <ReferenceLine y={0} stroke="var(--border)" />
                <Tooltip
                  cursor={{ fill: "var(--secondary)", opacity: 0.4 }}
                  formatter={(value: number, name) => [`฿${formatBaht(Math.abs(value))}`, name]}
                  contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", fontSize: 12 }}
                />
                <Bar dataKey="income" name="รายรับ" stackId="a" fill={INCOME_COLOR} maxBarSize={34} isAnimationActive={false} />
                <Bar dataKey="expenseNeg" name="รายจ่าย" stackId="a" fill={EXPENSE_COLOR} maxBarSize={34} isAnimationActive={false} />
                <Line type="monotone" dataKey="net" name="ผลรวม" stroke={NET_COLOR} strokeWidth={2} dot={{ r: 3, fill: NET_COLOR }} activeDot={{ r: 4 }} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyChart />
        )}

        {/* Legend */}
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <LegendDot color={NET_COLOR} label="ผลรวม" />
          <LegendDot color={INCOME_COLOR} label="รายรับ" />
          <LegendDot color={EXPENSE_COLOR} label="รายจ่าย" />
          <span className="text-muted-foreground/70">(6 เดือนล่าสุด)</span>
        </div>
      </section>

      {/* ── Donut 1: by category ── */}
      <DonutSection
        title="ตามหมวดหมู่"
        compute={(mode) => {
          const r = categoryBreakdown(transactions, currentMember.id, mode, categories)
          return { slices: groupSmall(r.slices), total: r.total }
        }}
      />

      {/* ── Donut 2: by member ── */}
      <DonutSection
        title="ตามสมาชิก"
        compute={(mode) => {
          const r = memberBreakdown(transactions, members, currentMember.id, mode)
          return { slices: groupSmall(r.slices), total: r.total }
        }}
      />
    </div>
  )
}

function DonutSection({
  title,
  compute,
}: {
  title: string
  compute: (mode: Mode) => { slices: Slice[]; total: number }
}) {
  const [mode, setMode] = useState<Mode>("expense")
  const { slices, total } = useMemo(() => compute(mode), [compute, mode])

  return (
    <section className="rounded-[1.75rem] bg-card p-5 ring-1 ring-border">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <ModeToggle mode={mode} onChange={setMode} />
      </div>

      {slices.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10">
          <div className="grid size-12 place-items-center rounded-full bg-secondary text-muted-foreground">
            <PieIcon className="size-6" />
          </div>
          <p className="text-sm text-muted-foreground">
            {mode === "income" ? "ยังไม่มีรายรับในช่วงนี้" : "ยังไม่มีรายจ่ายในช่วงนี้"}
          </p>
        </div>
      ) : (
        <>
          <div className="mt-2 h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="value"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius={46}
                  outerRadius={72}
                  paddingAngle={slices.length > 1 ? 1.5 : 0}
                  startAngle={90}
                  endAngle={-270}
                  labelLine={false}
                  label={ExternalLabel}
                  isAnimationActive={false}
                  stroke="var(--card)"
                  strokeWidth={2}
                >
                  {slices.map((s) => (
                    <Cell key={s.id} fill={s.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Total in red, below the donut */}
          <p className="text-center text-xl font-bold tabular-nums" style={{ color: mode === "income" ? INCOME_COLOR : EXPENSE_COLOR }}>
            {mode === "income" ? "+" : "-"}฿{formatBaht(total)}
          </p>

          {/* Compact legend */}
          <ul className="mt-3 space-y-2">
            {slices.map((s) => {
              const pct = total ? Math.round((s.value / total) * 100) : 0
              return (
                <li key={s.id} className="flex items-center gap-2.5 text-sm">
                  <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="min-w-0 flex-1 truncate font-medium text-foreground">{s.label}</span>
                  <span className="text-xs text-muted-foreground">{pct}%</span>
                  <span className="w-20 text-right font-semibold tabular-nums text-foreground">฿{formatBaht(s.value)}</span>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </section>
  )
}

const RAD = Math.PI / 180

/** External pie label: a callout line from the slice to its name outside the donut. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ExternalLabel(props: any) {
  const { cx, cy, midAngle, outerRadius, payload } = props
  const cos = Math.cos(-RAD * midAngle)
  const sin = Math.sin(-RAD * midAngle)
  const sx = cx + outerRadius * cos
  const sy = cy + outerRadius * sin
  const mx = cx + (outerRadius + 14) * cos
  const my = cy + (outerRadius + 14) * sin
  const dir = cos >= 0 ? 1 : -1
  const ex = mx + dir * 18
  const ey = my
  const color = payload?.color ?? "var(--muted-foreground)"
  const label: string = payload?.label ?? ""
  const short = label.length > 12 ? label.slice(0, 11) + "…" : label

  return (
    <g>
      <polyline points={`${sx},${sy} ${mx},${my} ${ex},${ey}`} stroke={color} strokeWidth={1} fill="none" />
      <circle cx={ex} cy={ey} r={1.6} fill={color} />
      <text
        x={ex + dir * 5}
        y={ey}
        textAnchor={dir > 0 ? "start" : "end"}
        dominantBaseline="central"
        fontSize={11}
        fill="var(--foreground)"
      >
        {short}
      </text>
    </g>
  )
}

function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <div className="relative grid grid-cols-2 rounded-full bg-secondary p-1 text-xs font-medium">
      <span
        className="absolute inset-y-1 w-[calc(50%-0.25rem)] rounded-full bg-card shadow-sm ring-1 ring-border transition-transform duration-300 ease-out"
        style={{ transform: `translateX(calc(${mode === "income" ? "100% + 0.25rem" : "0%"}))` }}
      />
      <button
        type="button"
        onClick={() => onChange("expense")}
        className={`relative z-10 rounded-full px-3.5 py-1.5 transition-colors ${mode === "expense" ? "text-foreground" : "text-muted-foreground"}`}
      >
        รายจ่าย
      </button>
      <button
        type="button"
        onClick={() => onChange("income")}
        className={`relative z-10 rounded-full px-3.5 py-1.5 transition-colors ${mode === "income" ? "text-foreground" : "text-muted-foreground"}`}
      >
        รายรับ
      </button>
    </div>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="size-2.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  )
}

function EmptyChart() {
  return (
    <div className="flex h-[240px] flex-col items-center justify-center gap-2">
      <div className="grid size-12 place-items-center rounded-full bg-secondary text-muted-foreground">
        <PieIcon className="size-6" />
      </div>
      <p className="text-sm text-muted-foreground">ยังไม่มีข้อมูลในช่วงนี้</p>
    </div>
  )
}
