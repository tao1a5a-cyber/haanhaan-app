"use client"

/**
 * Settlement Module — N-member billing-cycle summary shown before the user
 * confirms settlement. Computes who-pays-whom from net balances.
 */

import { useMemo } from "react"
import { X, Check, ArrowRight, Receipt } from "lucide-react"
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
  onConfirm: () => void
  onClose: () => void
}

export function SettlementModal({
  transactions, categories, members, currentMemberId, balances, onConfirm, onClose,
}: Props) {
  const unsettled = useMemo(() => transactions.filter((t) => !t.settled), [transactions])
  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members])
  const nameOf = (id: string) => memberById.get(id)?.name ?? "—"

  const summary = useMemo(() => {
    const total = unsettled.reduce((s, t) => s + t.amount, 0)
    const paidByMember = new Map<string, { paid: number; count: number }>()
    for (const m of members) paidByMember.set(m.id, { paid: 0, count: 0 })
    for (const t of unsettled) {
      const e = paidByMember.get(t.payerId) ?? { paid: 0, count: 0 }
      e.paid += t.amount; e.count += 1
      paidByMember.set(t.payerId, e)
    }

    const byCatMap = new Map<string, number>()
    for (const t of unsettled) byCatMap.set(t.categoryId, (byCatMap.get(t.categoryId) ?? 0) + t.amount)
    const byCat = [...byCatMap.entries()]
      .map(([id, value]) => ({ cat: getCategory(id, categories), value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)

    const slipCount = unsettled.filter((t) => t.hasSlip).length
    return { total, paidByMember, byCat, slipCount }
  }, [unsettled, members, categories])

  const transfers = useMemo(() => simplifyDebts(balances), [balances])
  const settled = transfers.length === 0

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
              {/* total + per-member paid */}
              <div className="rounded-[1.4rem] bg-primary p-5 text-primary-foreground shadow-sm">
                <p className="text-xs font-medium text-primary-foreground/70">ค่าใช้จ่ายรวมรอบนี้</p>
                <div className="mt-1 flex items-end gap-1">
                  <span className="text-xl font-medium text-primary-foreground/70">฿</span>
                  <span className="text-4xl font-bold tabular-nums tracking-tight">{formatBaht(summary.total)}</span>
                </div>
                <p className="mt-1 text-xs text-primary-foreground/70">
                  {unsettled.length} รายการ{summary.slipCount > 0 ? ` · มีสลิป ${summary.slipCount} ใบ` : ""}
                </p>

                <div className="mt-4 grid grid-cols-2 gap-2.5">
                  {members.map((m) => {
                    const e = summary.paidByMember.get(m.id)
                    return (
                      <div key={m.id} className="flex items-center gap-2 rounded-2xl bg-white/15 p-2.5 backdrop-blur-sm">
                        <MemberAvatar member={m} size={28} />
                        <div className="min-w-0">
                          <p className="truncate text-xs text-primary-foreground/80">{m.name} จ่าย</p>
                          <p className="text-sm font-bold tabular-nums">฿{formatBaht(e?.paid ?? 0)}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* who pays whom */}
              <div className={`rounded-[1.4rem] p-4 ring-1 ${settled ? "bg-secondary ring-border" : "bg-accent/10 ring-accent/30"}`}>
                <p className="mb-2 text-xs font-medium text-muted-foreground">ยอดที่ต้องโอน</p>
                {settled ? (
                  <div className="flex items-center gap-2">
                    <span className="grid size-8 place-items-center rounded-full bg-accent/20 text-accent"><Check className="size-4" /></span>
                    <p className="text-sm font-semibold text-foreground">ยอดเท่ากัน — ไม่ต้องโอน</p>
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
                          className={`flex items-center gap-2 rounded-xl px-3 py-2 ring-1 ${mine ? "bg-card ring-accent/40" : "bg-card/60 ring-border"}`}
                        >
                          <div className="flex min-w-0 flex-1 items-center gap-1.5">
                            {from && <MemberAvatar member={from} size={22} />}
                            <span className="truncate text-sm font-medium text-foreground">{nameOf(t.from)}</span>
                          </div>
                          <ArrowRight className="size-4 shrink-0 text-accent" />
                          <div className="flex min-w-0 flex-1 items-center gap-1.5">
                            {to && <MemberAvatar member={to} size={22} />}
                            <span className="truncate text-sm font-medium text-foreground">{nameOf(t.to)}</span>
                          </div>
                          <span className="shrink-0 text-sm font-bold tabular-nums text-accent">฿{formatBaht(t.amount)}</span>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>

              {/* category breakdown */}
              {summary.byCat.length > 0 && (
                <div className="rounded-[1.4rem] bg-secondary p-4 ring-1 ring-border">
                  <p className="mb-3 text-xs font-medium text-muted-foreground">แยกตามหมวดหมู่</p>
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

        <div className="grid shrink-0 grid-cols-2 gap-3 border-t border-border px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-2xl bg-secondary py-3.5 text-sm font-semibold text-foreground ring-1 ring-border transition active:scale-[0.99]">
            ยกเลิก
          </button>
          <button type="button" onClick={onConfirm} className="flex items-center justify-center gap-2 rounded-2xl bg-accent py-3.5 text-sm font-semibold text-accent-foreground shadow-sm transition active:scale-[0.99]">
            <Check className="size-4" />
            ยืนยันเคลียร์ยอด
          </button>
        </div>
      </div>
    </div>
  )
}
