"use client"

import { useMemo } from "react"
import { ArrowDownLeft, ArrowUpRight, Check, Wallet, PieChart } from "lucide-react"
import { formatBaht, getCategory, type Category, type Transaction } from "./categories"
import { CategoryGlyph } from "./category-glyph"
import { MemberAvatar } from "./member-avatar"
import { memberBalances } from "@/lib/balances"
import { simplifyDebts } from "@/lib/balances"
import type { Member } from "./types"

/**
 * Personal settlement summary — answers the only two questions that matter to
 * the current member: who pays me, and who do I pay. Everything is net (the
 * fewest real transfers), so it never contradicts the headline balance.
 */
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
  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members])
  const me = currentMember.id

  const { net, iGet, iPay } = useMemo(() => {
    const balances = memberBalances(members, transactions)
    const transfers = simplifyDebts(balances)
    const iGet = transfers
      .filter((t) => t.to === me)
      .map((t) => ({ member: memberById.get(t.from), amount: t.amount }))
      .sort((a, b) => b.amount - a.amount)
    const iPay = transfers
      .filter((t) => t.from === me)
      .map((t) => ({ member: memberById.get(t.to), amount: t.amount }))
      .sort((a, b) => b.amount - a.amount)
    return { net: balances[me] ?? 0, iGet, iPay }
  }, [members, transactions, me, memberById])

  // What the current member personally consumed this round (their share of each
  // expense, regardless of who fronted it) — grouped by category.
  const mySpending = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of transactions) {
      if (t.kind === "income" || t.settled) continue
      const share = Number(t.shares?.[me]) || 0
      if (share > 0) map.set(t.categoryId, (map.get(t.categoryId) ?? 0) + share)
    }
    const rows = [...map.entries()]
      .map(([id, value]) => ({ cat: getCategory(id, categories), value: Math.round(value * 100) / 100 }))
      .sort((a, b) => b.value - a.value)
    const total = rows.reduce((s, r) => s + r.value, 0)
    return { rows, total: Math.round(total * 100) / 100 }
  }, [transactions, categories, me])

  const getTotal = iGet.reduce((s, x) => s + x.amount, 0)
  const payTotal = iPay.reduce((s, x) => s + x.amount, 0)
  const settled = Math.abs(net) < 0.005

  return (
    <div className="space-y-4 px-5 pt-2">
      {/* ── Headline: your net position ── */}
      <section
        className={`rounded-[1.5rem] p-5 ring-1 ${
          settled ? "bg-card ring-border" : net > 0 ? "bg-success/12 ring-success/25" : "bg-destructive/10 ring-destructive/25"
        }`}
      >
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Wallet className="size-3.5" /> ยอดสุทธิของคุณ
        </div>
        <p
          className={`mt-1.5 text-3xl font-bold tabular-nums ${
            settled ? "text-foreground" : net > 0 ? "text-success" : "text-destructive"
          }`}
        >
          {net > 0 ? "+" : net < 0 ? "−" : ""}฿{formatBaht(Math.abs(net))}
        </p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {settled
            ? "เคลียร์ยอดครบแล้ว 🎉"
            : net > 0
            ? `รวมที่จะได้รับคืนจาก ${iGet.length} คน`
            : `รวมที่ต้องจ่ายให้ ${iPay.length} คน`}
        </p>
      </section>

      {/* ── คุณจะได้รับ ── */}
      <PeopleCard
        title="คุณจะได้รับ"
        hint="เพื่อนที่ต้องโอนเงินคืนคุณ"
        icon={<ArrowDownLeft className="size-4" />}
        tone="get"
        total={getTotal}
        rows={iGet}
        emptyText="ยังไม่มีใครต้องจ่ายคืนคุณ"
      />

      {/* ── คุณต้องจ่าย ── */}
      <PeopleCard
        title="คุณต้องจ่าย"
        hint="คนที่คุณต้องโอนเงินให้"
        icon={<ArrowUpRight className="size-4" />}
        tone="pay"
        total={payTotal}
        rows={iPay}
        emptyText="คุณไม่ติดใครเลย 🎉"
      />

      {/* ── What you personally spent on ── */}
      <section className="rounded-[1.5rem] bg-card p-5 ring-1 ring-border">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <PieChart className="size-4 text-muted-foreground" /> คุณใช้จ่ายไปกับอะไร
          </h3>
          <span className="text-sm font-bold tabular-nums text-foreground">฿{formatBaht(mySpending.total)}</span>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">ส่วนที่คุณต้องช่วยหารในรอบนี้</p>

        {mySpending.rows.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">ยังไม่มีค่าใช้จ่าย</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {mySpending.rows.map(({ cat, value }) => {
              const pct = mySpending.total ? Math.round((value / mySpending.total) * 100) : 0
              return (
                <li key={cat.id} className="flex items-center gap-2.5">
                  <span className="grid size-8 shrink-0 place-items-center rounded-xl">
                    <CategoryGlyph category={cat} size={20} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground">{cat.label}</span>
                      <span className="text-muted-foreground">{pct}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: cat.color }} />
                    </div>
                  </div>
                  <span className="w-16 shrink-0 text-right text-xs font-semibold tabular-nums text-foreground">฿{formatBaht(value)}</span>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}

function PeopleCard({
  title,
  hint,
  icon,
  tone,
  total,
  rows,
  emptyText,
}: {
  title: string
  hint: string
  icon: React.ReactNode
  tone: "get" | "pay"
  total: number
  rows: { member?: Member; amount: number }[]
  emptyText: string
}) {
  const isGet = tone === "get"
  const sign = isGet ? "+" : "−"
  const toneText = isGet ? "text-success" : "text-destructive"
  const toneBadge = isGet ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
  const toneIcon = isGet ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"

  return (
    <section className="rounded-[1.5rem] bg-card p-5 ring-1 ring-border">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <span className={`grid size-6 place-items-center rounded-full ${toneIcon}`}>{icon}</span>
            {title}
          </h3>
          <p className="ml-8 text-xs text-muted-foreground">{hint}</p>
        </div>
        {rows.length > 0 && (
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold tabular-nums ${toneBadge}`}>
            {sign}฿{formatBaht(total)}
          </span>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="flex items-center gap-2 px-1 pt-3 text-sm text-muted-foreground">
          <Check className="size-4 text-success" /> {emptyText}
        </div>
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.map((r, i) => (
            <li key={i} className="flex items-center gap-3 rounded-2xl bg-secondary/60 px-3 py-2.5">
              {r.member ? <MemberAvatar member={r.member} size={36} /> : <span className="size-9 rounded-full bg-secondary" />}
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{r.member?.name ?? "—"}</span>
              <span className={`shrink-0 text-base font-bold tabular-nums ${toneText}`}>
                {sign}฿{formatBaht(r.amount)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
