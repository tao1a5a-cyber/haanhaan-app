"use client"

import { useState } from "react"
import { ArrowRight, KeyRound, Loader2 } from "lucide-react"
import { fetchGroupByRoomCode } from "@/lib/db"
import { enterGuestMode, enterRoomMode } from "@/lib/access-mode"

/**
 * Login-page extras for visitors who don't want to sign in:
 *   • "เริ่มใช้งานเลย" → offline Guest Mode (localStorage).
 *   • Room Code field  → join a specific cloud group shared by someone else.
 */
export function GuestAccess() {
  const [code, setCode] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  function startGuest() {
    enterGuestMode()
    window.location.href = "/"
  }

  async function joinRoom(e: React.FormEvent) {
    e.preventDefault()
    const normalized = code.trim().toUpperCase()
    if (!normalized) return
    setLoading(true)
    setError("")
    const group = await fetchGroupByRoomCode(normalized)
    if (group) {
      enterRoomMode(normalized)
      window.location.href = "/"
    } else {
      setError("ไม่พบห้องนี้ ตรวจสอบรหัสอีกครั้ง")
      setLoading(false)
    }
  }

  return (
    <div className="mt-5 rounded-3xl bg-card p-6 shadow-sm ring-1 ring-border">
      <button
        type="button"
        onClick={startGuest}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 active:scale-[0.98]"
      >
        ทดลองใช้งาน
        <ArrowRight className="size-4" />
      </button>
      <p className="mt-2 text-center text-[11px] leading-relaxed text-muted-foreground">
        ทดลองใช้แบบออฟไลน์ได้สูงสุด 100 รายการ — ข้อมูลเก็บในเครื่องนี้
      </p>

      <div className="my-4 flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">มีรหัสห้อง?</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={joinRoom} className="flex flex-col gap-2.5">
        <div className="flex items-center gap-2 rounded-2xl border bg-background px-3 py-2.5 ring-1 ring-transparent transition focus-within:ring-accent/40">
          <KeyRound className="size-4 shrink-0 text-muted-foreground" />
          <input
            type="text"
            value={code}
            onChange={(e) => { setCode(e.target.value.toUpperCase()); setError("") }}
            placeholder="กรอกรหัสห้อง"
            autoCapitalize="characters"
            maxLength={12}
            className="w-full bg-transparent text-sm font-medium tracking-widest text-foreground outline-none placeholder:font-normal placeholder:tracking-normal placeholder:text-muted-foreground"
          />
        </div>
        {error && <p className="text-center text-xs text-destructive">{error}</p>}
        <button
          type="submit"
          disabled={loading || !code.trim()}
          className="flex items-center justify-center gap-2 rounded-2xl border bg-background px-4 py-3 text-sm font-semibold text-foreground shadow-sm transition hover:bg-accent active:scale-[0.98] disabled:opacity-50"
        >
          {loading && <Loader2 className="size-4 animate-spin" />}
          เข้าห้องด้วยรหัส
        </button>
      </form>
    </div>
  )
}
