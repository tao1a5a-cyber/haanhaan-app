"use client"

import { useEffect, useMemo, useState } from "react"
import { AppHeader } from "@/components/expense/app-header"
import { BalanceCard } from "@/components/expense/balance-card"
import { AddTransaction } from "@/components/expense/add-transaction"
import { RecentList } from "@/components/expense/recent-list"
import { SummaryView } from "@/components/expense/summary-view"
import { HistoryView } from "@/components/expense/history-view"
import { BottomNav } from "@/components/expense/bottom-nav"
import { ProfilePicker } from "@/components/expense/profile-picker"
import { SettlementModal } from "@/components/expense/settlement-modal"
import { SettingsPanel } from "@/components/expense/settings-panel"
import { PinEntry } from "@/components/expense/pin-entry"
import { USERS, partnerOf, type User } from "@/components/expense/users"
import { getTheme } from "@/components/expense/themes"
import {
  categories as baseCategories,
  makeCustomCategory,
  formatBaht,
  type Category,
  type Transaction,
} from "@/components/expense/categories"
import type { AppNotification } from "@/components/expense/notifications"
import { isSupabaseConfigured } from "@/lib/supabase"
import {
  fetchProfile,
  upsertProfile,
  fetchTransactions,
  insertTransaction,
  updateTransaction,
  deleteTransaction,
  settleAllTransactions,
  fetchCustomCategories,
  insertCustomCategory,
} from "@/lib/db"
import { uploadSlip } from "@/lib/storage"
import { verifyPin } from "@/lib/pin"

const tabTitles: Record<string, string> = {
  summary: "สรุปค่าใช้จ่าย",
  history: "ประวัติรายการ",
}

export default function Page() {
  const [user, setUser] = useState<User | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [customCategories, setCustomCategories] = useState<Category[]>([])
  const [tab, setTab] = useState("home")
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [showSettlement, setShowSettlement] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [loading, setLoading] = useState(true)

  // per-user hashed PINs + display overrides (populated from Supabase on mount)
  const [userPinHashes, setUserPinHashes] = useState<Record<string, string>>({})
  const [userOverrides, setUserOverrides] = useState<Record<string, Partial<User>>>({})
  const [pendingUser, setPendingUser] = useState<User | null>(null)

  // ── Bootstrap: load all data from Supabase ──────────────
  useEffect(() => {
    async function boot() {
      if (isSupabaseConfigured) {
        const [profileResults, txs, cats] = await Promise.all([
          Promise.all(USERS.map((u) => fetchProfile(u.id))),
          fetchTransactions(),
          fetchCustomCategories(),
        ])

        const overrides: Record<string, Partial<User>> = {}
        const hashes: Record<string, string> = {}
        profileResults.forEach((p, i) => {
          if (!p) return
          const uid = USERS[i].id
          const { pinHash, ...rest } = p
          if (Object.keys(rest).length > 0) overrides[uid] = rest
          if (pinHash) hashes[uid] = pinHash
        })
        setUserOverrides(overrides)
        setUserPinHashes(hashes)
        setTransactions(txs)
        setCustomCategories(cats)
      }
      setLoading(false)
    }
    boot()
  }, [])

  const allCategories = useMemo(
    () => [...baseCategories, ...customCategories],
    [customCategories],
  )

  const net = useMemo(
    () => transactions.reduce((sum, t) => sum + t.owed, 0),
    [transactions],
  )

  function addNotification(n: Omit<AppNotification, "id" | "ts" | "read">) {
    setNotifications((prev) => [
      { ...n, id: crypto.randomUUID(), ts: Date.now(), read: false },
      ...prev,
    ])
  }

  // ── Transaction handlers ─────────────────────────────────

  async function handleAdd(
    tx: Omit<Transaction, "id" | "createdAt" | "owed" | "payerId">,
    slipFile?: File,
  ) {
    const partner = partnerOf(user!.id)
    const owed =
      tx.split === "split"
        ? tx.amount / 2
        : tx.split === "request"
        ? tx.amount
        : tx.customAmounts
        ? (tx.customAmounts[partner.id] ?? 0)
        : 0

    const newTx: Transaction = {
      ...tx,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      payerId: user!.id,
      owed,
    }

    // Upload slip to Supabase Storage if provided
    if (slipFile && isSupabaseConfigured) {
      const path = await uploadSlip(newTx.id, slipFile)
      if (path) {
        newTx.slipUrl = path  // store storage path
        newTx.hasSlip = true
      }
    }

    setTransactions((prev) => [newTx, ...prev])
    insertTransaction(newTx) // persist (fire-and-forget)

    addNotification({
      recipientId: partner.id,
      fromName: user!.name,
      message: `${user!.name} เพิ่มรายการ "${newTx.detail}" ฿${formatBaht(newTx.amount)}`,
      txId: newTx.id,
      type: "add",
    })
  }

  function handleEdit(updated: Transaction) {
    setTransactions((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
    updateTransaction(updated)
  }

  function handleDelete(txId: string) {
    setTransactions((prev) => prev.filter((t) => t.id !== txId))
    deleteTransaction(txId)
  }

  function handleAddCategory(label: string, emoji: string) {
    const cat = makeCustomCategory(label, emoji, customCategories.length)
    setCustomCategories((prev) => [...prev, cat])
    insertCustomCategory(cat, customCategories.length)
    return cat.id
  }

  function handleConfirmSettle() {
    const partner = partnerOf(user!.id)
    setTransactions((prev) => prev.map((t) => ({ ...t, owed: 0, settled: true })))
    setShowSettlement(false)
    settleAllTransactions() // persist
    addNotification({
      recipientId: partner.id,
      fromName: user!.name,
      message: `${user!.name} เคลียร์ยอดทั้งหมดแล้ว`,
      type: "edit",
    })
  }

  // ── Profile handlers ────────────────────────────────────

  function handleSettingsSave(updated: Partial<User>, pinHash?: string) {
    const uid = user!.id
    setUser((prev) => prev ? { ...prev, ...updated } : prev)
    setUserOverrides((prev) => ({
      ...prev,
      [uid]: { ...(prev[uid] ?? {}), ...updated },
    }))
    if (pinHash) {
      setUserPinHashes((prev) => ({ ...prev, [uid]: pinHash }))
    }
    upsertProfile(uid, updated, pinHash)
  }

  function mergeOverrides(base: User): User {
    return { ...base, ...(userOverrides[base.id] ?? {}) }
  }

  function handleProfileSelect(u: User) {
    const merged = mergeOverrides(u)
    if (userPinHashes[u.id]) {
      setPendingUser(merged)
    } else {
      setUser(merged)
      setTab("home")
    }
  }

  function handleMarkAllRead() {
    setNotifications((prev) =>
      prev.map((n) => (n.recipientId === user?.id ? { ...n, read: true } : n)),
    )
  }

  // ── Loading screen ──────────────────────────────────────
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="size-10 rounded-full border-4 border-accent/30 border-t-accent animate-spin" />
          <p className="text-sm text-muted-foreground">กำลังโหลด...</p>
        </div>
      </div>
    )
  }

  // ── PIN gate ────────────────────────────────────────────
  if (pendingUser) {
    return (
      <PinEntry
        user={pendingUser}
        checkPin={async (pin) => {
          const stored = userPinHashes[pendingUser.id]
          if (!stored) return false
          return verifyPin(pin, stored, pendingUser.id)
        }}
        onSuccess={() => { setUser(pendingUser); setPendingUser(null); setTab("home") }}
        onCancel={() => setPendingUser(null)}
      />
    )
  }

  // ── Profile picker ──────────────────────────────────────
  const mergedUsers = USERS.map(mergeOverrides)

  if (!user) {
    return <ProfilePicker users={mergedUsers} onSelect={handleProfileSelect} />
  }

  // ── Main app ────────────────────────────────────────────
  const theme = getTheme(user.themeId)
  const themeStyle: React.CSSProperties = {
    "--background": theme.vars.background,
    "--primary": theme.vars.primary,
    "--accent": theme.vars.accent,
    "--ring": theme.vars.ring,
    "--chart-1": theme.vars["chart-1"],
  } as React.CSSProperties

  const partner = partnerOf(user.id)
  const myNotifications = notifications.filter((n) => n.recipientId === user.id)

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-background" style={themeStyle}>
      <div className="flex-1 pb-6">
        {tab === "home" && (
          <>
            <AppHeader
              user={user}
              notifications={myNotifications}
              onSwitch={() => setUser(null)}
              onMarkAllRead={handleMarkAllRead}
              onOpenSettings={() => setShowSettings(true)}
            />
            <div className="space-y-5 pt-2">
              <BalanceCard
                net={net}
                partnerName={partner.name}
                onRequestSettle={() => setShowSettlement(true)}
              />
              <AddTransaction
                categories={allCategories}
                user={user}
                partner={partner}
                onAdd={handleAdd}
                onAddCategory={handleAddCategory}
              />
              <RecentList
                items={transactions}
                categories={allCategories}
                onSeeAll={() => setTab("history")}
              />
            </div>
          </>
        )}

        {tab !== "home" && (
          <header className="px-5 pb-1 pt-7">
            <h1 className="text-2xl font-bold text-foreground">{tabTitles[tab]}</h1>
            <p className="text-sm text-muted-foreground">
              {user.name} · กับ {partner.name}
            </p>
          </header>
        )}

        {tab === "summary" && (
          <SummaryView
            transactions={transactions}
            categories={allCategories}
            user={user}
            partner={partner}
          />
        )}

        {tab === "history" && (
          <HistoryView
            transactions={transactions}
            categories={allCategories}
            user={user}
            partner={partner}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onNotify={addNotification}
          />
        )}
      </div>

      <BottomNav active={tab} onChange={setTab} />

      {showSettings && (
        <SettingsPanel
          user={user}
          onSave={handleSettingsSave}
          hasPin={!!userPinHashes[user.id]}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showSettlement && (
        <SettlementModal
          transactions={transactions}
          categories={allCategories}
          user={user}
          partner={partner}
          net={net}
          onConfirm={handleConfirmSettle}
          onClose={() => setShowSettlement(false)}
        />
      )}
    </div>
  )
}
