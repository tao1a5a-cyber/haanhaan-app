"use client"

import { useRef, useState } from "react"
import Image from "next/image"
import { X, Eye, EyeOff, Camera, Loader2 } from "lucide-react"
import type { User } from "./users"
import { THEMES } from "./themes"
import { cropToCircle, uploadAvatar } from "@/lib/storage"
import { hashPin } from "@/lib/pin"
import { isSupabaseConfigured } from "@/lib/supabase"

type Props = {
  user: User
  onSave: (updated: Partial<User>, pinHash?: string) => void
  hasPin: boolean
  onClose: () => void
}

export function SettingsPanel({ user, onSave, hasPin, onClose }: Props) {
  const [name, setName] = useState(user.name)
  const [avatar, setAvatar] = useState(user.avatar)
  const [avatarBlob, setAvatarBlob] = useState<Blob | null>(null)
  const [themeId, setThemeId] = useState(user.themeId ?? "amber")
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const [section, setSection] = useState<"main" | "pin">("main")
  const [pin, setPin] = useState("")
  const [confirmPin, setConfirmPin] = useState("")
  const [showPin, setShowPin] = useState(false)
  const [pinError, setPinError] = useState("")
  const [savingPin, setSavingPin] = useState(false)

  async function handleAvatarFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const blob = await cropToCircle(file)
      setAvatarBlob(blob)
      setAvatar(URL.createObjectURL(blob))
    } catch {
      // Fallback to FileReader if canvas fails
      const reader = new FileReader()
      reader.onload = (ev) => {
        if (typeof ev.target?.result === "string") setAvatar(ev.target.result)
      }
      reader.readAsDataURL(file)
    }
  }

  async function handleSave() {
    setUploading(true)
    try {
      const activeTheme = THEMES.find((t) => t.id === themeId) ?? THEMES[0]
      const updated: Partial<User> = {}

      if (name.trim() && name.trim() !== user.name) updated.name = name.trim()

      if (avatarBlob) {
        if (isSupabaseConfigured) {
          const url = await uploadAvatar(user.id, avatarBlob)
          if (url) updated.avatar = url
        } else {
          // Offline: keep dataURL
          updated.avatar = avatar
        }
      }

      if (themeId !== (user.themeId ?? "amber")) {
        updated.themeId = themeId
        updated.tint = activeTheme.tint
      }

      if (Object.keys(updated).length > 0) onSave(updated)
    } finally {
      setUploading(false)
      onClose()
    }
  }

  async function handleSavePin() {
    if (pin.length < 4) { setPinError("รหัสผ่านต้องมีอย่างน้อย 4 ตัว"); return }
    if (pin !== confirmPin) { setPinError("รหัสผ่านไม่ตรงกัน"); return }
    setSavingPin(true)
    try {
      const hash = await hashPin(pin, user.id)
      onSave({}, hash)
      setSection("main")
      setPin("")
      setConfirmPin("")
      setPinError("")
    } finally {
      setSavingPin(false)
    }
  }

  const isBlob = avatar.startsWith("blob:")
  const isDataUrl = avatar.startsWith("data:")
  const isCustomAvatar = isBlob || isDataUrl
  const activeTheme = THEMES.find((t) => t.id === themeId) ?? THEMES[0]

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="ปิด"
        onClick={onClose}
        className="absolute inset-0 bg-foreground/30 backdrop-blur-sm"
      />

      <div className="relative w-full max-w-md animate-in slide-in-from-bottom-4 fade-in duration-300 rounded-t-[2rem] bg-card shadow-2xl ring-1 ring-border sm:rounded-[2rem] overflow-hidden">
        <div className="mx-auto mt-3 h-1.5 w-10 rounded-full bg-border sm:hidden" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border">
          {section === "pin" ? (
            <button
              type="button"
              onClick={() => { setSection("main"); setPinError(""); setPin(""); setConfirmPin("") }}
              className="text-sm font-medium text-accent"
            >
              ← กลับ
            </button>
          ) : (
            <h2 className="text-base font-semibold text-foreground">ตั้งค่าโปรไฟล์</h2>
          )}
          {section === "main" && (
            <button
              type="button"
              onClick={onClose}
              aria-label="ปิด"
              className="grid size-8 place-items-center rounded-full bg-secondary text-muted-foreground transition active:scale-90"
            >
              <X className="size-4" />
            </button>
          )}
          {section === "pin" && (
            <h2 className="text-base font-semibold text-foreground absolute left-1/2 -translate-x-1/2">
              {hasPin ? "เปลี่ยนรหัสผ่าน" : "ตั้งรหัสผ่าน"}
            </h2>
          )}
        </div>

        <div className="px-5 py-5 space-y-6 max-h-[70vh] overflow-y-auto pb-8">
          {section === "main" && (
            <>
              {/* Avatar upload + preview */}
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  className="relative shrink-0 group"
                  aria-label="เปลี่ยนรูปโปรไฟล์"
                >
                  <div
                    className="grid size-20 place-items-center overflow-hidden rounded-full ring-2 ring-border shadow-sm"
                    style={{ backgroundColor: isCustomAvatar ? undefined : activeTheme.tint }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={avatar || "/placeholder.svg"}
                      alt=""
                      width={80}
                      height={80}
                      className={isCustomAvatar ? "size-full object-cover" : "size-[72%] object-contain"}
                    />
                  </div>
                  <span className="absolute inset-0 flex items-center justify-center rounded-full bg-foreground/0 group-hover:bg-foreground/25 transition">
                    <Camera className="size-5 text-white opacity-0 group-hover:opacity-100 drop-shadow transition" />
                  </span>
                </button>
                <div>
                  <p className="text-base font-semibold text-foreground">{name || user.name}</p>
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    className="text-xs text-accent mt-0.5 underline underline-offset-2"
                  >
                    เปลี่ยนรูปโปรไฟล์ (ครอปวงกลมอัตโนมัติ)
                  </button>
                </div>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarFile}
                />
              </div>

              {/* Name */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">ชื่อ</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={20}
                  className="w-full rounded-2xl bg-secondary px-4 py-3 text-sm text-foreground outline-none ring-1 ring-transparent focus:ring-accent transition placeholder:text-muted-foreground"
                  placeholder="ใส่ชื่อของคุณ"
                />
              </div>

              {/* Theme color */}
              <div className="space-y-3">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">สีธีม</label>
                <div className="grid grid-cols-3 gap-2">
                  {THEMES.map((theme) => (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() => setThemeId(theme.id)}
                      aria-label={theme.label}
                      className={`flex items-center gap-2 rounded-2xl px-3 py-2.5 text-xs font-medium transition active:scale-95 ${
                        themeId === theme.id ? "shadow-sm" : "bg-secondary text-muted-foreground"
                      }`}
                      style={
                        themeId === theme.id
                          ? {
                              backgroundColor: theme.vars.accent,
                              color: "white",
                              outline: `2px solid ${theme.vars.accent}`,
                              outlineOffset: "2px",
                            }
                          : undefined
                      }
                    >
                      <span
                        className="size-3.5 rounded-full shrink-0 shadow-sm border border-white/30"
                        style={{ backgroundColor: theme.swatch }}
                      />
                      {theme.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* PIN */}
              <button
                type="button"
                onClick={() => setSection("pin")}
                className="w-full flex items-center justify-between rounded-2xl bg-secondary px-4 py-3.5 text-sm font-medium text-foreground transition active:scale-[0.98]"
              >
                <span>{hasPin ? "เปลี่ยนรหัสผ่าน" : "ตั้งรหัสผ่าน"}</span>
                <span className="text-muted-foreground text-xs">{hasPin ? "●●●●" : "ยังไม่ได้ตั้ง"} →</span>
              </button>

              {/* Save */}
              <button
                type="button"
                onClick={handleSave}
                disabled={uploading}
                className="w-full flex items-center justify-center gap-2 rounded-2xl bg-accent py-3.5 text-sm font-semibold text-accent-foreground shadow-sm transition active:scale-[0.98] disabled:opacity-60"
              >
                {uploading && <Loader2 className="size-4 animate-spin" />}
                {uploading ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </>
          )}

          {section === "pin" && (
            <div className="space-y-4 pt-2">
              <p className="text-sm text-muted-foreground text-center">
                ตั้งรหัสผ่านสำหรับป้องกันการเข้าใช้งานโปรไฟล์นี้
              </p>

              <div className="space-y-3">
                <div className="relative">
                  <input
                    type={showPin ? "text" : "password"}
                    value={pin}
                    onChange={(e) => { setPin(e.target.value); setPinError("") }}
                    maxLength={20}
                    placeholder="รหัสผ่านใหม่"
                    className="w-full rounded-2xl bg-secondary px-4 py-3 pr-12 text-sm text-foreground outline-none ring-1 ring-transparent focus:ring-accent transition placeholder:text-muted-foreground"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground"
                  >
                    {showPin ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>

                <input
                  type={showPin ? "text" : "password"}
                  value={confirmPin}
                  onChange={(e) => { setConfirmPin(e.target.value); setPinError("") }}
                  maxLength={20}
                  placeholder="ยืนยันรหัสผ่าน"
                  className="w-full rounded-2xl bg-secondary px-4 py-3 text-sm text-foreground outline-none ring-1 ring-transparent focus:ring-accent transition placeholder:text-muted-foreground"
                />

                {pinError && (
                  <p className="text-xs text-destructive text-center">{pinError}</p>
                )}
              </div>

              <button
                type="button"
                onClick={handleSavePin}
                disabled={savingPin}
                className="w-full flex items-center justify-center gap-2 rounded-2xl bg-accent py-3.5 text-sm font-semibold text-accent-foreground shadow-sm transition active:scale-[0.98] disabled:opacity-60"
              >
                {savingPin && <Loader2 className="size-4 animate-spin" />}
                บันทึกรหัสผ่าน
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
