"use client"

import { useEffect, useRef, useState } from "react"
import { Bell, Users, X, CheckCheck, ChevronDown, Home, LogOut, Check, MoreVertical } from "lucide-react"
import { MemberAvatar } from "./member-avatar"
import { GroupAvatar } from "./group-avatar"
import type { Group, Member } from "./types"
import type { AppNotification } from "./notifications"

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return "สวัสดีตอนเช้า"
  if (h < 17) return "สวัสดีตอนเที่ยง"
  return "สวัสดีตอนเย็น"
}

function timeAgo(ts: number) {
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60000)
  if (m < 1) return "เมื่อสักครู่"
  if (m < 60) return `${m} นาทีที่แล้ว`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} ชม.ที่แล้ว`
  return `${Math.floor(h / 24)} วันที่แล้ว`
}

const typeIcon: Record<AppNotification["type"], string> = {
  add: "➕",
  edit: "✏️",
  delete: "🗑️",
}

type Props = {
  group: Group
  groups: Group[]
  member: Member
  notifications: AppNotification[]
  /** switch the active group (top-left dropdown) */
  onSelectGroup?: (group: Group) => void
  /** go back to the "who are you?" profile selection page */
  onBackToHome?: () => void
  /** sign out (clears cached session) */
  onLogout?: () => void
  onMarkAllRead?: () => void
}

/** Generic click-outside hook for the two dropdowns. */
function useClickOutside(onOutside: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside()
    }
    document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [onOutside])
  return ref
}

export function AppHeader({
  group,
  groups,
  member,
  notifications,
  onSelectGroup,
  onBackToHome,
  onLogout,
  onMarkAllRead,
}: Props) {
  const [showPanel, setShowPanel] = useState(false)
  const [showGroups, setShowGroups] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const unread = notifications.filter((n) => !n.read).length

  const groupRef = useClickOutside(() => setShowGroups(false))
  const userRef = useClickOutside(() => setShowUserMenu(false))

  return (
    <>
      <header className="px-5 pt-6 pb-2">
        {/* group selector (left) + actions (right) */}
        <div className="flex items-center justify-between">
          {/* ── Group selector dropdown ── */}
          <div ref={groupRef} className="relative">
            <button
              type="button"
              onClick={() => setShowGroups((v) => !v)}
              aria-label="เลือกกลุ่ม"
              className="flex items-center gap-2 rounded-full bg-card py-1.5 pl-1.5 pr-3 text-xs font-semibold text-foreground shadow-sm ring-1 ring-border transition active:scale-95"
            >
              <GroupAvatar group={group} size={26} />
              <span className="max-w-[8.5rem] truncate">{group.name}</span>
              <ChevronDown className={`size-3.5 text-muted-foreground transition ${showGroups ? "rotate-180" : ""}`} />
            </button>

            {showGroups && (
              <div className="absolute left-0 top-full z-50 mt-2 w-60 origin-top-left animate-in fade-in slide-in-from-top-1 rounded-2xl bg-card p-1.5 shadow-2xl ring-1 ring-border duration-150">
                <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  กลุ่มของคุณ
                </p>
                <ul className="max-h-72 overflow-y-auto">
                  {groups.map((g) => {
                    const active = g.id === group.id
                    return (
                      <li key={g.id}>
                        <button
                          type="button"
                          onClick={() => { setShowGroups(false); if (!active) onSelectGroup?.(g) }}
                          className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition active:scale-[0.98] ${
                            active ? "bg-accent/12" : "hover:bg-secondary"
                          }`}
                        >
                          <GroupAvatar group={g} size={34} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-foreground">{g.name}</p>
                            <p className="text-xs text-muted-foreground">{g.members.length} คน</p>
                          </div>
                          {active && <Check className="size-4 shrink-0 text-accent" />}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
          </div>

          {/* ── Notifications + user options ── */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowPanel(true)}
              aria-label="การแจ้งเตือน"
              className="relative grid size-10 place-items-center rounded-full bg-card text-foreground shadow-sm ring-1 ring-border transition active:scale-95"
            >
              <Bell className="size-[18px]" />
              {unread > 0 && (
                <span className="absolute right-2 top-2 flex size-[9px] items-center justify-center rounded-full bg-accent ring-2 ring-card" />
              )}
            </button>

            <div ref={userRef} className="relative">
              <button
                type="button"
                onClick={() => setShowUserMenu((v) => !v)}
                aria-label="ตัวเลือกผู้ใช้"
                className="grid size-10 place-items-center rounded-full bg-card text-foreground shadow-sm ring-1 ring-border transition active:scale-95"
              >
                <MoreVertical className="size-[18px]" />
              </button>

              {showUserMenu && (
                <div className="absolute right-0 top-full z-50 mt-2 w-52 origin-top-right animate-in fade-in slide-in-from-top-1 rounded-2xl bg-card p-1.5 shadow-2xl ring-1 ring-border duration-150">
                  <div className="flex items-center gap-2.5 px-2.5 py-2">
                    <MemberAvatar member={member} size={34} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{member.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{group.name}</p>
                    </div>
                  </div>
                  <div className="my-1 h-px bg-border" />
                  <button
                    type="button"
                    onClick={() => { setShowUserMenu(false); onBackToHome?.() }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-left text-sm font-medium text-foreground transition hover:bg-secondary active:scale-[0.98]"
                  >
                    <Home className="size-4 text-muted-foreground" />
                    กลับหน้าแรก
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowUserMenu(false); onLogout?.() }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-left text-sm font-medium text-destructive transition hover:bg-destructive/10 active:scale-[0.98]"
                  >
                    <LogOut className="size-4" />
                    ออกจากระบบ
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* greeting + current member (display only — settings live in the bottom nav) */}
        <div className="mt-3 flex items-center gap-3">
          <MemberAvatar member={member} size={44} className="shadow-sm ring-1 ring-border" />
          <div className="text-left leading-tight">
            <p className="text-xs text-muted-foreground">{greeting()}</p>
            <p className="text-base font-semibold text-foreground">{member.name}</p>
          </div>
        </div>
      </header>

      {/* Notification panel */}
      {showPanel && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <button
            type="button"
            aria-label="ปิด"
            onClick={() => setShowPanel(false)}
            className="absolute inset-0 bg-foreground/30 backdrop-blur-sm"
          />
          <div className="relative w-full max-w-md animate-in slide-in-from-bottom-4 fade-in duration-300 rounded-t-[2rem] bg-card p-5 pb-8 shadow-2xl ring-1 ring-border sm:rounded-[2rem]">
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-border sm:hidden" />

            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">การแจ้งเตือน</h2>
              <div className="flex items-center gap-2">
                {unread > 0 && (
                  <button
                    type="button"
                    onClick={() => { onMarkAllRead?.(); }}
                    className="flex items-center gap-1 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium text-muted-foreground transition active:scale-95"
                  >
                    <CheckCheck className="size-3.5" />
                    อ่านทั้งหมด
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowPanel(false)}
                  aria-label="ปิด"
                  className="grid size-8 place-items-center rounded-full bg-secondary text-muted-foreground transition active:scale-90"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            <div className="mt-4 max-h-80 overflow-y-auto space-y-2">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8">
                  <span className="text-3xl">🔔</span>
                  <p className="text-sm text-muted-foreground">ยังไม่มีการแจ้งเตือน</p>
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`flex items-start gap-3 rounded-2xl p-3.5 transition ${
                      n.read ? "bg-secondary/50" : "bg-accent/10 ring-1 ring-accent/20"
                    }`}
                  >
                    <span className="mt-0.5 text-lg">{typeIcon[n.type]}</span>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm ${n.read ? "text-muted-foreground" : "font-medium text-foreground"}`}>
                        {n.message}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{timeAgo(n.ts)}</p>
                    </div>
                    {!n.read && (
                      <span className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" />
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
