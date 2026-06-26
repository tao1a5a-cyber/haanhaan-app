"use client"

import { useRef, useMemo, useState } from "react"
import { Plus, Receipt, Check, X, ImagePlus } from "lucide-react"
import {
  splitModes,
  formatBaht,
  type Category,
  type SplitMode,
  type Transaction,
} from "./categories"
import { CategoryGlyph } from "./category-glyph"
import { CategoryCreator } from "./category-creator"
import type { User } from "./users"

type Props = {
  categories: Category[]
  user: User
  partner: User
  onAdd: (tx: Omit<Transaction, "id" | "createdAt" | "owed" | "payerId">, slipFile?: File) => void
  onAddCategory: (label: string, emoji: string) => string
}

export function AddTransaction({ categories, user, partner, onAdd, onAddCategory }: Props) {
  const [amount, setAmount] = useState("")
  const [detail, setDetail] = useState("")
  const [categoryId, setCategoryId] = useState("food")
  const [split, setSplit] = useState<SplitMode>("split")
  const [slipUrl, setSlipUrl] = useState<string | null>(null)
  const [slipFile, setSlipFile] = useState<File | null>(null)
  const [slipName, setSlipName] = useState("")
  const [creatingCategory, setCreatingCategory] = useState(false)
  const [myCustom, setMyCustom] = useState("")
  const [partnerCustom, setPartnerCustom] = useState("")
  const slipInputRef = useRef<HTMLInputElement>(null)

  const amountNum = Number(amount) || 0
  const myCustomNum = Number(myCustom) || 0
  const partnerCustomNum = Number(partnerCustom) || 0
  const splitIndex = splitModes.findIndex((m) => m.id === split)

  const sharePreview = useMemo(() => {
    if (amountNum <= 0) return null
    if (split === "split") return `${partner.name} ต้องจ่ายคืนคุณ ฿${formatBaht(amountNum / 2)}`
    if (split === "request") return `${partner.name} ต้องจ่ายคืนคุณ ฿${formatBaht(amountNum)}`
    if (split === "custom") {
      if (partnerCustomNum > 0) return `${partner.name} ต้องจ่ายคืนคุณ ฿${formatBaht(partnerCustomNum)}`
      return "ระบุจำนวนเงินของแต่ละคนด้านล่าง"
    }
    return null
  }, [amountNum, split, partner.name, partnerCustomNum])

  function handleSlipFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setSlipFile(file)
    setSlipName(file.name)
    setSlipUrl(URL.createObjectURL(file))
    e.target.value = ""
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (amountNum <= 0) return
    const customAmounts =
      split === "custom"
        ? { [user.id]: myCustomNum, [partner.id]: partnerCustomNum }
        : undefined
    onAdd(
      {
        amount: amountNum,
        detail: detail.trim() || "ไม่ระบุรายละเอียด",
        categoryId,
        split,
        hasSlip: !!slipUrl,
        slipUrl: slipUrl ?? undefined,
        customAmounts,
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
    setMyCustom("")
    setPartnerCustom("")
  }

  return (
    <section className="px-5">
      <form
        onSubmit={handleSubmit}
        className="rounded-[1.75rem] bg-card p-5 shadow-[0_10px_30px_-20px_oklch(0.3_0.04_55/0.5)] ring-1 ring-border"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">เพิ่มรายการ</h2>
          <span className="text-xs text-muted-foreground">บันทึกค่าใช้จ่ายร่วม</span>
        </div>

        {/* Amount */}
        <div className="mt-4 rounded-2xl bg-secondary px-4 py-4">
          <label htmlFor="amount" className="text-xs font-medium text-muted-foreground">
            จำนวนเงินรวม
          </label>
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
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-secondary text-secondary-foreground ring-1 ring-border"
                }`}
              >
                <span
                  className={`grid size-6 place-items-center rounded-full ${
                    active ? "bg-white/20 text-primary-foreground" : c.tint
                  }`}
                >
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
            <span className="grid size-6 place-items-center rounded-full bg-card ring-1 ring-border">
              <Plus className="size-3.5" />
            </span>
            เพิ่ม
          </button>
        </div>

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
              className={`relative z-10 rounded-xl py-2 text-sm font-medium transition-colors ${
                split === m.id ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Custom split */}
        {split === "custom" && (
          <div className="mt-3 rounded-2xl bg-secondary p-4 space-y-3">
            <p className="text-xs font-medium text-muted-foreground">ระบุจำนวนของแต่ละคน</p>
            <div className="flex items-center gap-3">
              <span className="w-16 shrink-0 text-sm font-medium text-foreground">{user.name}</span>
              <div className="flex flex-1 items-center gap-1.5 rounded-xl bg-card px-3 py-2 ring-1 ring-border">
                <span className="text-sm text-muted-foreground">฿</span>
                <input
                  inputMode="decimal"
                  placeholder="0"
                  value={myCustom}
                  onChange={(e) => setMyCustom(e.target.value.replace(/[^0-9.]/g, ""))}
                  className="w-full bg-transparent text-sm font-semibold text-foreground tabular-nums outline-none placeholder:text-muted-foreground/40"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-16 shrink-0 text-sm font-medium text-foreground">{partner.name}</span>
              <div className="flex flex-1 items-center gap-1.5 rounded-xl bg-card px-3 py-2 ring-1 ring-border">
                <span className="text-sm text-muted-foreground">฿</span>
                <input
                  inputMode="decimal"
                  placeholder="0"
                  value={partnerCustom}
                  onChange={(e) => setPartnerCustom(e.target.value.replace(/[^0-9.]/g, ""))}
                  className="w-full bg-transparent text-sm font-semibold text-foreground tabular-nums outline-none placeholder:text-muted-foreground/40"
                />
              </div>
            </div>
            {myCustomNum + partnerCustomNum > 0 && amountNum > 0 && (
              <p className={`text-xs font-medium ${
                Math.abs(myCustomNum + partnerCustomNum - amountNum) < 0.01
                  ? "text-accent"
                  : "text-destructive"
              }`}>
                รวม ฿{formatBaht(myCustomNum + partnerCustomNum)}
                {Math.abs(myCustomNum + partnerCustomNum - amountNum) < 0.01
                  ? " · ตรงกับยอดรวม ✓"
                  : ` · ยอดรวมต่างจาก ฿${formatBaht(amountNum)}`}
              </p>
            )}
          </div>
        )}

        {sharePreview && (
          <p className="mt-2 text-center text-xs font-medium text-accent">{sharePreview}</p>
        )}

        {/* Slip upload */}
        <input
          ref={slipInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleSlipFile}
        />

        {slipUrl ? (
          <div className="mt-4 flex items-center gap-3 rounded-2xl bg-accent/10 px-4 py-3 ring-1 ring-accent/30">
            {/* thumbnail */}
            <button
              type="button"
              onClick={() => window.open(slipUrl, "_blank")}
              className="shrink-0 size-12 rounded-xl overflow-hidden ring-1 ring-border"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={slipUrl} alt="slip" className="size-full object-cover" />
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-accent truncate">{slipName || "สลิป"}</p>
              <button
                type="button"
                onClick={() => slipInputRef.current?.click()}
                className="text-xs text-muted-foreground underline underline-offset-2 mt-0.5"
              >
                เปลี่ยนรูป
              </button>
            </div>
            <button
              type="button"
              onClick={() => { setSlipUrl(null); setSlipName("") }}
              aria-label="ลบสลิป"
              className="grid size-7 place-items-center rounded-full bg-secondary text-muted-foreground transition active:scale-90"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => slipInputRef.current?.click()}
            className="mt-4 flex w-full items-center gap-3 rounded-2xl bg-secondary px-4 py-3.5 text-sm font-medium text-muted-foreground ring-1 ring-border transition active:scale-[0.99]"
          >
            <span className="grid size-7 place-items-center rounded-lg bg-card ring-1 ring-border">
              <ImagePlus className="size-4" />
            </span>
            แนบใบเสร็จ / สลิป
          </button>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={amountNum <= 0}
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
