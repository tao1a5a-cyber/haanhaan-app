"use client"

import { ArrowDownLeft, ArrowUpRight, Check } from "lucide-react"
import { formatBaht } from "./categories"

type Props = {
  /** positive = เราจะได้รับคืน, negative = เราต้องจ่ายคืน, 0 = เคลียร์ */
  net: number
  partnerName: string
  /** Opens the settlement summary modal — does NOT settle directly */
  onRequestSettle?: () => void
}

export function BalanceCard({ net, partnerName, onRequestSettle }: Props) {
  const settled = net === 0
  const youReceive = net > 0
  const amount = Math.abs(net)

  return (
    <section className="px-5">
      <div className="relative overflow-hidden rounded-[1.75rem] bg-primary p-6 text-primary-foreground shadow-[0_18px_40px_-18px_oklch(0.3_0.04_55/0.7)]">
        {/* soft decorative glow */}
        <div className="pointer-events-none absolute -right-10 -top-12 size-44 rounded-full bg-accent/25 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-8 size-40 rounded-full bg-white/10 blur-2xl" />

        <div className="relative flex items-center justify-between">
          <p className="text-sm font-medium text-primary-foreground/75">ยอดคงค้างสุทธิ</p>
          <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur-sm">
            กับ {partnerName}
          </span>
        </div>

        <div className="relative mt-3 flex items-end gap-1.5">
          <span className="mb-1 text-2xl font-medium text-primary-foreground/70">฿</span>
          <span className="text-5xl font-bold tracking-tight tabular-nums">{formatBaht(amount)}</span>
        </div>

        <div className="relative mt-2 flex items-center gap-2 text-sm">
          {settled ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 font-medium">
              <Check className="size-4" /> เคลียร์ยอดครบแล้ว
            </span>
          ) : youReceive ? (
            <span className="inline-flex items-center gap-1.5 font-medium text-primary-foreground/90">
              <ArrowDownLeft className="size-4 text-[oklch(0.85_0.12_150)]" />
              {partnerName} ต้องจ่ายคืนคุณ
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 font-medium text-primary-foreground/90">
              <ArrowUpRight className="size-4 text-[oklch(0.85_0.1_60)]" />
              คุณต้องจ่ายคืน {partnerName}
            </span>
          )}
        </div>

        {!settled && (
          <button
            type="button"
            onClick={onRequestSettle}
            className="relative mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-accent py-3 text-sm font-semibold text-accent-foreground shadow-sm transition active:scale-[0.99]"
          >
            <Check className="size-4" />
            เคลียร์ยอดทั้งหมด
          </button>
        )}
      </div>
    </section>
  )
}
