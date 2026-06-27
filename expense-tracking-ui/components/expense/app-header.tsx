"use client"

import { useState } from "react"
import { Bell, Users, X, CheckCheck, ChevronDown } from "lucide-react"
import { MemberAvatar } from "./member-avatar"
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
  member: Member
  notifications: AppNotification[]
  onSwitchMember?: () => void
  onSwitchGroup?: () => void
  onMarkAllRead?: () => void
  onOpenSettings?: () => void
}

export function AppHeader({ group, member, notifications, onSwitchMember, onSwitchGroup, onMarkAllRead, onOpenSettings }: Props) {
  const [showPanel, setShowPanel] = useState(false)
  const unread = notifications.filter((n) => !n.read).length

  return (
    <>
      <header className="px-5 pt-6 pb-2">
        {/* group chip + actions */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onSwitchGroup}
            className="flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm ring-1 ring-border transition active:scale-95"
          >
            <Users className="size-3.5 text-accent" />
            <span className="max-w-[10rem] truncate">{group.name}</span>
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </button>

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
            <button
              type="button"
              onClick={onSwitchMember}
              aria-label="สลับสมาชิก"
              className="grid size-10 place-items-center rounded-full bg-card text-foreground shadow-sm ring-1 ring-border transition active:scale-95"
            >
              <ChevronDown className="size-[18px]" />
            </button>
          </div>
        </div>

        {/* greeting + current member */}
        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="ตั้งค่าโปรไฟล์"
          className="mt-3 flex items-center gap-3 transition active:scale-[0.99]"
        >
          <MemberAvatar member={member} size={44} className="shadow-sm ring-1 ring-border" />
          <div className="text-left leading-tight">
            <p className="text-xs text-muted-foreground">{greeting()}</p>
            <p className="text-base font-semibold text-foreground">{member.name}</p>
          </div>
        </button>
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
