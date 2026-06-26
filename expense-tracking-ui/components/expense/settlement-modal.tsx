"use client"

/**
 * Settlement Module — Isolated stand-alone component.
 * Rendered only when the user taps "เคลียร์ยอดทั้งหมด".
 * Shows a full billing-cycle summary before the user confirms settlement.
 * Keeps all settlement UI/logic here so page.tsx stays clean.
 */

import { useMemo } from "react"
import { X, Check, ArrowRight, Receipt } from "lucide-react"
import { getCategory, formatBaht, type Category, type Transaction } from "./categories"
import { CategoryGlyph } from "./category-glyph"
import type { User } from "./users"

// ─── helpers ───────────────────────────────────────────────────────────────

function dateRange(txs: Transaction[]) {
  if (txs.length === 0) return "—"
  const dates = txs.map((t) => t.createdAt)
  const min = new Date(Math.min(...dates))
  const max = new Date(Math.max(...dates))
  const fmt = (d: Date) =>
    d.toLocaleDateString("th-TH", { day: "numeric", month: "short" })
  return min.toDateString() === max.toDateString()
    ? fmt(min)
    : `${fmt(min)} – ${fmt(max)}`
}

// ─── types ──────────────────────────────────────────────────────────────────

type Props = {
  transactions: Transaction[]
  categories: Category[]
  user: User
  partner: User
  /** Net from current user's perspective: positive = partner owes user */
  net: number
  onConfirm: () => void
  onClose: () => void
}

// ─── component ──────────────────────────────────────────────────────────────

export function SettlementModal({
  transactions,
  categories,
  user,
  partner,
  net,
  onConfirm,
  onClose,
}: Props) {
  const unsettled = useMemo(() => transactions.filter((t) => !t.settled), [transactions])

  const summary = useMemo(() => {
    const total = unsettled.reduce((s, t) => s + t.amount, 0)

    const userTxs = unsettled.filter((t) => t.payerId === user.id)
    const partnerTxs = unsettled.filter((t) => t.payerId === partner.id)
    const userPaid = userTxs.reduce((s, t) => s + t.amount, 0)
    const partnerPaid = partnerTxs.reduce((s, t) => s + t.amount, 0)

    // category breakdown across all unsettled
    const byCatMap = new Map<string, number>()
    unsettled.forEach((t) => {
      byCatMap.set(t.categoryId, (byCatMap.get(t.categoryId) ?? 0) + t.amount)
    })
    const byCat = [...byCatMap.entries()]
      .map(([id, value]) => ({ cat: getCategory(id, categories), value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)

    // slips
    const slipCount = unsettled.filter((t) => t.hasSlip).length

    return { total, userPaid, partnerPaid, userCount: userTxs.length, partnerCount: partnerTxs.length, byCat, slipCount }
  }, [unsettled, user.id, partner.id, categories])

  const netAbs = Math.abs(net)
  const debtor = net > 0 ? partner : user
  const creditor = net > 0 ? user : partner
  const settled = net === 0

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* backdrop */}
      <button
        type="button"
        aria-label="ปิด"
        onClick={onClose}
        className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
      />

      {/* modal sheet */}
      <div className="relative w-full max-w-md animate-in slide-in-from-bottom-6 fade-in duration-300 max-h-[92dvh] flex flex-col rounded-t-[2rem] bg-card shadow-2xl ring-1 ring-border sm:rounded-[2rem]">
        {/* drag handle */}
        <div className="mx-auto mt-3 mb-1 h-1.5 w-10 shrink-0 rounded-full bg-border sm:hidden" />

        {/* ── header ── */}
        <div className="flex shrink-0 items-center justify-between px-5 pt-2 pb-4 border-b border-border">
          <div>
            <h2 className="text-base font-semibold text-foreground">สรุปก่อนเคลียร์ยอด</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {user.name} &amp; {partner.name} · {dateRange(unsettled)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิด"
            className="grid size-8 place-items-center rounded-full bg-secondary text-muted-foreground transition active:scale-90"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* ── scrollable body ── */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {unsettled.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <span className="text-4xl">✨</span>
              <p className="font-semibold text-foreground">ไม่มีรายการค้างชำระ</p>
              <p className="text-sm text-muted-foreground">ยอดทุกรายการเคลียร์แล้ว</p>
            </div>
          ) : (
            <>
              {/* ── total spend ── */}
              <div className="rounded-[1.4rem] bg-primary p-5 text-primary-foreground shadow-sm">
                <p className="text-xs font-medium text-primary-foreground/70">ค่าใช้จ่ายรวมรอบนี้</p>
                <div className="mt-1 flex items-end gap-1">
                  <span className="text-xl font-medium text-primary-foreground/70">฿</span>
                  <span className="text-4xl font-bold tabular-nums tracking-tight">
                    {formatBaht(summary.total)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-primary-foreground/70">
                  {unsettled.length} รายการ{summary.slipCount > 0 ? ` · มีสลิป ${summary.slipCount} ใบ` : ""}
                </p>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-white/15 p-3 backdrop-blur-sm">
                    <p className="text-xs text-primary-foreground/70">{user.name} จ่าย</p>
                    <p className="mt-0.5 text-lg font-bold tabular-nums">฿{formatBaht(summary.userPaid)}</p>
                    <p className="text-xs text-primary-foreground/60">{summary.userCount} รายการ</p>
                  </div>
                  <div className="rounded-2xl bg-white/15 p-3 backdrop-blur-sm">
                    <p className="text-xs text-primary-foreground/70">{partner.name} จ่าย</p>
                    <p className="mt-0.5 text-lg font-bold tabular-nums">฿{formatBaht(summary.partnerPaid)}</p>
                    <p className="text-xs text-primary-foreground/60">{summary.partnerCount} รายการ</p>
                  </div>
                </div>
              </div>

              {/* ── net balance ── */}
              <div className={`rounded-[1.4rem] p-4 ring-1 ${
                settled
                  ? "bg-secondary ring-border"
                  : "bg-accent/10 ring-accent/30"
              }`}>
                <p className="text-xs font-medium text-muted-foreground mb-2">ยอดที่ต้องชำระ</p>
                {settled ? (
                  <div className="flex items-center gap-2">
                    <span className="grid size-8 place-items-center rounded-full bg-accent/20 text-accent">
                      <Check className="size-4" />
                    </span>
                    <p className="text-sm font-semibold text-foreground">ยอดเท่ากัน — ไม่ต้องโอน</p>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="flex-1 rounded-xl bg-card px-3 py-2 text-center ring-1 ring-border">
                      <p className="text-xs text-muted-foreground">ผู้โอน</p>
                      <p className="text-sm font-bold text-foreground">{debtor.name}</p>
                    </div>
                    <div className="flex flex-col items-center gap-0.5">
                      <ArrowRight className="size-5 text-accent" />
                      <p className="text-sm font-bold tabular-nums text-accent">฿{formatBaht(netAbs)}</p>
                    </div>
                    <div className="flex-1 rounded-xl bg-card px-3 py-2 text-center ring-1 ring-border">
                      <p className="text-xs text-muted-foreground">ผู้รับ</p>
                      <p className="text-sm font-bold text-foreground">{creditor.name}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* ── category breakdown ── */}
              {summary.byCat.length > 0 && (
                <div className="rounded-[1.4rem] bg-secondary p-4 ring-1 ring-border">
                  <p className="text-xs font-medium text-muted-foreground mb-3">แยกตามหมวดหมู่</p>
                  <ul className="space-y-2.5">
                    {summary.byCat.map(({ cat, value }) => {
                      const pct = summary.total ? Math.round((value / summary.total) * 100) : 0
                      return (
                        <li key={cat.id} className="flex items-center gap-2.5">
                          <span className={`grid size-8 shrink-0 place-items-center rounded-xl ${cat.tint}`}>
                            <CategoryGlyph category={cat} size={15} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="font-medium text-foreground">{cat.label}</span>
                              <span className="text-muted-foreground">{pct}%</span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-card ring-1 ring-border">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{ width: `${pct}%`, backgroundColor: cat.color }}
                              />
                            </div>
                          </div>
                          <span className="shrink-0 text-xs font-semibold tabular-nums text-foreground">
                            ฿{formatBaht(value)}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}

              {/* slip indicator */}
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

        {/* ── footer actions ── */}
        <div className="shrink-0 grid grid-cols-2 gap-3 border-t border-border px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl bg-secondary py-3.5 text-sm font-semibold text-foreground ring-1 ring-border transition active:scale-[0.99]"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex items-center justify-center gap-2 rounded-2xl bg-accent py-3.5 text-sm font-semibold text-accent-foreground shadow-sm transition active:scale-[0.99]"
          >
            <Check className="size-4" />
            ยืนยันเคลียร์ยอด
          </button>
        </div>
      </div>
    </div>
  )
}
