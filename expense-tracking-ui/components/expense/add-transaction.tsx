"use client"

import { useRef, useMemo, useState } from "react"
import { Plus, X, ImagePlus, Check } from "lucide-react"
import {
  splitModes,
  formatBaht,
  type Category,
  type SplitMode,
  type Transaction,
} from "./categories"
import { CategoryGlyph } from "./category-glyph"
import { CategoryCreator } from "./category-creator"
import { MemberAvatar } from "./member-avatar"
import { splitEqually } from "@/lib/balances"
import type { Member } from "./types"

type Props = {
  categories: Category[]
  members: Member[]
  currentMember: Member
  onAdd: (tx: Omit<Transaction, "id" | "createdAt" | "payerId" | "groupId">, slipFile?: File) => void
  onAddCategory: (label: string, emoji: string) => string
}

export function AddTransaction({ categories, members, currentMember, onAdd, onAddCategory }: Props) {
  const [amount, setAmount] = useState("")
  const [detail, setDetail] = useState("")
  const [categoryId, setCategoryId] = useState("food")
  const [split, setSplit] = useState<SplitMode>("split")
  const [slipUrl, setSlipUrl] = useState<string | null>(null)
  const [slipFile, setSlipFile] = useState<File | null>(null)
  const [slipName, setSlipName] = useState("")
  const [creatingCategory, setCreatingCategory] = useState(false)
  // participants in the split — default everyone
  const [selected, setSelected] = useState<string[]>(() => members.map((m) => m.id))
  // custom split: memberId -> string input
  const [custom, setCustom] = useState<Record<string, string>>({})
  const slipInputRef = useRef<HTMLInputElement>(null)

  const amountNum = Number(amount) || 0
  const splitIndex = splitModes.findIndex((m) => m.id === split)

  const selectedMembers = members.filter((m) => selected.includes(m.id))
  // For ฝากจ่าย the payer doesn't owe; beneficiaries = selected minus payer.
  const beneficiaries = split === "request"
    ? selected.filter((id) => id !== currentMember.id)
    : selected

  const customNum = (id: string) => Number(custom[id]) || 0
  const customTotal = useMemo(
    () => selected.reduce((s, id) => s + customNum(id), 0),
    [custom, selected],
  )

  function toggleMember(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  /** Build the shares map (memberId → owed portion) for the chosen split. */
  function buildShares(): Record<string, number> | null {
    if (amountNum <= 0) return null
    if (split === "custom") {
      if (Math.abs(customTotal - amountNum) > 0.01) return null
      const rec: Record<string, number> = {}
      for (const id of selected) rec[id] = customNum(id)
      return rec
    }
    if (split === "request") {
      if (beneficiaries.length === 0) return null
      return splitEqually(amountNum, beneficiaries)
    }
    // equal
    if (selected.length === 0) return null
    return splitEqually(amountNum, selected)
  }

  const sharePreview = useMemo(() => {
    if (amountNum <= 0) return null
    if (split === "custom") {
      const ok = Math.abs(customTotal - amountNum) < 0.01
      return ok ? "ยอดรวมตรงกัน ✓" : `รวม ฿${formatBaht(customTotal)} · ต้องเท่ากับ ฿${formatBaht(amountNum)}`
    }
    if (split === "request") {
      if (beneficiaries.length === 0) return "เลือกคนที่ต้องจ่ายคืน"
      return `คนละ ฿${formatBaht(amountNum / beneficiaries.length)} · ${beneficiaries.length} คนจ่ายคืนเต็ม`
    }
    if (selected.length === 0) return "เลือกอย่างน้อย 1 คน"
    return `แบ่งคนละ ฿${formatBaht(amountNum / selected.length)} · ${selected.length} คน`
  }, [amountNum, split, selected.length, beneficiaries.length, customTotal])

  function handleSlipFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setSlipFile(file)
    setSlipName(file.name)
    setSlipUrl(URL.createObjectURL(file))
    e.target.value = ""
  }

  const shares = buildShares()
  const canSubmit = amountNum > 0 && shares !== null

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!shares) return
    onAdd(
      {
        amount: amountNum,
        detail: detail.trim() || "ไม่ระบุรายละเอียด",
        categoryId,
        split,
        shares,
        hasSlip: !!slipUrl,
        slipUrl: slipUrl ?? undefined,
      },
      slipFile ?? undefined,
    )
    setAmount("")
    setDetail("")
    setSlipUrl(null)
    setSlipFile(null)
    setSlipName("")
    setSplit("split")
    setCategoryId("food")
    setSelected(members.map((m) => m.id))
    setCustom({})
  }

  return (
    <section className="px-5">
      <form
        onSubmit={handleSubmit}
        className="rounded-[1.75rem] bg-card p-5 shadow-[0_10px_30px_-20px_oklch(0.3_0.04_55/0.5)] ring-1 ring-border"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">เพิ่มรายการ</h2>
          <span className="text-xs text-muted-foreground">{currentMember.name} เป็นคนจ่าย</span>
        </div>

        {/* Amount */}
        <div className="mt-4 rounded-2xl bg-secondary px-4 py-4">
          <label htmlFor="amount" className="text-xs font-medium text-muted-foreground">จำนวนเงินรวม</label>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-3xl font-semibold text-muted-foreground">฿</span>
            <input
              id="amount"
              inputMode="decimal"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              className="w-full bg-transparent text-4xl font-bold tracking-tight text-foreground tabular-nums outline-none placeholder:text-muted-foreground/40"
            />
          </div>
        </div>

        {/* Detail */}
        <input
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          placeholder="รายละเอียด เช่น ค่าข้าวเที่ยง"
          className="mt-3 w-full rounded-2xl bg-secondary px-4 py-3.5 text-sm text-foreground outline-none ring-1 ring-transparent transition placeholder:text-muted-foreground focus:bg-card focus:ring-ring"
        />

        {/* Categories */}
        <p className="mt-4 mb-2 text-xs font-medium text-muted-foreground">หมวดหมู่</p>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => {
            const active = c.id === categoryId
            return (
              <button
                type="button"
                key={c.id}
                onClick={() => setCategoryId(c.id)}
                className={`flex items-center gap-2 rounded-full py-2 pl-2 pr-3.5 text-sm font-medium transition active:scale-95 ${
                  active ? "bg-primary text-primary-foreground shadow-sm" : "bg-secondary text-secondary-foreground ring-1 ring-border"
                }`}
              >
                <span className={`grid size-6 place-items-center rounded-full ${active ? "bg-white/20 text-primary-foreground" : c.tint}`}>
                  <CategoryGlyph category={c} size={14} />
                </span>
                {c.label}
              </button>
            )
          })}
          <button
            type="button"
            onClick={() => setCreatingCategory(true)}
            aria-label="เพิ่มหมวดหมู่"
            className="flex items-center gap-1.5 rounded-full bg-secondary py-2 pl-2 pr-3.5 text-sm font-medium text-muted-foreground ring-1 ring-dashed ring-border transition active:scale-95"
          >
            <span className="grid size-6 place-items-center rounded-full bg-card ring-1 ring-border"><Plus className="size-3.5" /></span>
            เพิ่ม
          </button>
        </div>

        {/* Participants */}
        {members.length > 1 && (
          <>
            <p className="mt-4 mb-2 text-xs font-medium text-muted-foreground">
              {split === "request" ? "ใครต้องจ่ายคืน" : "ใครร่วมหารบ้าง"}
            </p>
            <div className="flex flex-wrap gap-2">
              {members.map((m) => {
                const on = selected.includes(m.id)
                const isPayer = m.id === currentMember.id
                return (
                  <button
                    type="button"
                    key={m.id}
                    onClick={() => toggleMember(m.id)}
                    className={`flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3 text-sm font-medium transition active:scale-95 ${
                      on ? "bg-accent/12 text-foreground ring-1 ring-accent/40" : "bg-secondary text-muted-foreground ring-1 ring-border"
                    }`}
                  >
                    <MemberAvatar member={m} size={24} />
                    {m.name}{isPayer ? " (จ่าย)" : ""}
                    {on && <Check className="size-3.5 text-accent" />}
                  </button>
                )
              })}
            </div>
          </>
        )}

        {/* Split mode */}
        <p className="mt-4 mb-2 text-xs font-medium text-muted-foreground">วิธีแบ่งจ่าย</p>
        <div className="relative grid grid-cols-3 rounded-2xl bg-secondary p-1">
          <span
            className="absolute inset-y-1 w-[calc(33.333%-0.25rem)] rounded-xl bg-card shadow-sm ring-1 ring-border transition-transform duration-300 ease-out"
            style={{ transform: `translateX(calc(${splitIndex * 100}% + ${splitIndex * 0.25}rem))` }}
          />
          {splitModes.map((m) => (
            <button
              type="button"
              key={m.id}
              onClick={() => setSplit(m.id)}
              className={`relative z-10 rounded-xl py-2 text-sm font-medium transition-colors ${split === m.id ? "text-foreground" : "text-muted-foreground"}`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Custom split inputs */}
        {split === "custom" && (
          <div className="mt-3 space-y-2.5 rounded-2xl bg-secondary p-4">
            <p className="text-xs font-medium text-muted-foreground">ระบุจำนวนของแต่ละคน</p>
            {selectedMembers.map((m) => (
              <div key={m.id} className="flex items-center gap-3">
                <span className="flex w-28 shrink-0 items-center gap-2 text-sm font-medium text-foreground">
                  <MemberAvatar member={m} size={22} />
                  <span className="truncate">{m.name}</span>
                </span>
                <div className="flex flex-1 items-center gap-1.5 rounded-xl bg-card px-3 py-2 ring-1 ring-border">
                  <span className="text-sm text-muted-foreground">฿</span>
                  <input
                    inputMode="decimal"
                    placeholder="0"
                    value={custom[m.id] ?? ""}
                    onChange={(e) => setCustom((p) => ({ ...p, [m.id]: e.target.value.replace(/[^0-9.]/g, "") }))}
                    className="w-full bg-transparent text-sm font-semibold text-foreground tabular-nums outline-none placeholder:text-muted-foreground/40"
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {sharePreview && (
          <p className={`mt-2 text-center text-xs font-medium ${canSubmit ? "text-accent" : "text-muted-foreground"}`}>
            {sharePreview}
          </p>
        )}

        {/* Slip upload */}
        <input ref={slipInputRef} type="file" accept="image/*" className="hidden" onChange={handleSlipFile} />
        {slipUrl ? (
          <div className="mt-4 flex items-center gap-3 rounded-2xl bg-accent/10 px-4 py-3 ring-1 ring-accent/30">
            <button type="button" onClick={() => window.open(slipUrl, "_blank")} className="size-12 shrink-0 overflow-hidden rounded-xl ring-1 ring-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={slipUrl} alt="slip" className="size-full object-cover" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-accent">{slipName || "สลิป"}</p>
              <button type="button" onClick={() => slipInputRef.current?.click()} className="mt-0.5 text-xs text-muted-foreground underline underline-offset-2">เปลี่ยนรูป</button>
            </div>
            <button type="button" onClick={() => { setSlipUrl(null); setSlipName("") }} aria-label="ลบสลิป" className="grid size-7 place-items-center rounded-full bg-secondary text-muted-foreground transition active:scale-90">
              <X className="size-3.5" />
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => slipInputRef.current?.click()} className="mt-4 flex w-full items-center gap-3 rounded-2xl bg-secondary px-4 py-3.5 text-sm font-medium text-muted-foreground ring-1 ring-border transition active:scale-[0.99]">
            <span className="grid size-7 place-items-center rounded-lg bg-card ring-1 ring-border"><ImagePlus className="size-4" /></span>
            แนบใบเสร็จ / สลิป
          </button>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={!canSubmit}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-base font-semibold text-primary-foreground shadow-[0_12px_24px_-12px_oklch(0.3_0.04_55/0.8)] transition active:scale-[0.99] disabled:opacity-40 disabled:shadow-none"
        >
          <Plus className="size-5" />
          บันทึกรายการ
        </button>
      </form>

      {creatingCategory && (
        <CategoryCreator
          onClose={() => setCreatingCategory(false)}
          onCreate={(label, emoji) => {
            const newId = onAddCategory(label, emoji)
            setCategoryId(newId)
            setCreatingCategory(false)
          }}
        />
      )}
    </section>
  )
}
