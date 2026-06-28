"use client"

/**
 * Settlement Module — N-member billing-cycle summary shown before the user
 * confirms settlement. Computes who-pays-whom from net balances and shows a
 * two-sided per-member comparison (paid vs fair share → net).
 */

import { useMemo } from "react"
import { X, Check, ArrowRight, ArrowDownLeft, ArrowUpRight, Receipt } from "lucide-react"
import { getCategory, formatBaht, type Category, type Transaction } from "./categories"
import { CategoryGlyph } from "./category-glyph"
import { MemberAvatar } from "./member-avatar"
import { simplifyDebts } from "@/lib/balances"
import type { Member } from "./types"

function dateRange(txs: Transaction[]) {
  if (txs.length === 0) return "—"
  const dates = txs.map((t) => t.createdAt)
  const min = new Date(Math.min(...dates))
  const max = new Date(Math.max(...dates))
  const fmt = (d: Date) => d.toLocaleDateString("th-TH", { day: "numeric", month: "short" })
  return min.toDateString() === max.toDateString() ? fmt(min) : `${fmt(min)} – ${fmt(max)}`
}

type Props = {
  transactions: Transaction[]
  categories: Category[]
  members: Member[]
  currentMemberId: string
  balances: Record<string, number>
  /** read-only guests can view the summary but not confirm settlement */
  readOnly?: boolean
  onConfirm: () => void
  onClose: () => void
}

export function SettlementModal({
  transactions, categories, members, currentMemberId, balances, readOnly = false, onConfirm, onClose,
}: Props) {
  const unsettled = useMemo(() => transactions.filter((t) => !t.settled), [transactions])
  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members])
  const nameOf = (id: string) => (id === currentMemberId ? "คุณ" : memberById.get(id)?.name ?? "—")

  const summary = useMemo(() => {
    // Expenses vs income are different flows — keep them apart so the spend
    // total + category breakdown aren't inflated by shared earnings.
    const expenses = unsettled.filter((t) => t.kind !== "income")
    const incomeTotal = unsettled
      .filter((t) => t.kind === "income")
      .reduce((s, t) => s + t.amount, 0)

    const total = expenses.reduce((s, t) => s + t.amount, 0)
    const paidByMember = new Map<string, number>()   // fronted the bill
    const owedByMember = new Map<string, number>()    // their fair share
    for (const m of members) { paidByMember.set(m.id, 0); owedByMember.set(m.id, 0) }
    for (const t of expenses) {
      paidByMember.set(t.payerId, (paidByMember.get(t.payerId) ?? 0) + t.amount)
      for (const [mid, share] of Object.entries(t.shares ?? {})) {
        owedByMember.set(mid, (owedByMember.get(mid) ?? 0) + share)
      }
    }

    const byCatMap = new Map<string, number>()
    for (const t of expenses) byCatMap.set(t.categoryId, (byCatMap.get(t.categoryId) ?? 0) + t.amount)
    const byCat = [...byCatMap.entries()]
      .map(([id, value]) => ({ cat: getCategory(id, categories), value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)

    const slipCount = unsettled.filter((t) => t.hasSlip).length
    return { total, incomeTotal, paidByMember, owedByMember, byCat, slipCount }
  }, [unsettled, members, categories])

  const transfers = useMemo(() => simplifyDebts(balances), [balances])
  const settled = transfers.length === 0

  const myNet = balances[currentMemberId] ?? 0
  const iSettled = Math.abs(myNet) < 0.005
  const iReceive = myNet > 0
  const myIn = transfers.filter((t) => t.to === currentMemberId)   // people paying you
  const myOut = transfers.filter((t) => t.from === currentMemberId) // people you pay

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button type="button" aria-label="ปิด" onClick={onClose} className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" />

      <div className="relative flex max-h-[92dvh] w-full max-w-md animate-in slide-in-from-bottom-6 fade-in flex-col rounded-t-[2rem] bg-card shadow-2xl ring-1 ring-border duration-300 sm:rounded-[2rem]">
        <div className="mx-auto mb-1 mt-3 h-1.5 w-10 shrink-0 rounded-full bg-border sm:hidden" />

        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 pb-4 pt-2">
          <div>
            <h2 className="text-base font-semibold text-foreground">สรุปก่อนเคลียร์ยอด</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{members.length} คน · {dateRange(unsettled)}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="ปิด" className="grid size-8 place-items-center rounded-full bg-secondary text-muted-foreground transition active:scale-90">
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {unsettled.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <span className="text-4xl">✨</span>
              <p className="font-semibold text-foreground">ไม่มีรายการค้างชำระ</p>
              <p className="text-sm text-muted-foreground">ยอดทุกรายการเคลียร์แล้ว</p>
            </div>
          ) : (
            <>
              {/* ── YOUR action — the headline: what do you owe / get back? ── */}
              {iSettled ? (
                <div className="flex items-center gap-3 rounded-[1.4rem] bg-success/12 p-4 ring-1 ring-success/25">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-success/20 text-success"><Check className="size-5" /></span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">คุณเคลียร์ยอดพอดี</p>
                    <p className="text-xs text-muted-foreground">ไม่ต้องจ่ายหรือรับเพิ่ม</p>
                  </div>
                </div>
              ) : (
                <div className={`rounded-[1.4rem] p-4 ring-1 ${iReceive ? "bg-success/12 ring-success/25" : "bg-destructive/10 ring-destructive/25"}`}>
                  <div className="flex items-center gap-3">
                    <span className={`grid size-11 shrink-0 place-items-center rounded-full ${iReceive ? "bg-success/20 text-success" : "bg-destructive/15 text-destructive"}`}>
                      {iReceive ? <ArrowDownLeft className="size-5" /> : <ArrowUpRight className="size-5" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground">{iReceive ? "รวมที่คุณจะได้รับคืน" : "รวมที่คุณต้องจ่าย"}</p>
                      <p className={`text-2xl font-bold tabular-nums ${iReceive ? "text-success" : "text-destructive"}`}>
                        {iReceive ? "+" : "−"}฿{formatBaht(Math.abs(myNet))}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {(iReceive ? myIn : myOut).map((t, i) => {
                      const other = memberById.get(iReceive ? t.from : t.to)
                      return (
                        <span key={i} className="inline-flex items-center gap-1.5 rounded-full bg-card px-2.5 py-1 text-xs font-medium text-foreground ring-1 ring-border">
                          {other && <MemberAvatar member={other} size={16} />}
                          <span className="text-muted-foreground">{iReceive ? "จาก" : "ให้"}</span>
                          {other?.name}
                          <span className="font-bold tabular-nums">฿{formatBaht(t.amount)}</span>
                        </span>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* ── Who pays whom (full picture) ── */}
              <div className="rounded-[1.4rem] bg-secondary p-4 ring-1 ring-border">
                <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">ใครจ่ายให้ใคร</p>
                {settled ? (
                  <div className="flex items-center gap-2">
                    <span className="grid size-8 place-items-center rounded-full bg-success/20 text-success"><Check className="size-4" /></span>
                    <p className="text-sm font-semibold text-foreground">ยอดเท่ากันทุกคน — ไม่ต้องโอน</p>
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {transfers.map((t, i) => {
                      const mine = t.from === currentMemberId || t.to === currentMemberId
                      const from = memberById.get(t.from)
                      const to = memberById.get(t.to)
                      return (
                        <li
                          key={i}
                          className={`flex items-center gap-2 rounded-2xl px-3 py-2.5 ring-1 ${mine ? "bg-card ring-accent/45 shadow-sm" : "bg-card/60 ring-border"}`}
                        >
                          <div className="flex min-w-0 flex-1 items-center gap-1.5">
                            {from && <MemberAvatar member={from} size={24} />}
                            <span className={`truncate text-sm ${t.from === currentMemberId ? "font-bold text-foreground" : "font-medium text-foreground"}`}>{nameOf(t.from)}</span>
                          </div>
                          <div className="flex shrink-0 flex-col items-center px-1">
                            <span className="text-[10px] font-medium text-muted-foreground">จ่าย</span>
                            <ArrowRight className="size-4 text-accent" />
                          </div>
                          <div className="flex min-w-0 flex-1 items-center gap-1.5">
                            {to && <MemberAvatar member={to} size={24} />}
                            <span className={`truncate text-sm ${t.to === currentMemberId ? "font-bold text-foreground" : "font-medium text-foreground"}`}>{nameOf(t.to)}</span>
                          </div>
                          <span className="shrink-0 text-sm font-bold tabular-nums text-accent">฿{formatBaht(t.amount)}</span>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>

              {/* ── Two-sided comparison: paid vs fair share → net, per member ── */}
              <div className="rounded-[1.4rem] bg-secondary p-4 ring-1 ring-border">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">เทียบ จ่ายจริง / ส่วนที่ต้องหาร</p>
                  <p className="text-xs font-medium text-muted-foreground">รวม ฿{formatBaht(summary.total)}</p>
                </div>
                <ul className="space-y-2">
                  {members.map((m) => {
                    const paid = summary.paidByMember.get(m.id) ?? 0
                    const share = summary.owedByMember.get(m.id) ?? 0
                    const mnet = balances[m.id] ?? 0
                    const even = Math.abs(mnet) < 0.005
                    const get = mnet > 0
                    return (
                      <li key={m.id} className="rounded-2xl bg-card p-3 ring-1 ring-border">
                        <div className="flex items-center gap-2">
                          <MemberAvatar member={m} size={26} />
                          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                            {m.name}{m.id === currentMemberId ? " (คุณ)" : ""}
                          </span>
                          <span
                            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold tabular-nums ${
                              even
                                ? "bg-secondary text-muted-foreground"
                                : get
                                ? "bg-success/15 text-success"
                                : "bg-destructive/15 text-destructive"
                            }`}
                          >
                            {even ? "เท่าทุน" : get ? `ได้คืน ฿${formatBaht(mnet)}` : `จ่าย ฿${formatBaht(-mnet)}`}
                          </span>
                        </div>
                        <div className="mt-2.5 grid grid-cols-2 gap-2">
                          <div className="rounded-xl bg-secondary px-2.5 py-1.5">
                            <p className="text-[11px] text-muted-foreground">จ่ายจริง</p>
                            <p className="text-sm font-bold tabular-nums text-foreground">฿{formatBaht(paid)}</p>
                          </div>
                          <div className="rounded-xl bg-secondary px-2.5 py-1.5">
                            <p className="text-[11px] text-muted-foreground">ส่วนที่ต้องหาร</p>
                            <p className="text-sm font-bold tabular-nums text-foreground">฿{formatBaht(share)}</p>
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
                {summary.incomeTotal > 0 && (
                  <p className="mt-2.5 text-[11px] text-muted-foreground">
                    * ยอดสุทธิรวมรายรับ ฿{formatBaht(summary.incomeTotal)} ที่หารกันด้วย
                  </p>
                )}
              </div>

              {/* category breakdown */}
              {summary.byCat.length > 0 && (
                <div className="rounded-[1.4rem] bg-secondary p-4 ring-1 ring-border">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">แยกตามหมวดหมู่</p>
                  <ul className="space-y-2.5">
                    {summary.byCat.map(({ cat, value }) => {
                      const pct = summary.total ? Math.round((value / summary.total) * 100) : 0
                      return (
                        <li key={cat.id} className="flex items-center gap-2.5">
                          <span className={`grid size-8 shrink-0 place-items-center rounded-xl ${cat.tint}`}>
                            <CategoryGlyph category={cat} size={15} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex items-center justify-between text-xs">
                              <span className="font-medium text-foreground">{cat.label}</span>
                              <span className="text-muted-foreground">{pct}%</span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-card ring-1 ring-border">
                              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: cat.color }} />
                            </div>
                          </div>
                          <span className="shrink-0 text-xs font-semibold tabular-nums text-foreground">฿{formatBaht(value)}</span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}

              {summary.slipCount > 0 && (
                <div className="flex items-center gap-2.5 rounded-2xl bg-secondary px-4 py-3 ring-1 ring-border">
                  <Receipt className="size-4 shrink-0 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    มีใบเสร็จ / สลิปแนบไว้ <span className="font-semibold text-foreground">{summary.slipCount} ใบ</span> ในรอบนี้
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        <div className={`grid shrink-0 gap-3 border-t border-border px-5 py-4 ${readOnly ? "grid-cols-1" : "grid-cols-2"}`}>
          <button type="button" onClick={onClose} className="rounded-2xl bg-secondary py-3.5 text-sm font-semibold text-foreground ring-1 ring-border transition active:scale-[0.99]">
            {readOnly ? "ปิด" : "ยกเลิก"}
          </button>
          {!readOnly && (
            <button type="button" onClick={onConfirm} className="flex items-center justify-center gap-2 rounded-2xl bg-accent py-3.5 text-sm font-semibold text-accent-foreground shadow-sm transition active:scale-[0.99]">
              <Check className="size-4" />
              ยืนยันเคลียร์ยอด
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
