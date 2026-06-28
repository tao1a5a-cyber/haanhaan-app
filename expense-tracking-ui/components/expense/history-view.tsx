"use client"

import { useRef, useMemo, useState } from "react"
import { Search, SearchX, Pencil, Trash2, X, Check, ImagePlus } from "lucide-react"
import {
  getCategory,
  formatBaht,
  splitModes,
  type Category,
  type Transaction,
  type SplitMode,
} from "./categories"
import { CategoryGlyph } from "./category-glyph"
import { splitEqually } from "@/lib/balances"
import type { Member } from "./types"
import type { AppNotification } from "./notifications"

function dateKey(ts: number) {
  return new Date(ts).toLocaleDateString("th-TH", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

function timeOf(ts: number) {
  return new Date(ts).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })
}

type EditState = {
  tx: Transaction
  amount: string
  detail: string
  categoryId: string
  split: SplitMode
  slipUrl?: string
}

export function HistoryView({
  transactions,
  categories,
  members,
  currentMember,
  readOnly = false,
  onEdit,
  onDelete,
  onNotify,
}: {
  transactions: Transaction[]
  categories: Category[]
  members: Member[]
  currentMember: Member
  /** read-only guests can browse history but not edit/delete */
  readOnly?: boolean
  onEdit: (tx: Transaction) => void
  onDelete: (txId: string) => void
  onNotify: (message: string, type: AppNotification["type"], txId?: string) => void
}) {
  const [query, setQuery] = useState("")
  const [who, setWho] = useState<"all" | string>("all")
  const [catFilter, setCatFilter] = useState<"all" | string>("all")
  const [editing, setEditing] = useState<EditState | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [viewingSlip, setViewingSlip] = useState<string | null>(null)
  const editSlipInputRef = useRef<HTMLInputElement>(null)

  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? "—"
  const whoChips = [{ id: "all", label: "ทุกคน" }, ...members.map((m) => ({ id: m.id, label: m.name }))]

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return transactions.filter((t) => {
      if (who !== "all" && t.payerId !== who) return false
      if (catFilter !== "all" && t.categoryId !== catFilter) return false
      if (q) {
        const cat = getCategory(t.categoryId, categories)
        return t.detail.toLowerCase().includes(q) || cat.label.toLowerCase().includes(q)
      }
      return true
    })
  }, [transactions, categories, query, who, catFilter])

  const total = filtered.reduce((s, t) => s + t.amount, 0)

  const groups = useMemo(() => {
    const map = new Map<string, Transaction[]>()
    filtered.forEach((t) => {
      const k = dateKey(t.createdAt)
      const arr = map.get(k) ?? []
      arr.push(t)
      map.set(k, arr)
    })
    return [...map.entries()]
  }, [filtered])

  function startEdit(t: Transaction) {
    setEditing({
      tx: t,
      amount: String(t.amount),
      detail: t.detail,
      categoryId: t.categoryId,
      split: t.split,
      slipUrl: t.slipUrl,
    })
  }

  function handleEditSlipFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !editing) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      if (typeof ev.target?.result === "string") {
        setEditing({ ...editing, slipUrl: ev.target.result })
      }
    }
    reader.readAsDataURL(file)
    e.target.value = ""
  }

  /** Recompute the shares map for the edited amount/split, keeping the same participants. */
  function recomputeShares(tx: Transaction, amount: number, split: SplitMode): Record<string, number> {
    let ids = Object.keys(tx.shares ?? {})
    if (ids.length === 0) ids = members.map((m) => m.id)
    if (split === "request") {
      const bens = ids.filter((id) => id !== tx.payerId)
      return splitEqually(amount, bens.length ? bens : ids)
    }
    if (split === "custom") {
      const old = tx.amount || 0
      if (old <= 0) return splitEqually(amount, ids)
      // scale existing proportions to the new amount
      const factor = amount / old
      const rec: Record<string, number> = {}
      for (const id of ids) rec[id] = Math.round((tx.shares[id] ?? 0) * factor * 100) / 100
      return rec
    }
    return splitEqually(amount, ids)
  }

  function commitEdit() {
    if (!editing) return
    const amountNum = Number(editing.amount) || 0
    if (amountNum <= 0) return
    const updated: Transaction = {
      ...editing.tx,
      amount: amountNum,
      detail: editing.detail.trim() || "ไม่ระบุรายละเอียด",
      categoryId: editing.categoryId,
      split: editing.split,
      hasSlip: !!editing.slipUrl,
      slipUrl: editing.slipUrl,
      // Clear the stored path when the slip is removed; otherwise keep the original.
      slipPath: editing.slipUrl ? editing.tx.slipPath : undefined,
      shares: recomputeShares(editing.tx, amountNum, editing.split),
    }
    onEdit(updated)
    onNotify(`${currentMember.name} แก้ไขรายการ "${updated.detail}" ฿${formatBaht(updated.amount)}`, "edit", updated.id)
    setEditing(null)
  }

  function handleDelete(txId: string, detail: string) {
    onDelete(txId)
    onNotify(`${currentMember.name} ลบรายการ "${detail}"`, "delete", txId)
    setConfirmDelete(null)
  }

  return (
    <div className="px-5 pt-2">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ค้นหารายละเอียด…"
          className="w-full rounded-2xl bg-card py-3 pl-10 pr-4 text-sm text-foreground outline-none ring-1 ring-border transition focus:ring-ring"
        />
      </div>

      {/* Who filter */}
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {whoChips.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setWho(c.id)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition active:scale-95 ${
              who === c.id
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground ring-1 ring-border"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Category filter */}
      <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setCatFilter("all")}
          className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition active:scale-95 ${
            catFilter === "all"
              ? "bg-primary text-primary-foreground"
              : "bg-card text-muted-foreground ring-1 ring-border"
          }`}
        >
          ทุกหมวด
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCatFilter(c.id)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition active:scale-95 ${
              catFilter === c.id
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground ring-1 ring-border"
            }`}
          >
            <CategoryGlyph category={c} size={14} />
            {c.label}
          </button>
        ))}
      </div>

      {/* Summary line */}
      {filtered.length > 0 && (
        <p className="mt-3 text-sm text-muted-foreground">
          {filtered.length} รายการ · รวม ฿{formatBaht(total)}
        </p>
      )}

      {/* Grouped list */}
      {filtered.length === 0 ? (
        <div className="mt-10 flex flex-col items-center gap-2">
          <div className="grid size-12 place-items-center rounded-full bg-secondary text-muted-foreground">
            <SearchX className="size-6" />
          </div>
          <p className="text-sm text-muted-foreground">ไม่พบรายการที่ตรงกับเงื่อนไข</p>
        </div>
      ) : (
        <div className="mt-3 space-y-5 pb-4">
          {groups.map(([date, items]) => {
            const dayTotal = items.reduce((s, t) => s + t.amount, 0)
            return (
              <section key={date}>
                <div className="mb-2 flex items-center justify-between px-1">
                  <h2 className="text-sm font-medium text-muted-foreground">{date}</h2>
                  <span className="text-xs text-muted-foreground">฿{formatBaht(dayTotal)}</span>
                </div>
                <ul className="space-y-2">
                  {items.map((t) => {
                    const cat = getCategory(t.categoryId, categories)
                    const mode = splitModes.find((m) => m.id === t.split)
                    return (
                      <li
                        key={t.id}
                        className={`overflow-hidden rounded-2xl bg-card ring-1 ring-border ${t.settled ? "opacity-50" : ""}`}
                      >
                        <div className="flex items-center gap-3 p-3.5">
                          <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${cat.tint}`}>
                            <CategoryGlyph category={cat} size={20} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-foreground">{t.detail}</p>
                            <p className="text-xs text-muted-foreground">
                              {nameOf(t.payerId)} · {mode?.label} · {timeOf(t.createdAt)}
                              {t.settled ? " · เคลียร์แล้ว" : ""}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <p className={`text-sm font-bold tabular-nums text-foreground ${readOnly ? "mr-1.5" : "mr-1"}`}>
                              ฿{formatBaht(t.amount)}
                            </p>
                            {!readOnly && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => startEdit(t)}
                                  aria-label="แก้ไข"
                                  className="grid size-8 place-items-center rounded-full text-muted-foreground transition hover:bg-secondary active:scale-90"
                                >
                                  <Pencil className="size-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDelete(t.id)}
                                  aria-label="ลบ"
                                  className="grid size-8 place-items-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-destructive active:scale-90"
                                >
                                  <Trash2 className="size-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Slip thumbnail row */}
                        {t.slipUrl && (
                          <button
                            type="button"
                            onClick={() => setViewingSlip(t.slipUrl!)}
                            className="flex items-center gap-2.5 w-full px-3.5 pb-3 pt-0"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={t.slipUrl}
                              alt="slip"
                              className="h-14 w-20 rounded-xl object-cover ring-1 ring-border"
                            />
                            <span className="text-xs text-muted-foreground">ดูสลิป / ใบเสร็จ →</span>
                          </button>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </section>
            )
          })}
        </div>
      )}

      {/* Slip image viewer */}
      {viewingSlip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/80 backdrop-blur-sm">
          <button
            type="button"
            aria-label="ปิด"
            onClick={() => setViewingSlip(null)}
            className="absolute inset-0"
          />
          <div className="relative max-w-sm w-full mx-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={viewingSlip} alt="slip" className="w-full rounded-3xl shadow-2xl object-contain max-h-[80vh]" />
            <button
              type="button"
              onClick={() => setViewingSlip(null)}
              className="absolute -top-3 -right-3 grid size-9 place-items-center rounded-full bg-card shadow-lg ring-1 ring-border text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* Edit sheet */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <button
            type="button"
            aria-label="ปิด"
            onClick={() => setEditing(null)}
            className="absolute inset-0 bg-foreground/30 backdrop-blur-sm"
          />
          <div className="relative w-full max-w-md animate-in slide-in-from-bottom-4 fade-in duration-300 rounded-t-[2rem] bg-card p-5 pb-8 shadow-2xl ring-1 ring-border sm:rounded-[2rem]">
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-border sm:hidden" />

            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">แก้ไขรายการ</h2>
              <button
                type="button"
                onClick={() => setEditing(null)}
                aria-label="ปิด"
                className="grid size-8 place-items-center rounded-full bg-secondary text-muted-foreground transition active:scale-90"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Amount */}
            <div className="mt-4 rounded-2xl bg-secondary px-4 py-3">
              <label className="text-xs font-medium text-muted-foreground">จำนวนเงิน</label>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-2xl font-semibold text-muted-foreground">฿</span>
                <input
                  inputMode="decimal"
                  value={editing.amount}
                  onChange={(e) =>
                    setEditing({ ...editing, amount: e.target.value.replace(/[^0-9.]/g, "") })
                  }
                  className="w-full bg-transparent text-3xl font-bold tabular-nums text-foreground outline-none placeholder:text-muted-foreground/40"
                />
              </div>
            </div>

            {/* Detail */}
            <input
              value={editing.detail}
              onChange={(e) => setEditing({ ...editing, detail: e.target.value })}
              placeholder="รายละเอียด"
              className="mt-3 w-full rounded-2xl bg-secondary px-4 py-3.5 text-sm text-foreground outline-none ring-1 ring-transparent transition placeholder:text-muted-foreground focus:bg-card focus:ring-ring"
            />

            {/* Category chips */}
            <p className="mt-4 mb-2 text-xs font-medium text-muted-foreground">หมวดหมู่</p>
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => {
                const active = c.id === editing.categoryId
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setEditing({ ...editing, categoryId: c.id })}
                    className={`flex items-center gap-1.5 rounded-full py-1.5 pl-1.5 pr-3 text-xs font-medium transition active:scale-95 ${
                      active
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground ring-1 ring-border"
                    }`}
                  >
                    <span
                      className={`grid size-5 place-items-center rounded-full ${
                        active ? "bg-white/20" : c.tint
                      }`}
                    >
                      <CategoryGlyph category={c} size={12} />
                    </span>
                    {c.label}
                  </button>
                )
              })}
            </div>

            {/* Split mode */}
            <p className="mt-4 mb-2 text-xs font-medium text-muted-foreground">วิธีแบ่งจ่าย</p>
            <div className="relative grid grid-cols-3 rounded-2xl bg-secondary p-1">
              {(() => {
                const idx = splitModes.findIndex((m) => m.id === editing.split)
                return (
                  <span
                    className="absolute inset-y-1 w-[calc(33.333%-0.25rem)] rounded-xl bg-card shadow-sm ring-1 ring-border transition-transform duration-300 ease-out"
                    style={{ transform: `translateX(calc(${idx * 100}% + ${idx * 0.25}rem))` }}
                  />
                )
              })()}
              {splitModes.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setEditing({ ...editing, split: m.id })}
                  className={`relative z-10 rounded-xl py-2 text-sm font-medium transition-colors ${
                    editing.split === m.id ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* Slip upload in edit */}
            <input
              ref={editSlipInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleEditSlipFile}
            />

            {editing.slipUrl ? (
              <div className="mt-3 flex items-center gap-3 rounded-2xl bg-accent/10 px-4 py-3 ring-1 ring-accent/30">
                <button
                  type="button"
                  onClick={() => setViewingSlip(editing.slipUrl!)}
                  className="shrink-0 size-12 rounded-xl overflow-hidden ring-1 ring-border"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={editing.slipUrl} alt="slip" className="size-full object-cover" />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-accent">สลิปแนบอยู่</p>
                  <button
                    type="button"
                    onClick={() => editSlipInputRef.current?.click()}
                    className="text-xs text-muted-foreground underline underline-offset-2 mt-0.5"
                  >
                    เปลี่ยนรูป
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setEditing({ ...editing, slipUrl: undefined })}
                  aria-label="ลบสลิป"
                  className="grid size-7 place-items-center rounded-full bg-secondary text-muted-foreground transition active:scale-90"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => editSlipInputRef.current?.click()}
                className="mt-3 flex w-full items-center gap-3 rounded-2xl bg-secondary px-4 py-3 text-sm font-medium text-muted-foreground ring-1 ring-border transition active:scale-[0.99]"
              >
                <span className="grid size-7 place-items-center rounded-lg bg-card ring-1 ring-border">
                  <ImagePlus className="size-4" />
                </span>
                แนบใบเสร็จ / สลิป
              </button>
            )}

            {/* Save */}
            <button
              type="button"
              onClick={commitEdit}
              disabled={Number(editing.amount) <= 0}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground shadow-sm transition active:scale-[0.99] disabled:opacity-40"
            >
              <Check className="size-4" />
              บันทึกการแก้ไข
            </button>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {confirmDelete && (() => {
        const tx = transactions.find((t) => t.id === confirmDelete)
        if (!tx) return null
        return (
          <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
            <button
              type="button"
              aria-label="ปิด"
              onClick={() => setConfirmDelete(null)}
              className="absolute inset-0 bg-foreground/30 backdrop-blur-sm"
            />
            <div className="relative w-full max-w-md animate-in slide-in-from-bottom-4 fade-in duration-300 rounded-t-[2rem] bg-card p-5 pb-8 shadow-2xl ring-1 ring-border sm:rounded-[2rem]">
              <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-border sm:hidden" />
              <h2 className="text-base font-semibold text-foreground">ยืนยันการลบ</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                ลบรายการ <span className="font-medium text-foreground">"{tx.detail}"</span>{" "}
                ฿{formatBaht(tx.amount)} ใช่ไหม? การดำเนินการนี้ไม่สามารถย้อนกลับได้
              </p>
              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(null)}
                  className="flex-1 rounded-2xl bg-secondary py-3.5 text-sm font-semibold text-foreground ring-1 ring-border transition active:scale-[0.99]"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(tx.id, tx.detail)}
                  className="flex-1 rounded-2xl bg-destructive py-3.5 text-sm font-semibold text-destructive-foreground transition active:scale-[0.99]"
                >
                  ลบรายการ
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
