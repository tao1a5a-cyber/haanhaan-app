"use client"

import { Home, PieChart, Clock } from "lucide-react"

const tabs = [
  { id: "home", label: "หน้าหลัก", icon: Home },
  { id: "summary", label: "สรุป", icon: PieChart },
  { id: "history", label: "ประวัติ", icon: Clock },
]

export function BottomNav({
  active,
  onChange,
}: {
  active: string
  onChange: (id: string) => void
}) {
  return (
    <nav className="sticky bottom-0 z-20 border-t border-border bg-card/85 px-6 pb-6 pt-2.5 backdrop-blur-md">
      <div className="flex items-center justify-between">
        {tabs.map((t) => {
          const Icon = t.icon
          const isActive = active === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onChange(t.id)}
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
                {t.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
