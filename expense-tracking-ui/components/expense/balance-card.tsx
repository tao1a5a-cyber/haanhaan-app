"use client"

import { useMemo } from "react"
import { ArrowDownLeft, ArrowUpRight, Check } from "lucide-react"
import { formatBaht } from "./categories"
import { simplifyDebts } from "@/lib/balances"
import type { Member } from "./types"

type Props = {
  /** current member's net: positive = จะได้รับคืน, negative = ต้องจ่ายคืน, 0 = เคลียร์ */
  net: number
  members: Member[]
  currentMemberId: string
  /** net balance per member — used to count who you pay / who pays you */
  balances: Record<string, number>
  /** Opens the settlement summary modal — does NOT settle directly */
  onRequestSettle?: () => void
}

export function BalanceCard({ net, currentMemberId, balances, onRequestSettle }: Props) {
  const settled = Math.abs(net) < 0.005
  const youReceive = net > 0
  const amount = Math.abs(net)

  // How many people are involved on your side of the settlement.
  const counterpartyCount = useMemo(() => {
    const transfers = simplifyDebts(balances)
    const ids = new Set<string>()
    for (const t of transfers) {
      if (t.from === currentMemberId) ids.add(t.to)
      else if (t.to === currentMemberId) ids.add(t.from)
    }
    return ids.size
  }, [balances, currentMemberId])

  return (
    <section className="px-5">
      <div className="relative overflow-hidden rounded-3xl bg-primary p-6 text-primary-foreground shadow-[0_18px_40px_-18px_oklch(0.3_0.04_55/0.7)]">
        <div className="pointer-events-none absolute -right-10 -top-12 size-44 rounded-full bg-accent/25 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-8 size-40 rounded-full bg-white/10 blur-2xl" />

        <p className="relative text-sm font-medium text-primary-foreground/75">ยอดสุทธิของคุณ</p>

        {settled ? (
          <>
            <div className="relative mt-3 flex items-end gap-1.5">
              <span className="mb-1 text-2xl font-medium text-primary-foreground/70">฿</span>
              <span className="text-5xl font-bold tracking-tight tabular-nums">0</span>
            </div>
            <span className="relative mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-sm font-medium">
              <Check className="size-4" /> เคลียร์ยอดครบแล้ว
            </span>
          </>
        ) : (
          <>
            {/* Direction badge — the most important signal, shown above the number */}
            <span
              className={`relative mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ${
                youReceive
                  ? "bg-[oklch(0.85_0.13_152)] text-[oklch(0.28_0.08_152)]"
                  : "bg-[oklch(0.86_0.12_70)] text-[oklch(0.34_0.1_55)]"
              }`}
            >
              {youReceive ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
              {youReceive ? "คุณจะได้รับคืน" : "คุณต้องจ่ายคืน"}
            </span>

            <div className="relative mt-2.5 flex items-end gap-1.5">
              <span className="mb-1.5 text-3xl font-semibold text-primary-foreground/80">
                {youReceive ? "+" : "−"}
              </span>
              <span className="mb-1 text-2xl font-medium text-primary-foreground/70">฿</span>
              <span className="text-5xl font-bold tracking-tight tabular-nums">{formatBaht(amount)}</span>
            </div>

            <p className="relative mt-1.5 text-sm text-primary-foreground/75">
              {youReceive
                ? `เพื่อนรวม ${counterpartyCount} คน ต้องโอนคืนให้คุณ`
                : `คุณต้องโอนให้เพื่อนรวม ${counterpartyCount} คน`}
            </p>

            <button
              type="button"
              onClick={onRequestSettle}
              className="relative mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-accent py-3 text-sm font-semibold text-accent-foreground shadow-sm transition active:scale-[0.99]"
            >
              <Check className="size-4" />
              ดูสรุป & เคลียร์ยอด
            </button>
          </>
        )}
      </div>
    </section>
  )
}
