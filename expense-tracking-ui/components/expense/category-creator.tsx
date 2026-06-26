"use client"

import { useRef, useState } from "react"
import { X, Check, Pencil } from "lucide-react"
import { emojiChoices } from "./categories"

type Props = {
  onClose: () => void
  onCreate: (label: string, emoji: string) => void
}

export function CategoryCreator({ onClose, onCreate }: Props) {
  const [emoji, setEmoji] = useState(emojiChoices[0])
  const [label, setLabel] = useState("")
  const [customEmojiMode, setCustomEmojiMode] = useState(false)
  const [customEmojiInput, setCustomEmojiInput] = useState("")
  const customEmojiRef = useRef<HTMLInputElement>(null)

  function handleSave() {
    if (!label.trim()) return
    onCreate(label.trim(), emoji)
  }

  function applyCustomEmoji() {
    const firstEmoji = [...customEmojiInput].find((ch) => {
      const cp = ch.codePointAt(0) ?? 0
      return cp > 0x2000
    })
    if (firstEmoji) {
      setEmoji(firstEmoji)
      setCustomEmojiMode(false)
      setCustomEmojiInput("")
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* backdrop */}
      <button
        type="button"
        aria-label="ปิด"
        onClick={onClose}
        className="absolute inset-0 bg-foreground/30 backdrop-blur-sm"
      />

      {/* sheet */}
      <div className="relative w-full max-w-md animate-in slide-in-from-bottom-4 fade-in duration-300 rounded-t-[2rem] bg-card p-5 pb-8 shadow-2xl ring-1 ring-border sm:rounded-[2rem]">
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-border sm:hidden" />

        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">หมวดหมู่ใหม่</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิด"
            className="grid size-8 place-items-center rounded-full bg-secondary text-muted-foreground transition active:scale-90"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* live preview + name */}
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-secondary p-3">
          <button
            type="button"
            onClick={() => {
              setCustomEmojiMode(true)
              setTimeout(() => customEmojiRef.current?.focus(), 50)
            }}
            className="group relative grid size-12 shrink-0 place-items-center rounded-xl bg-card text-2xl shadow-sm ring-1 ring-border transition active:scale-95"
            aria-label="เปลี่ยนอิโมจิ"
          >
            {emoji}
            <span className="absolute inset-0 grid place-items-center rounded-xl bg-foreground/0 text-transparent transition group-hover:bg-foreground/10 group-hover:text-foreground">
              <Pencil className="size-4" />
            </span>
          </button>
          <input
            autoFocus
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            placeholder="ตั้งชื่อหมวด เช่น กาแฟ"
            maxLength={16}
            className="w-full bg-transparent text-base font-medium text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>

        {/* Custom emoji input */}
        {customEmojiMode && (
          <div className="mt-3 flex items-center gap-2 rounded-2xl bg-secondary p-3">
            <input
              ref={customEmojiRef}
              value={customEmojiInput}
              onChange={(e) => setCustomEmojiInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") applyCustomEmoji()
                if (e.key === "Escape") { setCustomEmojiMode(false); setCustomEmojiInput("") }
              }}
              placeholder="พิมพ์หรือวางอิโมจิที่ต้องการ…"
              className="flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-sm placeholder:text-muted-foreground"
            />
            <button
              type="button"
              onClick={applyCustomEmoji}
              disabled={!customEmojiInput.trim()}
              className="rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition active:scale-95 disabled:opacity-40"
            >
              ใช้
            </button>
            <button
              type="button"
              onClick={() => { setCustomEmojiMode(false); setCustomEmojiInput("") }}
              className="rounded-xl bg-secondary px-2 py-1.5 text-xs text-muted-foreground ring-1 ring-border transition active:scale-95"
            >
              ยกเลิก
            </button>
          </div>
        )}

        {/* emoji grid */}
        <p className="mt-4 mb-2 text-xs font-medium text-muted-foreground">เลือกอิโมจิ</p>
        <div className="grid grid-cols-8 gap-1.5">
          {emojiChoices.map((e) => {
            const active = e === emoji
            return (
              <button
                key={e}
                type="button"
                onClick={() => { setEmoji(e); setCustomEmojiMode(false) }}
                className={`grid aspect-square place-items-center rounded-xl text-xl transition active:scale-90 ${
                  active
                    ? "bg-accent/15 ring-2 ring-accent"
                    : "bg-secondary ring-1 ring-transparent hover:ring-border"
                }`}
              >
                {e}
              </button>
            )
          })}
        </div>

        {/* save */}
        <button
          type="button"
          onClick={handleSave}
          disabled={!label.trim()}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground shadow-sm transition active:scale-[0.99] disabled:opacity-40"
        >
          <Check className="size-4" />
          เพิ่มหมวดหมู่
        </button>
      </div>
    </div>
  )
}
