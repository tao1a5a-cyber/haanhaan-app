"use client"

import { useState } from "react"
import Image from "next/image"

// Subtle "support development" button that reveals a Thai PromptPay QR.
export function DonateButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="ml-2 inline-flex items-center gap-1 opacity-70 transition hover:opacity-100"
      >
        ☕ สนับสนุน
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
          />
          <div className="relative w-full max-w-xs rounded-2xl bg-background p-5 text-center shadow-2xl ring-1 ring-border">
            <p className="text-sm font-semibold text-foreground">
              สนับสนุนการพัฒนาแอป
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              สนับสนุนการพัฒนาแอปเป็นค่ากาแฟ
              <br />
              ได้ที่พร้อมเพย์ด้านล่างนี้ครับ
            </p>
            <Image
              src="/donate-qr.jpg"
              alt="PromptPay donation QR code"
              width={260}
              height={360}
              className="mx-auto mt-3 h-auto w-full rounded-lg"
              priority
            />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-4 w-full rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  )
}
