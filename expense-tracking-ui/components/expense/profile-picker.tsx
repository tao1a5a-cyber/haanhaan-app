"use client"

import { useState } from "react"
import Image from "next/image"
import { USERS, type User } from "./users"

type Props = {
  users?: User[]
  onSelect: (user: User) => void
}

export function ProfilePicker({ users = USERS, onSelect }: Props) {
  const [leaving, setLeaving] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  function handleSelect(user: User) {
    if (leaving) return
    setSelectedId(user.id)
    setLeaving(true)
    setTimeout(() => onSelect(user), 300)
  }

  return (
    <main
      className="mx-auto relative flex min-h-screen w-full max-w-md flex-col overflow-hidden"
      style={{
        background: "linear-gradient(160deg, oklch(0.22 0.06 265) 0%, oklch(0.17 0.04 255) 55%, oklch(0.13 0.03 245) 100%)",
        opacity: leaving ? 0 : 1,
        transform: leaving ? "scale(0.96)" : "scale(1)",
        transition: "opacity 280ms ease, transform 280ms ease",
      }}
    >
      {/* Decorative blobs */}
      <div
        className="pointer-events-none absolute -left-24 -top-24 size-80 rounded-full opacity-30 blur-3xl"
        style={{ background: "radial-gradient(circle, oklch(0.65 0.22 295), transparent 70%)" }}
      />
      <div
        className="pointer-events-none absolute -right-16 top-1/3 size-64 rounded-full opacity-20 blur-3xl"
        style={{ background: "radial-gradient(circle, oklch(0.60 0.18 220), transparent 70%)" }}
      />

      {/* ── Brand zone ── */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 pb-4 pt-16">
        <div className="overflow-hidden rounded-[2rem] shadow-[0_20px_48px_-12px_oklch(0.05_0.04_55/0.8)]">
          <Image
            src="/logo.png"
            alt="HaanHaan"
            width={160}
            height={160}
            className="size-[160px] object-cover"
            priority
          />
        </div>
        <p className="mt-6 text-center text-base font-medium text-white/60 leading-relaxed">
          หารค่าใช้จ่าย หารความสบายใจ
        </p>
      </div>

      {/* ── Profile zone ── */}
      <div className="rounded-t-[2.5rem] bg-background px-6 pt-8 pb-12 shadow-[0_-12px_40px_oklch(0.05_0.04_55/0.4)]">
        <p className="mb-7 text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
          เลือกโปรไฟล์
        </p>
        <div className="grid grid-cols-2 gap-4">
          {users.map((user) => (
            <button
              key={user.id}
              type="button"
              onClick={() => handleSelect(user)}
              disabled={leaving}
              className="group flex flex-col items-center gap-3.5 outline-none"
              aria-label={`เข้าใช้งานในชื่อ ${user.name}`}
            >
              <span
                className="grid aspect-square w-full place-items-center rounded-full shadow-[0_12px_28px_-10px_oklch(0.3_0.04_55/0.55)] transition-all duration-200 group-hover:-translate-y-1.5 group-active:scale-[0.96] group-focus-visible:ring-2 group-focus-visible:ring-offset-2"
                style={{
                  backgroundColor: user.tint,
                  transform: selectedId === user.id ? "scale(1.12)" : undefined,
                  boxShadow:
                    selectedId === user.id
                      ? `0 0 0 3px white, 0 16px 40px -10px oklch(0.3 0.04 55/0.7)`
                      : undefined,
                  transition: "transform 200ms ease, box-shadow 200ms ease",
                }}
              >
                <Image
                  src={user.avatar || "/placeholder.svg"}
                  alt=""
                  width={120}
                  height={120}
                  className="size-[60%] object-contain drop-shadow-sm"
                />
              </span>
              <span className="text-lg font-bold text-foreground">{user.name}</span>
            </button>
          ))}
        </div>
      </div>
    </main>
  )
}
