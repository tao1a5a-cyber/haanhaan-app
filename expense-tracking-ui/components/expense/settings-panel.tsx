"use client"

import { useRef, useState } from "react"
import { X, Eye, EyeOff, Camera, Loader2, UserCog, Users, Palette, Lock, Trash2, UserPlus, Check } from "lucide-react"
import { isCustomAvatar } from "./users"
import { MemberAvatar } from "./member-avatar"
import { THEMES } from "./themes"
import { cropToCircle, uploadAvatar } from "@/lib/storage"
import { hashPin } from "@/lib/pin"
import { isSupabaseConfigured } from "@/lib/supabase"
import type { Group, Member } from "./types"

type Props = {
  group: Group
  member: Member
  onSave: (updated: Partial<Member>, pinHash?: string) => void
  onAddMember: (name: string) => void
  onRemoveMember: (id: string) => void
  onRenameGroup: (name: string) => void
  onClose: () => void
}

export function SettingsPanel({ group, member, onSave, onAddMember, onRemoveMember, onRenameGroup, onClose }: Props) {
  const [name, setName] = useState(member.name)
  const [avatar, setAvatar] = useState(member.avatar)
  const [avatarBlob, setAvatarBlob] = useState<Blob | null>(null)
  const [themeId, setThemeId] = useState(member.themeId ?? "amber")
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const [section, setSection] = useState<"main" | "pin">("main")
  const [pin, setPin] = useState("")
  const [confirmPin, setConfirmPin] = useState("")
  const [showPin, setShowPin] = useState(false)
  const [pinError, setPinError] = useState("")
  const [savingPin, setSavingPin] = useState(false)

  const [groupName, setGroupName] = useState(group.name)
  const [newMember, setNewMember] = useState("")

  async function handleAvatarFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const blob = await cropToCircle(file)
      setAvatarBlob(blob)
      setAvatar(URL.createObjectURL(blob))
    } catch {
      const reader = new FileReader()
      reader.onload = (ev) => { if (typeof ev.target?.result === "string") setAvatar(ev.target.result) }
      reader.readAsDataURL(file)
    }
  }

  async function handleSave() {
    setUploading(true)
    try {
      const activeTheme = THEMES.find((t) => t.id === themeId) ?? THEMES[0]
      const updated: Partial<Member> = {}
      if (name.trim() && name.trim() !== member.name) updated.name = name.trim()
      if (avatarBlob) {
        if (isSupabaseConfigured) {
          const url = await uploadAvatar(member.id, avatarBlob)
          if (url) updated.avatar = url
        } else {
          updated.avatar = avatar
        }
      }
      if (themeId !== (member.themeId ?? "amber")) {
        updated.themeId = themeId
        updated.tint = activeTheme.tint
      }
      if (groupName.trim() && groupName.trim() !== group.name) onRenameGroup(groupName.trim())
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
      const hash = await hashPin(pin, member.id)
      onSave({}, hash)
      setSection("main"); setPin(""); setConfirmPin(""); setPinError("")
    } finally {
      setSavingPin(false)
    }
  }

  function handleAddMember() {
    const n = newMember.trim()
    if (!n) return
    onAddMember(n)
    setNewMember("")
  }

  const customAvatar = isCustomAvatar(avatar)
  const activeTheme = THEMES.find((t) => t.id === themeId) ?? THEMES[0]

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button type="button" aria-label="ปิด" onClick={onClose} className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" />

      <div className="relative w-full max-w-md animate-in slide-in-from-bottom-4 fade-in overflow-hidden rounded-t-[2rem] shadow-2xl ring-1 ring-border duration-300 sm:rounded-[2rem]"
        style={{ background: "linear-gradient(180deg, oklch(0.985 0.01 80), oklch(0.965 0.02 60))" }}
      >
        <div className="mx-auto mt-3 h-1.5 w-10 rounded-full bg-border sm:hidden" />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/60 px-5 pb-3 pt-4">
          {section === "pin" ? (
            <button type="button" onClick={() => { setSection("main"); setPinError(""); setPin(""); setConfirmPin("") }} className="text-sm font-medium text-accent">← กลับ</button>
          ) : (
            <h2 className="text-base font-semibold text-foreground">ตั้งค่า</h2>
          )}
          {section === "pin" ? (
            <h2 className="absolute left-1/2 -translate-x-1/2 text-base font-semibold text-foreground">ตั้งรหัสผ่าน</h2>
          ) : (
            <button type="button" onClick={onClose} aria-label="ปิด" className="grid size-8 place-items-center rounded-full bg-secondary text-muted-foreground transition active:scale-90">
              <X className="size-4" />
            </button>
          )}
        </div>

        <div className="max-h-[74vh] space-y-4 overflow-y-auto px-5 py-5 pb-8">
          {section === "main" && (
            <>
              {/* ── Profile section ── */}
              <SectionCard icon={<UserCog className="size-4" />} title="โปรไฟล์ของฉัน" accent={activeTheme.vars.accent}>
                <div className="flex items-center gap-4">
                  <button type="button" onClick={() => avatarInputRef.current?.click()} className="group relative shrink-0" aria-label="เปลี่ยนรูปโปรไฟล์">
                    <span
                      className="relative grid size-[72px] place-items-center overflow-hidden rounded-full shadow-sm ring-2 ring-border"
                      style={{ backgroundColor: customAvatar ? undefined : activeTheme.tint }}
                    >
                      {avatar && !avatar.endsWith("/placeholder.svg") ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={avatar} alt="" className={customAvatar ? "absolute inset-0 size-full object-cover" : "size-[72%] object-contain"} />
                      ) : (
                        <span className="text-2xl font-bold text-foreground/80">{(name || member.name).charAt(0)}</span>
                      )}
                    </span>
                    <span className="absolute inset-0 flex items-center justify-center rounded-full bg-foreground/0 transition group-hover:bg-foreground/25">
                      <Camera className="size-5 text-white opacity-0 drop-shadow transition group-hover:opacity-100" />
                    </span>
                  </button>
                  <div className="min-w-0 flex-1">
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      maxLength={20}
                      placeholder="ชื่อของคุณ"
                      className="w-full rounded-xl bg-secondary px-3 py-2.5 text-sm font-medium text-foreground outline-none ring-1 ring-transparent transition placeholder:text-muted-foreground focus:ring-accent"
                    />
                    <button type="button" onClick={() => avatarInputRef.current?.click()} className="mt-1 text-xs text-accent underline underline-offset-2">
                      เปลี่ยนรูป (ครอปวงกลมอัตโนมัติ)
                    </button>
                  </div>
                  <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarFile} />
                </div>

                {/* Theme */}
                <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                  <Palette className="size-3.5" /> สีธีม
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {THEMES.map((theme) => (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() => setThemeId(theme.id)}
                      aria-label={theme.label}
                      className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-medium transition active:scale-95 ${themeId === theme.id ? "shadow-sm" : "bg-secondary text-muted-foreground"}`}
                      style={themeId === theme.id ? { backgroundColor: theme.vars.accent, color: "white" } : undefined}
                    >
                      <span className="size-3.5 shrink-0 rounded-full border border-white/30 shadow-sm" style={{ backgroundColor: theme.swatch }} />
                      {theme.label}
                    </button>
                  ))}
                </div>

                {/* PIN */}
                <button type="button" onClick={() => setSection("pin")} className="mt-4 flex w-full items-center justify-between rounded-xl bg-secondary px-4 py-3 text-sm font-medium text-foreground transition active:scale-[0.98]">
                  <span className="flex items-center gap-2"><Lock className="size-4 text-muted-foreground" /> ตั้ง / เปลี่ยนรหัสผ่าน</span>
                  <span className="text-xs text-muted-foreground">→</span>
                </button>
              </SectionCard>

              {/* ── Group section ── */}
              <SectionCard icon={<Users className="size-4" />} title="กลุ่ม" accent={activeTheme.vars.accent}>
                <label className="text-xs font-semibold text-muted-foreground">ชื่อกลุ่ม</label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  maxLength={30}
                  className="mt-1.5 w-full rounded-xl bg-secondary px-3 py-2.5 text-sm font-medium text-foreground outline-none ring-1 ring-transparent transition focus:ring-accent"
                />

                <p className="mb-2 mt-4 text-xs font-semibold text-muted-foreground">สมาชิก ({group.members.length})</p>
                <ul className="space-y-2">
                  {group.members.map((m) => (
                    <li key={m.id} className="flex items-center gap-3 rounded-xl bg-secondary px-3 py-2">
                      <MemberAvatar member={m} size={32} />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                        {m.name}{m.id === member.id ? " (คุณ)" : ""}
                      </span>
                      {m.id !== member.id && (
                        <button
                          type="button"
                          onClick={() => onRemoveMember(m.id)}
                          aria-label={`ลบ ${m.name}`}
                          className="grid size-8 place-items-center rounded-full text-muted-foreground transition hover:bg-card hover:text-destructive active:scale-90"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>

                <div className="mt-3 flex items-center gap-2">
                  <div className="flex flex-1 items-center gap-2 rounded-xl bg-secondary px-3 py-2 ring-1 ring-transparent focus-within:ring-accent">
                    <UserPlus className="size-4 text-muted-foreground" />
                    <input
                      value={newMember}
                      onChange={(e) => setNewMember(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleAddMember() }}
                      placeholder="เพิ่มสมาชิกใหม่"
                      className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddMember}
                    disabled={!newMember.trim()}
                    className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground shadow-sm transition active:scale-95 disabled:opacity-40"
                  >
                    <Check className="size-4" />
                  </button>
                </div>
              </SectionCard>

              {/* Save */}
              <button
                type="button"
                onClick={handleSave}
                disabled={uploading}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground shadow-sm transition active:scale-[0.98] disabled:opacity-60"
              >
                {uploading && <Loader2 className="size-4 animate-spin" />}
                {uploading ? "กำลังบันทึก..." : "บันทึกการตั้งค่า"}
              </button>
            </>
          )}

          {section === "pin" && (
            <div className="space-y-4 pt-2">
              <p className="text-center text-sm text-muted-foreground">ตั้งรหัสผ่านเพื่อป้องกันการเข้าใช้งานโปรไฟล์นี้</p>
              <div className="space-y-3">
                <div className="relative">
                  <input
                    type={showPin ? "text" : "password"}
                    value={pin}
                    onChange={(e) => { setPin(e.target.value); setPinError("") }}
                    maxLength={20}
                    placeholder="รหัสผ่านใหม่"
                    className="w-full rounded-2xl bg-secondary px-4 py-3 pr-12 text-sm text-foreground outline-none ring-1 ring-transparent transition placeholder:text-muted-foreground focus:ring-accent"
                  />
                  <button type="button" onClick={() => setShowPin(!showPin)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground">
                    {showPin ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                <input
                  type={showPin ? "text" : "password"}
                  value={confirmPin}
                  onChange={(e) => { setConfirmPin(e.target.value); setPinError("") }}
                  maxLength={20}
                  placeholder="ยืนยันรหัสผ่าน"
                  className="w-full rounded-2xl bg-secondary px-4 py-3 text-sm text-foreground outline-none ring-1 ring-transparent transition placeholder:text-muted-foreground focus:ring-accent"
                />
                {pinError && <p className="text-center text-xs text-destructive">{pinError}</p>}
              </div>
              <button type="button" onClick={handleSavePin} disabled={savingPin} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-accent py-3.5 text-sm font-semibold text-accent-foreground shadow-sm transition active:scale-[0.98] disabled:opacity-60">
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

function SectionCard({ icon, title, accent, children }: { icon: React.ReactNode; title: string; accent: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[1.4rem] bg-card p-4 shadow-sm ring-1 ring-border">
      <div className="mb-3 flex items-center gap-2">
        <span className="grid size-7 place-items-center rounded-lg text-white" style={{ backgroundColor: accent }}>{icon}</span>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      {children}
    </section>
  )
}
