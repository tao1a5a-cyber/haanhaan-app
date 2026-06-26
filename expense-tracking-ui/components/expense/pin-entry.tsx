"use client"

import { useState } from "react"
import Image from "next/image"
import { Delete } from "lucide-react"
import type { User } from "./users"

type Props = {
  user: User
  onSuccess: () => void
  onCancel: () => void
  checkPin: (pin: string) => Promise<boolean>
}

const KEYS = ["1","2","3","4","5","6","7","8","9","","0","⌫"]

export function PinEntry({ user, onSuccess, onCancel, checkPin }: Props) {
  const [digits, setDigits] = useState<string[]>([])
  const [shake, setShake] = useState(false)
  const [error, setError] = useState(false)
  const [checking, setChecking] = useState(false)

  async function press(key: string) {
    if (checking) return
    if (key === "⌫") {
      setDigits((d) => d.slice(0, -1))
      setError(false)
      return
    }
    if (key === "") return
    if (digits.length >= 6) return

    const next = [...digits, key]
    setDigits(next)

    if (next.length >= 4) {
      const pin = next.join("")
      setChecking(true)
      const ok = await checkPin(pin)
      setChecking(false)
      if (ok) {
        onSuccess()
      } else {
        setShake(true)
        setError(true)
        setTimeout(() => { setShake(false); setDigits([]) }, 600)
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background px-8">
      {/* Avatar */}
      <div
        className="grid size-20 place-items-center overflow-hidden rounded-full shadow-md ring-2 ring-border mb-4"
        style={{ backgroundColor: user.tint }}
      >
        <Image src={user.avatar || "/placeholder.svg"} alt="" width={80} height={80} className="size-[72%] object-contain" />
      </div>

      <p className="text-lg font-semibold text-foreground mb-1">{user.name}</p>
      <p className="text-sm text-muted-foreground mb-8">ใส่รหัสผ่านเพื่อเข้าใช้งาน</p>

      {/* Dots */}
      <div
        className="flex gap-4 mb-10"
        style={{ animation: shake ? "shake 0.5s ease" : undefined }}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <span
            key={i}
            className={`size-3.5 rounded-full transition-all duration-150 ${
              i < digits.length
                ? error ? "bg-destructive" : "bg-accent"
                : "bg-border"
            }`}
          />
        ))}
      </div>

      {error && (
        <p className="text-xs text-destructive mb-6 -mt-6">รหัสผ่านไม่ถูกต้อง</p>
      )}

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-3 w-full max-w-[280px]">
        {KEYS.map((key, i) => (
          <button
            key={i}
            type="button"
            onClick={() => press(key)}
            disabled={key === ""}
            className={`flex items-center justify-center h-16 rounded-2xl text-xl font-semibold transition active:scale-90 select-none ${
              key === "" ? "invisible" :
              key === "⌫" ? "bg-secondary text-muted-foreground" :
              "bg-secondary text-foreground hover:bg-secondary/80"
            }`}
          >
            {key === "⌫" ? <Delete className="size-5" /> : key}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={onCancel}
        className="mt-8 text-sm text-muted-foreground underline underline-offset-2"
      >
        เลือกโปรไฟล์อื่น
      </button>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
      `}</style>
    </div>
  )
}
