"use client"

import { Home, PieChart, Clock, Settings } from "lucide-react"

const leftTabs = [
  { id: "home", label: "หน้าหลัก", icon: Home },
  { id: "summary", label: "สรุป", icon: PieChart },
]
const rightTabs = [
  { id: "history", label: "ประวัติ", icon: Clock },
  { id: "settings", label: "ตั้งค่า", icon: Settings },
]

export function BottomNav({
  active,
  onChange,
  onAdd,
}: {
  active: string
  onChange: (id: string) => void
  /** open the quick-add bottom sheet */
  onAdd: () => void
}) {
  function Tab({ id, label, icon: Icon }: { id: string; label: string; icon: typeof Home }) {
    const isActive = active === id
    return (
      <button
        key={id}
        type="button"
        onClick={() => onChange(id)}
        className="flex flex-1 flex-col items-center gap-1 py-1"
      >
        <span
          className={`grid h-9 w-16 place-items-center rounded-full transition-colors ${
            isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground"
          }`}
        >
          <Icon className="size-[18px]" />
        </span>
        <span
          className={`text-[11px] font-medium transition-colors ${
            isActive ? "text-foreground" : "text-muted-foreground"
          }`}
        >
          {label}
        </span>
      </button>
    )
  }

  return (
    <nav className="sticky bottom-0 z-20 border-t border-border bg-card/85 px-6 pb-6 pt-2.5 backdrop-blur-md">
      <div className="relative flex items-center">
        <div className="flex flex-1 items-center justify-around">
          {leftTabs.map((t) => (
            <Tab key={t.id} {...t} />
          ))}
        </div>

        {/* central FAB slot */}
        <div className="w-20 shrink-0" />

        <div className="flex flex-1 items-center justify-around">
          {rightTabs.map((t) => (
            <Tab key={t.id} {...t} />
          ))}
        </div>

        {/* Prominent floating "+" — always accessible without scrolling */}
        <button
          type="button"
          onClick={onAdd}
          aria-label="เพิ่มรายการ"
          className="absolute -top-9 left-1/2 grid size-16 -translate-x-1/2 place-items-center overflow-hidden rounded-full bg-accent text-accent-foreground shadow-[0_10px_24px_-6px_oklch(0.3_0.04_55/0.6)] ring-4 ring-card transition active:scale-95"
        >
          <img src="/goose.png" alt="" className="size-[4.2rem] object-contain" />
        </button>
      </div>
    </nav>
  )
}
