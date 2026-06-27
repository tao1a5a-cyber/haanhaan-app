"use client"

import { useMemo, useState } from "react"
import Image from "next/image"
import { ChevronLeft, Plus, Users, ArrowRight, X, UserPlus } from "lucide-react"
import { MemberAvatar } from "./member-avatar"
import { GroupAvatar } from "./group-avatar"
import { CreatedByFooter } from "@/components/created-by-footer"
import { useThemeMode } from "@/lib/theme"
import type { Group, Member } from "./types"

const LIGHT_BG =
  "linear-gradient(168deg, oklch(0.98 0.012 85) 0%, oklch(0.96 0.03 60) 45%, oklch(0.95 0.04 30) 100%)"
const DARK_BG =
  "linear-gradient(168deg, oklch(0.2 0 0) 0%, oklch(0.17 0 0) 55%, oklch(0.15 0 0) 100%)"

type Props = {
  groups: Group[]
  /** when set, open straight to the member picker for this group */
  initialGroupId?: string | null
  onEnter: (group: Group, member: Member) => void
  onCreateGroup: (name: string) => Promise<Group | null>
  onAddMember: (groupId: string, draft: { name: string }) => Promise<Member | null>
}

export function EntryScreen({ groups, initialGroupId, onEnter, onCreateGroup, onAddMember }: Props) {
  const [themeMode] = useThemeMode()
  const [step, setStep] = useState<"group" | "member">(initialGroupId ? "member" : "group")
  const [selectedId, setSelectedId] = useState<string | null>(initialGroupId ?? null)
  const [leaving, setLeaving] = useState<string | null>(null)

  const [creatingGroup, setCreatingGroup] = useState(false)
  const [addingMember, setAddingMember] = useState(false)
  const [draftName, setDraftName] = useState("")
  const [busy, setBusy] = useState(false)

  // Always read the live group from props so newly-added members show up.
  const selected = useMemo(
    () => groups.find((g) => g.id === selectedId) ?? null,
    [groups, selectedId],
  )

  function openGroup(g: Group) {
    setSelectedId(g.id)
    setStep("member")
  }

  function pickMember(m: Member) {
    if (!selected) return
    setLeaving(m.id)
    setTimeout(() => onEnter(selected, m), 280)
  }

  async function submitGroup() {
    const name = draftName.trim()
    if (!name || busy) return
    setBusy(true)
    const g = await onCreateGroup(name)
    setBusy(false)
    setDraftName("")
    setCreatingGroup(false)
    if (g) { setSelectedId(g.id); setStep("member") }
  }

  async function submitMember() {
    const name = draftName.trim()
    if (!name || !selected || busy) return
    setBusy(true)
    await onAddMember(selected.id, { name })
    setBusy(false)
    setDraftName("")
    setAddingMember(false)
  }

  return (
    <main
      className="relative mx-auto flex min-h-screen w-full max-w-md flex-col overflow-hidden"
      style={{ background: themeMode === "dark" ? DARK_BG : LIGHT_BG }}
    >
      {/* soft brand blobs */}
      <div
        className="pointer-events-none absolute -left-24 -top-20 size-72 rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(circle, oklch(0.82 0.09 240), transparent 70%)" }}
      />
      <div
        className="pointer-events-none absolute -right-20 top-24 size-72 rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(circle, oklch(0.84 0.11 25), transparent 70%)" }}
      />

      {/* ── Brand zone ── */}
      <div className="relative flex flex-col items-center px-6 pt-14 pb-6">
        <div className="overflow-hidden rounded-[1.75rem] bg-white/70 p-2 shadow-[0_18px_44px_-16px_oklch(0.45_0.08_40/0.5)] ring-1 ring-white/60 backdrop-blur-sm">
          <Image src="/logo.png" alt="HaanHaan" width={104} height={104} className="size-[104px] rounded-[1.3rem] object-cover" priority />
        </div>
        <p className="mt-4 text-center text-sm font-medium text-foreground/55">
          หารค่าใช้จ่าย หารความสบายใจ
        </p>
      </div>

      {/* ── Sheet ── */}
      <div className="relative mt-2 flex flex-1 flex-col rounded-t-[2.5rem] bg-card/85 px-6 pb-8 pt-7 shadow-[0_-16px_44px_-20px_oklch(0.45_0.08_40/0.45)] ring-1 ring-white/50 backdrop-blur-md">
        <div className="flex-1">
        {step === "group" ? (
          <>
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-foreground">เลือกกลุ่ม</h1>
                <p className="text-xs text-muted-foreground">เลือกกลุ่มที่จะจัดการค่าใช้จ่าย</p>
              </div>
              <span className="grid size-10 place-items-center rounded-2xl bg-accent/12 text-accent">
                <Users className="size-5" />
              </span>
            </div>

            {groups.length === 0 && (
              <div className="mb-4 rounded-2xl border border-dashed border-border bg-secondary/40 px-4 py-6 text-center">
                <p className="text-sm font-medium text-foreground">ยังไม่มีกลุ่ม</p>
                <p className="mt-0.5 text-xs text-muted-foreground">สร้างกลุ่มแรกเพื่อเริ่มหารกัน</p>
              </div>
            )}

            <ul className="space-y-3">
              {groups.map((g) => (
                <li key={g.id}>
                  <button
                    type="button"
                    onClick={() => openGroup(g)}
                    className="group flex w-full items-center gap-3 rounded-[1.4rem] bg-card p-3.5 text-left shadow-sm ring-1 ring-border transition active:scale-[0.99] hover:ring-accent/40"
                  >
                    <GroupAvatar group={g} size={48} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-semibold text-foreground">{g.name}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <AvatarStack members={g.members} />
                        <span className="text-xs text-muted-foreground">{g.members.length} คน</span>
                      </div>
                    </div>
                    <ArrowRight className="size-5 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-accent" />
                  </button>
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={() => { setDraftName(""); setCreatingGroup(true) }}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-[1.4rem] border border-dashed border-accent/40 bg-accent/8 py-3.5 text-sm font-semibold text-accent transition active:scale-[0.99]"
            >
              <Plus className="size-4" />
              สร้างกลุ่มใหม่
            </button>
          </>
        ) : (
          <>
            <div className="mb-5 flex items-center gap-2">
              <button
                type="button"
                onClick={() => { setStep("group"); setSelectedId(null) }}
                aria-label="ย้อนกลับ"
                className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary text-muted-foreground transition active:scale-90"
              >
                <ChevronLeft className="size-5" />
              </button>
              <div className="min-w-0">
                <h1 className="truncate text-xl font-bold text-foreground">คุณคือใคร</h1>
                <p className="truncate text-xs text-muted-foreground">{selected?.name}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {(selected?.members ?? []).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => pickMember(m)}
                  className="flex flex-col items-center gap-2.5 rounded-[1.4rem] bg-card p-4 shadow-sm ring-1 ring-border transition active:scale-[0.97] hover:ring-accent/40"
                  style={{
                    transform: leaving === m.id ? "scale(1.04)" : undefined,
                    opacity: leaving && leaving !== m.id ? 0.4 : 1,
                    transition: "transform 220ms ease, opacity 220ms ease",
                  }}
                >
                  <MemberAvatar member={m} size={72} className="shadow-sm ring-1 ring-border" />
                  <span className="line-clamp-1 text-sm font-bold text-foreground">{m.name}</span>
                </button>
              ))}

              <button
                type="button"
                onClick={() => { setDraftName(""); setAddingMember(true) }}
                className="flex flex-col items-center justify-center gap-2.5 rounded-[1.4rem] border border-dashed border-accent/40 bg-accent/8 p-4 text-accent transition active:scale-[0.97]"
              >
                <span className="grid size-[72px] place-items-center rounded-full bg-accent/12">
                  <UserPlus className="size-7" />
                </span>
                <span className="text-sm font-semibold">เพิ่มสมาชิก</span>
              </button>
            </div>
          </>
        )}
        </div>

        <CreatedByFooter className="mt-8 pt-2" />
      </div>

      {/* ── Create-group / add-member sheet ── */}
      {(creatingGroup || addingMember) && (
        <NameSheet
          title={creatingGroup ? "สร้างกลุ่มใหม่" : "เพิ่มสมาชิก"}
          placeholder={creatingGroup ? "ชื่อกลุ่ม เช่น ทริปเชียงใหม่" : "ชื่อสมาชิก"}
          value={draftName}
          busy={busy}
          onChange={setDraftName}
          onClose={() => { setCreatingGroup(false); setAddingMember(false) }}
          onSubmit={creatingGroup ? submitGroup : submitMember}
        />
      )}
    </main>
  )
}

function AvatarStack({ members }: { members: Member[] }) {
  if (members.length === 0) {
    return <span className="text-xs text-muted-foreground/70">ยังไม่มีสมาชิก</span>
  }
  return (
    <div className="flex -space-x-2">
      {members.slice(0, 4).map((m) => (
        <MemberAvatar key={m.id} member={m} size={22} className="ring-2 ring-card" />
      ))}
      {members.length > 4 && (
        <span className="grid size-[22px] place-items-center rounded-full bg-secondary text-[10px] font-bold text-muted-foreground ring-2 ring-card">
          +{members.length - 4}
        </span>
      )}
    </div>
  )
}

function NameSheet({
  title, placeholder, value, busy, onChange, onClose, onSubmit,
}: {
  title: string
  placeholder: string
  value: string
  busy: boolean
  onChange: (v: string) => void
  onClose: () => void
  onSubmit: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button type="button" aria-label="ปิด" onClick={onClose} className="absolute inset-0 bg-foreground/30 backdrop-blur-sm" />
      <div className="relative w-full max-w-md animate-in slide-in-from-bottom-4 fade-in duration-300 rounded-t-[2rem] bg-card p-5 pb-8 shadow-2xl ring-1 ring-border sm:rounded-[2rem]">
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-border sm:hidden" />
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <button type="button" onClick={onClose} aria-label="ปิด" className="grid size-8 place-items-center rounded-full bg-secondary text-muted-foreground transition active:scale-90">
            <X className="size-4" />
          </button>
        </div>
        <input
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") onSubmit() }}
          placeholder={placeholder}
          className="mt-4 w-full rounded-2xl bg-secondary px-4 py-3.5 text-sm text-foreground outline-none ring-1 ring-transparent transition placeholder:text-muted-foreground focus:bg-card focus:ring-ring"
        />
        <button
          type="button"
          onClick={onSubmit}
          disabled={!value.trim() || busy}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground shadow-sm transition active:scale-[0.99] disabled:opacity-40"
        >
          {busy ? "กำลังบันทึก..." : "บันทึก"}
        </button>
      </div>
    </div>
  )
}
