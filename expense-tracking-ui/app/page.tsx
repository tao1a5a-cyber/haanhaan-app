"use client"

import { useEffect, useMemo, useState } from "react"
import { AppHeader } from "@/components/expense/app-header"
import { BalanceCard } from "@/components/expense/balance-card"
import { AddTransaction } from "@/components/expense/add-transaction"
import { RecentList } from "@/components/expense/recent-list"
import { SummaryView } from "@/components/expense/summary-view"
import { HistoryView } from "@/components/expense/history-view"
import { BottomNav } from "@/components/expense/bottom-nav"
import { EntryScreen } from "@/components/expense/entry-screen"
import { SettlementModal } from "@/components/expense/settlement-modal"
import { SettingsPanel } from "@/components/expense/settings-panel"
import { PinEntry } from "@/components/expense/pin-entry"
import { memberDefaults } from "@/components/expense/users"
import type { Group, Member, Transaction } from "@/components/expense/types"
import { getTheme } from "@/components/expense/themes"
import {
  categories as baseCategories,
  makeCustomCategory,
  formatBaht,
  type Category,
} from "@/components/expense/categories"
import type { AppNotification } from "@/components/expense/notifications"
import { isSupabaseConfigured, tryGetSupabase } from "@/lib/supabase"
import {
  fetchGroups,
  createGroup,
  renameGroup,
  addMember,
  updateMember,
  removeMember,
  fetchMemberPinHash,
  fetchTransactions,
  insertTransaction,
  updateTransaction,
  deleteTransaction,
  settleAllTransactions,
  fetchCustomCategories,
  insertCustomCategory,
  fetchNotifications,
  insertNotifications,
  markNotificationsRead,
  mapNotificationRow,
} from "@/lib/db"
import { uploadSlip } from "@/lib/storage"
import { memberBalances, myNet } from "@/lib/balances"
import { verifyPin } from "@/lib/pin"

const tabTitles: Record<string, string> = {
  summary: "สรุปค่าใช้จ่าย",
  history: "ประวัติรายการ",
}

export default function Page() {
  const [groups, setGroups] = useState<Group[]>([])
  const [group, setGroup] = useState<Group | null>(null)
  const [member, setMember] = useState<Member | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [customCategories, setCustomCategories] = useState<Category[]>([])
  const [tab, setTab] = useState("home")
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [showSettlement, setShowSettlement] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState<{ member: Member; hash: string } | null>(null)

  // ── Bootstrap: load groups + categories ─────────────────
  useEffect(() => {
    async function boot() {
      if (isSupabaseConfigured) {
        const [gs, cats] = await Promise.all([fetchGroups(), fetchCustomCategories()])
        setGroups(gs)
        setCustomCategories(cats)
      }
      setLoading(false)
    }
    boot()
  }, [])

  // ── Load the active group's transactions ────────────────
  useEffect(() => {
    if (!group) { setTransactions([]); return }
    let active = true
    fetchTransactions(group.id).then((txs) => { if (active) setTransactions(txs) })
    return () => { active = false }
  }, [group?.id])

  // ── Notifications: load inbox + live-subscribe ──────────
  useEffect(() => {
    if (!member || !isSupabaseConfigured) return
    let active = true

    fetchNotifications(member.id).then((rows) => { if (active) setNotifications(rows) })

    const db = tryGetSupabase()
    if (!db) return
    const channel = db
      .channel(`notif-${member.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `recipient_id=eq.${member.id}` },
        (payload) => {
          const notif = mapNotificationRow(payload.new)
          setNotifications((prev) => (prev.some((p) => p.id === notif.id) ? prev : [notif, ...prev]))
        },
      )
      .subscribe()

    return () => { active = false; db.removeChannel(channel) }
  }, [member?.id])

  const allCategories = useMemo(
    () => [...baseCategories, ...customCategories],
    [customCategories],
  )

  const balances = useMemo(
    () => memberBalances(group?.members ?? [], transactions),
    [group?.members, transactions],
  )
  const net = member ? myNet(member.id, balances) : 0

  // ── Notification fan-out to every other group member ────
  function notifyOthers(message: string, type: AppNotification["type"], txId?: string) {
    if (!group || !member) return
    const others = group.members.filter((m) => m.id !== member.id)
    if (others.length === 0) return
    const list: AppNotification[] = others.map((m) => ({
      id: crypto.randomUUID(),
      groupId: group.id,
      recipientId: m.id,
      fromName: member.name,
      message,
      txId,
      type,
      ts: Date.now(),
      read: false,
    }))
    insertNotifications(list)
  }

  // ── Transaction handlers ─────────────────────────────────
  async function handleAdd(
    tx: Omit<Transaction, "id" | "createdAt" | "payerId" | "groupId">,
    slipFile?: File,
  ) {
    if (!group || !member) return
    const newTx: Transaction = {
      ...tx,
      id: crypto.randomUUID(),
      groupId: group.id,
      payerId: member.id,
      createdAt: Date.now(),
    }

    if (slipFile && isSupabaseConfigured) {
      const path = await uploadSlip(newTx.id, slipFile)
      if (path) { newTx.slipUrl = path; newTx.hasSlip = true }
    }

    setTransactions((prev) => [newTx, ...prev])
    insertTransaction(newTx)
    notifyOthers(`${member.name} เพิ่มรายการ "${newTx.detail}" ฿${formatBaht(newTx.amount)}`, "add", newTx.id)
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
    if (!group || !member) return
    setTransactions((prev) => prev.map((t) => ({ ...t, settled: true })))
    setShowSettlement(false)
    settleAllTransactions(group.id)
    notifyOthers(`${member.name} เคลียร์ยอดทั้งหมดแล้ว`, "edit")
  }

  // ── Group / member entry ─────────────────────────────────
  async function handleCreateGroup(name: string): Promise<Group | null> {
    const id = await createGroup(name)
    if (!id) return null
    const g: Group = { id, name, members: [] }
    setGroups((prev) => [...prev, g])
    return g
  }

  async function handleAddMember(
    groupId: string,
    draft: { name: string; avatar?: string },
  ): Promise<Member | null> {
    const g = groups.find((x) => x.id === groupId)
    const defaults = memberDefaults(g?.members.length ?? 0)
    const m = await addMember(groupId, { name: draft.name, avatar: draft.avatar, ...defaults })
    if (!m) return null
    setGroups((prev) => prev.map((x) => (x.id === groupId ? { ...x, members: [...x.members, m] } : x)))
    return m
  }

  async function enterAs(g: Group, m: Member) {
    const hash = await fetchMemberPinHash(m.id)
    if (hash) {
      setGroup(g)
      setPending({ member: m, hash })
    } else {
      setGroup(g)
      setMember(m)
      setTab("home")
    }
  }

  // ── Profile / settings handlers ──────────────────────────
  function applyMemberUpdate(memberId: string, updated: Partial<Member>) {
    setGroups((prev) =>
      prev.map((g) => ({
        ...g,
        members: g.members.map((m) => (m.id === memberId ? { ...m, ...updated } : m)),
      })),
    )
    setGroup((prev) =>
      prev ? { ...prev, members: prev.members.map((m) => (m.id === memberId ? { ...m, ...updated } : m)) } : prev,
    )
  }

  function handleSettingsSave(updated: Partial<Member>, pinHash?: string) {
    if (!member) return
    setMember((prev) => (prev ? { ...prev, ...updated } : prev))
    applyMemberUpdate(member.id, updated)
    updateMember(member.id, updated, pinHash)
  }

  async function handleAddGroupMember(name: string) {
    if (!group) return
    await handleAddMember(group.id, { name })
  }

  function handleRemoveMember(memberId: string) {
    if (!group) return
    setGroups((prev) =>
      prev.map((g) => (g.id === group.id ? { ...g, members: g.members.filter((m) => m.id !== memberId) } : g)),
    )
    setGroup((prev) => (prev ? { ...prev, members: prev.members.filter((m) => m.id !== memberId) } : prev))
    removeMember(memberId)
  }

  function handleRenameGroup(name: string) {
    if (!group) return
    setGroups((prev) => prev.map((g) => (g.id === group.id ? { ...g, name } : g)))
    setGroup((prev) => (prev ? { ...prev, name } : prev))
    renameGroup(group.id, name)
  }

  function handleMarkAllRead() {
    if (!member) return
    setNotifications((prev) => prev.map((n) => (n.recipientId === member.id ? { ...n, read: true } : n)))
    markNotificationsRead(member.id)
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
  if (pending) {
    return (
      <PinEntry
        member={pending.member}
        checkPin={async (pin) => verifyPin(pin, pending.hash, pending.member.pinSalt ?? pending.member.id)}
        onSuccess={() => { setMember(pending.member); setPending(null); setTab("home") }}
        onCancel={() => { setPending(null); setGroup(null) }}
      />
    )
  }

  // ── Entry: pick group + member ──────────────────────────
  if (!member || !group) {
    return (
      <EntryScreen
        groups={groups}
        onEnter={enterAs}
        onCreateGroup={handleCreateGroup}
        onAddMember={handleAddMember}
      />
    )
  }

  // ── Main app ────────────────────────────────────────────
  const theme = getTheme(member.themeId)
  const themeStyle: React.CSSProperties = {
    "--background": theme.vars.background,
    "--primary": theme.vars.primary,
    "--accent": theme.vars.accent,
    "--ring": theme.vars.ring,
    "--chart-1": theme.vars["chart-1"],
  } as React.CSSProperties

  const myNotifications = notifications.filter((n) => n.recipientId === member.id)

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-background" style={themeStyle}>
      <div className="flex-1 pb-6">
        {tab === "home" && (
          <>
            <AppHeader
              group={group}
              member={member}
              notifications={myNotifications}
              onSwitchMember={() => { setMember(null); setTab("home") }}
              onSwitchGroup={() => { setMember(null); setGroup(null); setTab("home") }}
              onMarkAllRead={handleMarkAllRead}
              onOpenSettings={() => setShowSettings(true)}
            />
            <div className="space-y-5 pt-2">
              <BalanceCard
                net={net}
                members={group.members}
                currentMemberId={member.id}
                onRequestSettle={() => setShowSettlement(true)}
              />
              <AddTransaction
                categories={allCategories}
                members={group.members}
                currentMember={member}
                onAdd={handleAdd}
                onAddCategory={handleAddCategory}
              />
              <RecentList
                items={transactions}
                categories={allCategories}
                members={group.members}
                currentMemberId={member.id}
                onSeeAll={() => setTab("history")}
              />
            </div>
          </>
        )}

        {tab !== "home" && (
          <header className="px-5 pb-1 pt-7">
            <h1 className="text-2xl font-bold text-foreground">{tabTitles[tab]}</h1>
            <p className="text-sm text-muted-foreground">
              {group.name} · {group.members.length} คน
            </p>
          </header>
        )}

        {tab === "summary" && (
          <SummaryView transactions={transactions} categories={allCategories} members={group.members} />
        )}

        {tab === "history" && (
          <HistoryView
            transactions={transactions}
            categories={allCategories}
            members={group.members}
            currentMember={member}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onNotify={notifyOthers}
          />
        )}
      </div>

      <BottomNav active={tab} onChange={setTab} />

      {showSettings && (
        <SettingsPanel
          group={group}
          member={member}
          onSave={handleSettingsSave}
          onAddMember={handleAddGroupMember}
          onRemoveMember={handleRemoveMember}
          onRenameGroup={handleRenameGroup}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showSettlement && (
        <SettlementModal
          transactions={transactions}
          categories={allCategories}
          members={group.members}
          currentMemberId={member.id}
          balances={balances}
          onConfirm={handleConfirmSettle}
          onClose={() => setShowSettlement(false)}
        />
      )}
    </div>
  )
}
