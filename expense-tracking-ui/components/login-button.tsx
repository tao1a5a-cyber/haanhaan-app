"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"

// Minimal sign-in: Google OAuth + Email Magic Link, both via @supabase/ssr.
export function LoginButton() {
  const supabase = createClient()
  const [email, setEmail] = useState("")
  const [sent, setSent] = useState(false)

  // Carry the guard's `?next=` through the OAuth/magic-link round-trip so the
  // user lands back on the page they were redirected away from.
  const next =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("next")
      : null
  const origin = typeof window !== "undefined" ? window.location.origin : ""
  const redirectTo = `${origin}/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ""}`

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    })
  }

  async function signInWithEmail(e: React.FormEvent) {
    e.preventDefault()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    })
    if (!error) setSent(true)
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <button
        onClick={signInWithGoogle}
        className="flex items-center justify-center gap-2.5 rounded-2xl border bg-background px-4 py-3 text-sm font-semibold text-foreground shadow-sm transition hover:bg-accent active:scale-[0.98]"
      >
        <GoogleIcon />
        เข้าสู่ระบบด้วย Google
      </button>

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">หรือ</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      {sent ? (
        <div className="flex flex-col items-center gap-1 rounded-2xl bg-accent/10 px-4 py-5 text-center">
          <span className="text-2xl">✉️</span>
          <p className="text-sm font-medium text-foreground">ส่งลิงก์ไปที่อีเมลแล้ว</p>
          <p className="text-xs text-muted-foreground">เปิดอีเมลเพื่อเข้าสู่ระบบได้เลย</p>
        </div>
      ) : (
        <form onSubmit={signInWithEmail} className="flex flex-col gap-2.5">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="อีเมลของคุณ"
            className="rounded-2xl border bg-background px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-accent/40"
          />
          <button
            type="submit"
            className="rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 active:scale-[0.98]"
          >
            ส่งลิงก์เข้าสู่ระบบ
          </button>
        </form>
      )}
    </div>
  )
}

// Google "G" mark.
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z" />
    </svg>
  )
}
