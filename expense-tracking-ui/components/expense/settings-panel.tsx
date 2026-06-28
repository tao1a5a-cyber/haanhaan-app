"use client"

import { useRef, useState } from "react"
import { X, Eye, EyeOff, Camera, Loader2, UserCog, Users, Palette, Lock, Trash2, UserPlus, Check, ImagePlus, KeyRound, Copy, Sun, Moon, ChevronDown, Mail } from "lucide-react"
import { useThemeMode } from "@/lib/theme"
import { isCustomAvatar } from "./users"
import { MemberAvatar } from "./member-avatar"
import { GroupAvatar } from "./group-avatar"
import { AvatarWheel } from "./avatar-wheel"
import { avatarLabel } from "./avatars"
import { THEMES } from "./themes"
import { cropToCircle, uploadAvatar } from "@/lib/storage"
import { hashPin } from "@/lib/pin"
import { isSupabaseConfigured } from "@/lib/supabase"
import type { Group, Member } from "./types"

type Props = {
  group: Group
  member: Member
  onSave: (updated: Partial<Member>, pinHash?: string | null) => void
  onAddMember: (name: string) => void
  onRemoveMember: (id: string) => void
  onRenameGroup: (name: string) => void
  /** persist the group's avatar URL ("" to remove) */
  onSaveGroupAvatar: (avatarUrl: string) => void
  /** signed-in account email + id, for the identity-mapping section */
  authEmail?: string | null
  authUserId?: string | null
  /** bind the signed-in email to a member ("this member is me") */
  onClaimMember?: (memberId: string) => void
  /** mint/reveal the group's shareable Room Code; returns the code or null */
  onGenerateRoomCode?: () => Promise<string | null>
  /** whether the Room Code feature is available (signed-in, non-guest) */
  roomCodeEnabled?: boolean
  /** delete the whole group (host only) */
  onDeleteGroup?: () => void
  /** whether the current user may delete the group (host / guest-mode owner) */
  canDeleteGroup?: boolean
  /** when true, render inline as a tab page instead of a floating modal */
  embedded?: boolean
  onClose?: () => void
}

export function SettingsPanel({ group, member, onSave, onAddMember, onRemoveMember, onRenameGroup, onSaveGroupAvatar, authEmail, authUserId, onClaimMember, onGenerateRoomCode, roomCodeEnabled, onDeleteGroup, canDeleteGroup = false, embedded, onClose }: Props) {
  const [name, setName] = useState(member.name)
  const [avatar, setAvatar] = useState(member.avatar)
  const [avatarBlob, setAvatarBlob] = useState<Blob | null>(null)
  const [themeId, setThemeId] = useState(member.themeId ?? "amber")
  const [showThemes, setShowThemes] = useState(false)
  const [showAvatarWheel, setShowAvatarWheel] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  // ── Group avatar ──
  const [groupAvatar, setGroupAvatar] = useState(group.avatar ?? "")
  const [groupAvatarBlob, setGroupAvatarBlob] = useState<Blob | null>(null)
  const [groupAvatarRemoved, setGroupAvatarRemoved] = useState(false)
  const groupAvatarInputRef = useRef<HTMLInputElement>(null)

  const [section, setSection] = useState<"main" | "pin">("main")
  const [pin, setPin] = useState("")
  const [confirmPin, setConfirmPin] = useState("")
  const [showPin, setShowPin] = useState(false)
  const [pinError, setPinError] = useState("")
  const [savingPin, setSavingPin] = useState(false)

  const [groupName, setGroupName] = useState(group.name)
  const [newMember, setNewMember] = useState("")

  // Delete-group confirmation (type the group name to confirm).
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState("")

  const [themeMode, toggleTheme] = useThemeMode()

  // ── Room Code (shareable, cloud-only) ──
  const [roomCode, setRoomCode] = useState(group.roomCode ?? "")
  const [roomBusy, setRoomBusy] = useState(false)
  const [roomCopied, setRoomCopied] = useState(false)

  async function handleGenerateRoomCode() {
    if (!onGenerateRoomCode) return
    setRoomBusy(true)
    try {
      const code = await onGenerateRoomCode()
      if (code) setRoomCode(code)
    } finally {
      setRoomBusy(false)
    }
  }

  async function handleCopyRoomCode() {
    if (!roomCode) return
    try {
      await navigator.clipboard.writeText(roomCode)
      setRoomCopied(true)
      setTimeout(() => setRoomCopied(false), 1500)
    } catch {
      /* clipboard blocked — ignore */
    }
  }

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

  async function handleGroupAvatarFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setGroupAvatarRemoved(false)
    try {
      const blob = await cropToCircle(file)
      setGroupAvatarBlob(blob)
      setGroupAvatar(URL.createObjectURL(blob))
    } catch {
      const reader = new FileReader()
      reader.onload = (ev) => { if (typeof ev.target?.result === "string") setGroupAvatar(ev.target.result) }
      reader.readAsDataURL(file)
    }
    e.target.value = ""
  }

  function handleRemoveGroupAvatar() {
    setGroupAvatar("")
    setGroupAvatarBlob(null)
    setGroupAvatarRemoved(true)
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
      } else if (avatar !== (member.avatar ?? "")) {
        // Bundled avatar picked from the wheel (no file upload).
        updated.avatar = avatar
      }
      if (themeId !== (member.themeId ?? "amber")) {
        updated.themeId = themeId
        updated.tint = activeTheme.tint
      }
      if (groupName.trim() && groupName.trim() !== group.name) onRenameGroup(groupName.trim())

      // Group avatar add / edit / remove
      if (groupAvatarBlob) {
        if (isSupabaseConfigured) {
          const url = await uploadAvatar(group.id, groupAvatarBlob)
          if (url) onSaveGroupAvatar(url)
        } else {
          onSaveGroupAvatar(groupAvatar)
        }
      } else if (groupAvatarRemoved && (group.avatar ?? "") !== "") {
        onSaveGroupAvatar("")
      }

      if (Object.keys(updated).length > 0) onSave(updated)
    } finally {
      setUploading(false)
      onClose?.()
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

  function handleRemovePin() {
    if (!confirm("ต้องการลบรหัสผ่านของโปรไฟล์นี้ใช่ไหม? หลังจากนี้จะเข้าโปรไฟล์ได้โดยไม่ต้องใส่รหัส")) return
    onSave({}, null)  // null clears pin_hash + pin_salt
    setSection("main"); setPin(""); setConfirmPin(""); setPinError("")
  }

  function handleAddMember() {
    const n = newMember.trim()
    if (!n) return
    onAddMember(n)
    setNewMember("")
  }

  const customAvatar = isCustomAvatar(avatar)
  const activeTheme = THEMES.find((t) => t.id === themeId) ?? THEMES[0]

  // Header is hidden for the embedded main section (the tab page provides the title);
  // it stays for the PIN sub-section (back button) and for the modal variant.
  const header = (section === "pin" || !embedded) ? (
    <div className={`relative flex items-center justify-between px-5 ${embedded ? "pb-3 pt-1" : "border-b border-border/60 pb-3 pt-4"}`}>
      {section === "pin" ? (
        <button type="button" onClick={() => { setSection("main"); setPinError(""); setPin(""); setConfirmPin("") }} className="text-sm font-medium text-accent">← กลับ</button>
      ) : (
        <h2 className="text-base font-semibold text-foreground">ตั้งค่า</h2>
      )}
      {section === "pin" ? (
        <h2 className="absolute left-1/2 -translate-x-1/2 text-base font-semibold text-foreground">ตั้งรหัสผ่าน</h2>
      ) : !embedded ? (
        <button type="button" onClick={onClose} aria-label="ปิด" className="grid size-8 place-items-center rounded-full bg-secondary text-muted-foreground transition active:scale-90">
          <X className="size-4" />
        </button>
      ) : null}
    </div>
  ) : null

  const content = (
    <>
      {header}
      <div className={embedded ? "space-y-4 px-5 pb-10 pt-1" : "max-h-[74vh] space-y-4 overflow-y-auto px-5 py-5 pb-8"}>
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
                        <img src={avatar} alt="" className={customAvatar ? "absolute inset-0 size-full object-cover" : "size-[98%] object-contain"} />
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
                      className="w-full rounded-xl bg-secondary px-3 py-2.5 text-sm font-medium text-foreground shadow-[inset_0_1px_2px_rgba(0,0,0,0.22)] outline-none ring-1 ring-transparent transition placeholder:text-muted-foreground focus:ring-accent"
                    />
                    <button type="button" onClick={() => avatarInputRef.current?.click()} className="mt-1 text-xs text-accent underline underline-offset-2">
                      เปลี่ยนรูป (ครอปวงกลมอัตโนมัติ)
                    </button>
                  </div>
                  <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarFile} />
                </div>

                {/* Profile avatar wheel — tap to slide-pick a goose */}
                <button
                  type="button"
                  onClick={() => setShowAvatarWheel(true)}
                  className="mt-3 flex w-full items-center justify-between rounded-xl bg-secondary px-4 py-3 text-sm font-medium text-foreground transition active:scale-[0.98]"
                >
                  <span className="flex items-center gap-2">
                    <UserCog className="size-4 text-accent" /> โปรไฟล์
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{avatarLabel(avatar) ?? "เลือกห่าน"}</span>
                    <span className="text-xs text-muted-foreground">→</span>
                  </span>
                </button>

                {/* Theme — collapsed by default; tap to reveal the colors */}
                <button
                  type="button"
                  onClick={() => setShowThemes((v) => !v)}
                  aria-expanded={showThemes}
                  className="mt-4 flex w-full items-center justify-between rounded-xl bg-secondary px-4 py-3 text-sm font-medium text-foreground transition active:scale-[0.98]"
                >
                  <span className="flex items-center gap-2">
                    <Palette className="size-4 text-accent" /> สีธีม
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="size-4 shrink-0 rounded-full border border-border shadow-sm" style={{ backgroundColor: activeTheme.swatch }} />
                    <span className="text-xs text-muted-foreground">{activeTheme.label}</span>
                    <ChevronDown className={`size-4 text-muted-foreground transition ${showThemes ? "rotate-180" : ""}`} />
                  </span>
                </button>
                {showThemes && (
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {THEMES.map((theme) => (
                      <button
                        key={theme.id}
                        type="button"
                        onClick={() => { setThemeId(theme.id); onSave({ themeId: theme.id, tint: theme.tint }) }}
                        aria-label={theme.label}
                        className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-medium transition active:scale-95 ${themeId === theme.id ? "shadow-sm" : "bg-secondary text-muted-foreground"}`}
                        style={themeId === theme.id ? { backgroundColor: theme.vars.accent, color: "white" } : undefined}
                      >
                        <span className="size-3.5 shrink-0 rounded-full border border-white/30 shadow-sm" style={{ backgroundColor: theme.swatch }} />
                        {theme.label}
                      </button>
                    ))}
                  </div>
                )}

                {/* PIN */}
                <button type="button" onClick={() => setSection("pin")} className="mt-4 flex w-full items-center justify-between rounded-xl bg-secondary px-4 py-3 text-sm font-medium text-foreground transition active:scale-[0.98]">
                  <span className="flex items-center gap-2"><Lock className="size-4 text-accent" /> ตั้ง / เปลี่ยนรหัสผ่าน</span>
                  <span className="text-xs text-muted-foreground">→</span>
                </button>
              </SectionCard>

              {/* ── Appearance / dark mode ── */}
              <SectionCard icon={themeMode === "dark" ? <Moon className="size-4" /> : <Sun className="size-4" />} title="ธีมการแสดงผล" accent={activeTheme.vars.accent}>
                <button
                  type="button"
                  onClick={toggleTheme}
                  role="switch"
                  aria-checked={themeMode === "dark"}
                  className="flex w-full items-center justify-between rounded-xl bg-secondary px-4 py-3 text-sm font-medium text-foreground transition active:scale-[0.98]"
                >
                  <span className="flex items-center gap-2">
                    {themeMode === "dark" ? <Moon className="size-4 text-accent" /> : <Sun className="size-4 text-accent" />}
                    โหมดมืด
                  </span>
                  {/* Premium toggle: dark slate track + muted-gold thumb when on */}
                  <span
                    className={`relative h-7 w-12 shrink-0 rounded-full ring-1 transition-colors ${
                      themeMode === "dark"
                        ? "bg-secondary ring-accent/40 shadow-[inset_0_1px_3px_rgba(0,0,0,0.4)]"
                        : "bg-border ring-transparent"
                    }`}
                  >
                    <span
                      className={`absolute top-1 size-5 rounded-full shadow-md transition-all ${
                        themeMode === "dark" ? "left-6 bg-accent" : "left-1 bg-card"
                      }`}
                    />
                  </span>
                </button>
              </SectionCard>

              {/* ── Group section ── */}
              <SectionCard icon={<Users className="size-4" />} title="กลุ่ม" accent={activeTheme.vars.accent}>
                {/* Group image: add / edit / remove */}
                <div className="mb-4 flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => groupAvatarInputRef.current?.click()}
                    className="group relative shrink-0"
                    aria-label="เปลี่ยนรูปกลุ่ม"
                  >
                    <GroupAvatar group={{ name: groupName || group.name, avatar: groupAvatar }} size={64} className="shadow-sm ring-2 ring-border" />
                    <span className="absolute inset-0 flex items-center justify-center rounded-full bg-foreground/0 transition group-hover:bg-foreground/25">
                      <Camera className="size-5 text-white opacity-0 drop-shadow transition group-hover:opacity-100" />
                    </span>
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">รูปกลุ่ม</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <button
                        type="button"
                        onClick={() => groupAvatarInputRef.current?.click()}
                        className="flex items-center gap-1 text-xs font-medium text-accent underline underline-offset-2"
                      >
                        <ImagePlus className="size-3.5" />
                        {groupAvatar ? "เปลี่ยนรูป" : "เพิ่มรูป"}
                      </button>
                      {groupAvatar && (
                        <button
                          type="button"
                          onClick={handleRemoveGroupAvatar}
                          className="flex items-center gap-1 text-xs font-medium text-destructive underline underline-offset-2"
                        >
                          <Trash2 className="size-3.5" />
                          ลบรูป
                        </button>
                      )}
                    </div>
                  </div>
                  <input ref={groupAvatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleGroupAvatarFile} />
                </div>

                <label className="text-xs font-semibold text-muted-foreground">ชื่อกลุ่ม</label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  maxLength={30}
                  className="mt-1.5 w-full rounded-xl bg-secondary px-3 py-2.5 text-sm font-medium text-foreground shadow-[inset_0_1px_2px_rgba(0,0,0,0.22)] outline-none ring-1 ring-transparent transition focus:ring-accent"
                />

                <p className="mb-2 mt-4 text-xs font-semibold text-muted-foreground">สมาชิก ({group.members.length})</p>
                {authEmail && (
                  <p className="mb-2 text-[11px] leading-relaxed text-muted-foreground">
                    ผูกอีเมลของคุณ (<span className="font-medium text-foreground">{authEmail}</span>) กับสมาชิก
                    เพื่อให้ครั้งหน้าเข้าโปรไฟล์นี้อัตโนมัติ
                  </p>
                )}
                <ul className="space-y-2">
                  {group.members.map((m) => {
                    const mine = !!authUserId && m.userId === authUserId
                    const claimedByOther = !!m.userId && !mine
                    return (
                    <li key={m.id} className="flex items-center gap-3 rounded-xl bg-secondary px-3 py-2">
                      <MemberAvatar member={m} size={32} />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                        {m.name}{m.id === member.id ? " (คุณ)" : ""}
                        {mine && <span className="ml-1.5 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium text-accent">บัญชีของคุณ</span>}
                        {claimedByOther && <span className="ml-1.5 rounded-full bg-card px-2 py-0.5 text-[10px] font-medium text-muted-foreground ring-1 ring-border">ผูกอีเมลแล้ว</span>}
                      </span>
                      {authUserId && !mine && !claimedByOther && onClaimMember && (
                        <button
                          type="button"
                          onClick={() => onClaimMember(m.id)}
                          className="flex shrink-0 items-center gap-1 rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground transition active:scale-95"
                        >
                          <Mail className="size-3" />
                          ผูกอีเมล
                        </button>
                      )}
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
                    )
                  })}
                </ul>

                <div className="mt-3 flex items-center gap-2">
                    <div className="flex flex-1 items-center gap-2 rounded-xl bg-secondary px-3 py-2 shadow-[inset_0_1px_2px_rgba(0,0,0,0.22)] ring-1 ring-transparent focus-within:ring-accent">
                      <UserPlus className="size-4 text-accent" />
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

                {/* Danger zone — delete the whole group (host only) */}
                {canDeleteGroup && (
                  <div className="mt-5 border-t border-border pt-4">
                    {!confirmingDelete ? (
                      <button
                        type="button"
                        onClick={() => { setConfirmingDelete(true); setDeleteConfirm("") }}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-destructive/10 py-3 text-sm font-semibold text-destructive transition active:scale-[0.98]"
                      >
                        <Trash2 className="size-4" />
                        ลบกลุ่มนี้
                      </button>
                    ) : (
                      <div className="rounded-xl bg-destructive/8 p-3 ring-1 ring-destructive/30">
                        <p className="text-xs leading-relaxed text-foreground">
                          การลบจะลบ <span className="font-semibold">กลุ่ม สมาชิก และรายการทั้งหมด</span> อย่างถาวร กู้คืนไม่ได้
                        </p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          พิมพ์ชื่อกลุ่ม “<span className="font-semibold text-foreground">{group.name}</span>” เพื่อยืนยัน
                        </p>
                        <input
                          value={deleteConfirm}
                          onChange={(e) => setDeleteConfirm(e.target.value)}
                          placeholder={group.name}
                          className="mt-2 w-full rounded-lg bg-secondary px-3 py-2 text-sm text-foreground shadow-[inset_0_1px_2px_rgba(0,0,0,0.22)] outline-none ring-1 ring-transparent transition placeholder:text-muted-foreground focus:ring-destructive"
                        />
                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            onClick={() => { setConfirmingDelete(false); setDeleteConfirm("") }}
                            className="flex-1 rounded-lg bg-secondary py-2.5 text-sm font-semibold text-foreground ring-1 ring-border transition active:scale-[0.98]"
                          >
                            ยกเลิก
                          </button>
                          <button
                            type="button"
                            disabled={deleteConfirm.trim() !== group.name}
                            onClick={() => onDeleteGroup?.()}
                            className="flex-1 rounded-lg bg-destructive py-2.5 text-sm font-semibold text-destructive-foreground transition active:scale-[0.98] disabled:opacity-40"
                          >
                            ลบถาวร
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </SectionCard>

              {/* ── Room Code section (share this group with guests) ── */}
              {roomCodeEnabled && (
                <SectionCard icon={<KeyRound className="size-4" />} title="รหัสห้อง (Room Code)" accent={activeTheme.vars.accent}>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    แชร์รหัสนี้ให้เพื่อน เพื่อให้เข้าถึงห้องนี้ได้จากหน้าเข้าสู่ระบบ
                    โดยไม่ต้องสมัครบัญชี
                  </p>
                  {roomCode ? (
                    <div className="mt-3 flex items-center gap-2">
                      <div className="flex-1 rounded-xl bg-secondary px-4 py-3 text-center text-lg font-bold tracking-[0.3em] text-foreground">
                        {roomCode}
                      </div>
                      <button
                        type="button"
                        onClick={handleCopyRoomCode}
                        aria-label="คัดลอกรหัสห้อง"
                        className="grid size-12 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground shadow-sm transition active:scale-95"
                      >
                        {roomCopied ? <Check className="size-4" /> : <Copy className="size-4" />}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleGenerateRoomCode}
                      disabled={roomBusy}
                      className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3 text-sm font-semibold text-accent-foreground shadow-sm transition active:scale-[0.98] disabled:opacity-60"
                    >
                      {roomBusy ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
                      สร้างรหัสห้อง
                    </button>
                  )}
                </SectionCard>
              )}

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
              <button
                type="button"
                onClick={handleRemovePin}
                disabled={savingPin}
                className="flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-medium text-destructive transition active:scale-[0.98] disabled:opacity-60"
              >
                <Trash2 className="size-4" />
                ลบรหัสผ่าน
              </button>
              <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
                ลบรหัสผ่านเพื่อให้เข้าโปรไฟล์นี้ได้โดยไม่ต้องใส่รหัส
              </p>
            </div>
          )}
      </div>

      {showAvatarWheel && (
        <AvatarWheel
          valueSrc={avatar}
          tint={activeTheme.tint}
          onConfirm={(src) => { setAvatar(src); setAvatarBlob(null); onSave({ avatar: src }) }}
          onClose={() => setShowAvatarWheel(false)}
        />
      )}
    </>
  )

  // Embedded (bottom-nav tab) — render inline, no overlay.
  if (embedded) return <div className="pt-1">{content}</div>

  // Modal variant (kept for completeness).
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button type="button" aria-label="ปิด" onClick={onClose} className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md animate-in slide-in-from-bottom-4 fade-in overflow-hidden rounded-t-[2rem] shadow-2xl ring-1 ring-border duration-300 sm:rounded-[2rem]"
        style={{ background: "linear-gradient(180deg, oklch(0.985 0.01 80), oklch(0.965 0.02 60))" }}
      >
        <div className="mx-auto mt-3 h-1.5 w-10 rounded-full bg-border sm:hidden" />
        {content}
      </div>
    </div>
  )
}

function SectionCard({ icon, title, accent, children }: { icon: React.ReactNode; title: string; accent: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-[1.4rem] bg-card p-4 shadow-sm ring-1 ring-border">
      <div className="mb-3 flex items-center gap-2">
        <span className="grid size-7 place-items-center rounded-lg text-white" style={{ backgroundColor: accent }}>{icon}</span>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      {children}
    </section>
  )
}
