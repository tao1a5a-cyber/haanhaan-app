"use client"

import { useEffect, useRef, useState } from "react"
import { Check, X } from "lucide-react"
import { avatarChoices } from "./avatars"

const ITEM_H = 100      // px height of each row
const VISIBLE = 5       // rows visible in the wheel (odd → one centered)
const PAD = ((VISIBLE - 1) / 2) * ITEM_H

/**
 * iOS-style scroll wheel for picking a bundled goose avatar. The list snaps so
 * the centered row is the selection — drag with a finger / trackpad / wheel.
 */
export function AvatarWheel({
  valueSrc,
  tint,
  onConfirm,
  onClose,
}: {
  valueSrc?: string | null
  tint?: string
  onConfirm: (src: string) => void
  onClose: () => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number | null>(null)
  const startIndex = Math.max(0, avatarChoices.findIndex((a) => a.src === valueSrc))
  const [index, setIndex] = useState(startIndex < 0 ? 0 : startIndex)

  // Jump to the current selection on open (no smooth — instant position).
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = (startIndex < 0 ? 0 : startIndex) * ITEM_H
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function onScroll() {
    if (rafRef.current != null) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      const el = scrollRef.current
      if (!el) return
      const i = Math.round(el.scrollTop / ITEM_H)
      setIndex(Math.min(avatarChoices.length - 1, Math.max(0, i)))
    })
  }

  function scrollToIndex(i: number) {
    const el = scrollRef.current
    if (el) el.scrollTo({ top: i * ITEM_H, behavior: "smooth" })
  }

  const selected = avatarChoices[index]

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      <button type="button" aria-label="ปิด" onClick={onClose} className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" />

      <div className="relative w-full max-w-md animate-in slide-in-from-bottom-6 fade-in rounded-t-[2rem] bg-card shadow-2xl ring-1 ring-border duration-300 sm:rounded-[2rem]">
        <div className="mx-auto mb-1 mt-3 h-1.5 w-10 rounded-full bg-border sm:hidden" />

        <div className="flex items-center justify-between px-5 pb-3 pt-2">
          <h2 className="text-base font-semibold text-foreground">เลือกโปรไฟล์</h2>
          <button type="button" onClick={onClose} aria-label="ปิด" className="grid size-8 place-items-center rounded-full bg-secondary text-muted-foreground transition active:scale-90">
            <X className="size-4" />
          </button>
        </div>

        {/* Wheel */}
        <div className="relative px-5">
          {/* center selection band */}
          <div
            className="pointer-events-none absolute inset-x-5 top-1/2 -translate-y-1/2 rounded-2xl bg-accent/10 ring-1 ring-accent/30"
            style={{ height: ITEM_H }}
          />
          {/* fade top/bottom */}
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-16 bg-gradient-to-b from-card to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-16 bg-gradient-to-t from-card to-transparent" />

          <div
            ref={scrollRef}
            onScroll={onScroll}
            className="no-scrollbar snap-y snap-mandatory overflow-y-auto overscroll-contain"
            style={{ height: VISIBLE * ITEM_H, scrollbarWidth: "none" }}
          >
            <div style={{ paddingTop: PAD, paddingBottom: PAD }}>
              {avatarChoices.map((a, i) => {
                const d = Math.abs(i - index)
                const active = d === 0
                return (
                  <button
                    type="button"
                    key={a.src}
                    onClick={() => scrollToIndex(i)}
                    className="flex w-full snap-center items-center gap-4 px-2 transition-[opacity,transform] duration-150"
                    style={{
                      height: ITEM_H,
                      opacity: Math.max(0.3, 1 - d * 0.28),
                      transform: `scale(${Math.max(0.74, 1 - d * 0.1)})`,
                    }}
                  >
                    <span
                      className="grid size-[76px] shrink-0 place-items-center overflow-hidden rounded-full ring-1 ring-border"
                      style={{ backgroundColor: tint }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={a.src} alt="" className="size-[90%] object-contain" />
                    </span>
                    <span className={`truncate text-left text-lg ${active ? "font-bold text-foreground" : "font-medium text-muted-foreground"}`}>
                      {a.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 px-5 pb-8 pt-3">
          <button type="button" onClick={onClose} className="rounded-2xl bg-secondary py-3.5 text-sm font-semibold text-foreground ring-1 ring-border transition active:scale-[0.99]">
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={() => { onConfirm(selected.src); onClose() }}
            className="flex items-center justify-center gap-2 rounded-2xl bg-accent py-3.5 text-sm font-semibold text-accent-foreground shadow-sm transition active:scale-[0.99]"
          >
            <Check className="size-4" />
            เลือก{selected ? ` ${selected.label}` : ""}
          </button>
        </div>
      </div>
    </div>
  )
}
