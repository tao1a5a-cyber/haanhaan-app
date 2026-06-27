"use client"

import { Inbox } from "lucide-react"
import { getCategory, formatBaht, splitModes, type Category, type Transaction } from "./categories"
import { CategoryGlyph } from "./category-glyph"
import type { Member } from "./types"

function timeAgo(ts: number) {
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60000)
  if (m < 1) return "เมื่อสักครู่"
  if (m < 60) return `${m} นาทีที่แล้ว`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} ชม.ที่แล้ว`
  return `${Math.floor(h / 24)} วันที่แล้ว`
}

export function RecentList({
  items,
  categories,
  members,
  currentMemberId,
  onSeeAll,
}: {
  items: Transaction[]
  categories: Category[]
  members: Member[]
  currentMemberId: string
  onSeeAll?: () => void
}) {
  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? "—"
  return (
    <section className="px-5 pb-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">รายการล่าสุด</h2>
        {items.length > 0 && (
          <button type="button" onClick={onSeeAll} className="text-sm font-medium text-accent">
            ดูทั้งหมด
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-[1.5rem] bg-card py-10 ring-1 ring-border">
          <div className="grid size-12 place-items-center rounded-full bg-secondary text-muted-foreground">
            <Inbox className="size-6" />
          </div>
          <p className="text-sm text-muted-foreground">ยังไม่มีรายการ</p>
          <p className="text-xs text-muted-foreground/70">เพิ่มค่าใช้จ่ายแรกของคุณด้านบน</p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {items.slice(0, 5).map((tx) => {
            const cat = getCategory(tx.categoryId, categories)
            const mode = splitModes.find((m) => m.id === tx.split)
            const myShare = tx.shares?.[currentMemberId] ?? 0
            const isPayer = tx.payerId === currentMemberId
            // + you are owed this much, − you owe this much
            const delta = tx.settled ? 0 : isPayer ? tx.amount - myShare : -myShare
            return (
              <li
                key={tx.id}
                className="flex items-center gap-3 rounded-2xl bg-card p-3.5 ring-1 ring-border transition active:scale-[0.99]"
              >
                <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${cat.tint}`}>
                  <CategoryGlyph category={cat} size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{tx.detail}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {nameOf(tx.payerId)} จ่าย · {mode?.label} · {timeAgo(tx.createdAt)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold tabular-nums text-foreground">฿{formatBaht(tx.amount)}</p>
                  {Math.abs(delta) > 0.005 && (
                    <p className={`text-xs font-medium ${delta > 0 ? "text-accent" : "text-muted-foreground"}`}>
                      {delta > 0 ? "+" : "−"}฿{formatBaht(Math.abs(delta))}
                    </p>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
