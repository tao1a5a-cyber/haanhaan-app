"use client"

import { ArrowDownLeft, ArrowUpRight, Check } from "lucide-react"
import { formatBaht } from "./categories"
import type { Member } from "./types"

type Props = {
  /** current member's net: positive = จะได้รับคืน, negative = ต้องจ่ายคืน, 0 = เคลียร์ */
  net: number
  members: Member[]
  currentMemberId: string
  /** Opens the settlement summary modal — does NOT settle directly */
  onRequestSettle?: () => void
}

export function BalanceCard({ net, members, onRequestSettle }: Props) {
  const settled = Math.abs(net) < 0.005
  const youReceive = net > 0
  const amount = Math.abs(net)
  const others = Math.max(members.length - 1, 0)

  return (
    <section className="px-5">
      <div className="relative overflow-hidden rounded-3xl bg-primary p-6 text-primary-foreground shadow-[0_18px_40px_-18px_oklch(0.3_0.04_55/0.7)]">
        <div className="pointer-events-none absolute -right-10 -top-12 size-44 rounded-full bg-accent/25 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-8 size-40 rounded-full bg-white/10 blur-2xl" />

        <div className="relative flex items-center justify-between">
          <p className="text-sm font-medium text-primary-foreground/75">ยอดสุทธิของคุณ</p>
          <span className="rounded-xl bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur-sm">
            กับอีก {others} คน
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
              คุณจะได้รับคืนสุทธิ
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 font-medium text-primary-foreground/90">
              <ArrowUpRight className="size-4 text-[oklch(0.85_0.1_60)]" />
              คุณต้องจ่ายคืนสุทธิ
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
