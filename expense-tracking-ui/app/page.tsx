"use client"

import { useEffect, useMemo, useState } from "react"
import { X, Eye } from "lucide-react"
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
  ensureRoomCode,
  createGroup,
  renameGroup,
  updateGroupAvatar,
  addMember,
  updateMember,
  removeMember,
  claimMember,
  releaseMember,
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
import { uploadSlip, getSlipUrl } from "@/lib/storage"
import { memberBalances, myNet } from "@/lib/balances"
import { verifyPin } from "@/lib/pin"
import { signOut, getCurrentUser, onAuthChange } from "@/lib/auth"
import { loadLastContext, saveLastContext, clearLastContext } from "@/lib/prefs"
import { isGuestMode, exitLocalModes, GUEST_TX_LIMIT } from "@/lib/access-mode"
import { guestSeedIfEmpty, guestTransactionCount } from "@/lib/guest-store"
import { useThemeMode } from "@/lib/theme"

const tabTitles: Record<string, string> = {
  summary: "สรุปค่าใช้จ่าย",
  history: "ประวัติรายการ",
  settings: "ตั้งค่า",
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
  // add-expense form sheet opened by the central FAB
  const [showAddForm, setShowAddForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState<{ member: Member; hash: string } | null>(null)
  // when re-entering, jump straight to the member picker for this group
  const [entryGroupId, setEntryGroupId] = useState<string | null>(null)
  // signed-in Supabase account (shared cookie session)
  const [authEmail, setAuthEmail] = useState<string | null>(null)
  const [authUserId, setAuthUserId] = useState<string | null>(null)
  // true for an anonymous (Room Code) session — these guests are read-only until
  // they sign in with a real account and claim a profile.
  const [authIsAnonymous, setAuthIsAnonymous] = useState(false)
  // when re-entering after a fresh join, start EntryScreen on a specific step
  const [entryStep, setEntryStep] = useState<"group" | "member" | "profile" | null>(null)
  const [themeMode] = useThemeMode()

  // Anonymous room guests may browse but not write; lifted once they authenticate.
  const readOnly = authIsAnonymous

  // ── Auth gate: send unauthenticated visitors to /login ─────
  // Also drives the header's signed-in email indicator + identity binding.
  useEffect(() => {
    if (!isSupabaseConfigured) return
    // Offline Guest Mode is intentionally not signed in — don't bounce to /login.
    if (isGuestMode()) return
    // Anonymous (Room Code) sessions count as signed in, so `u` is truthy for
    // them and they aren't redirected; only a true sign-out sends to /login.
    getCurrentUser().then((u) => {
      setAuthEmail(u?.email || null)
      setAuthUserId(u?.id ?? null)
      setAuthIsAnonymous(!!u?.isAnonymous)
      if (!u) window.location.href = "/login"
    })
    return onAuthChange((u) => {
      setAuthEmail(u?.email || null)
      setAuthUserId(u?.id ?? null)
      setAuthIsAnonymous(!!u?.isAnonymous)
      if (!u) window.location.href = "/login"
    })
  }, [])

  // ── Bootstrap: load groups, then pick where to land ─────
  useEffect(() => {
    async function boot() {
      const me = isSupabaseConfigured ? await getCurrentUser() : null

      // 1) A real (non-anonymous) account always wins and clears any guest flag.
      if (me && !me.isAnonymous) {
        exitLocalModes()
        setAuthEmail(me.email || null)
        setAuthUserId(me.id)
        setAuthIsAnonymous(false)
        const gs = await fetchGroups()
        setGroups(gs)

        // Email already bound to a member → enter that profile directly.
        for (const g of gs) {
          const mine = g.members.find((m) => m.userId === me.id)
          if (mine) { setEntryGroupId(g.id); await enterAs(g, mine); setLoading(false); return }
        }

        // Otherwise restore the last group + member used on this device.
        const last = loadLastContext()
        if (last) {
          const g = gs.find((x) => x.id === last.groupId)
          const m = g?.members.find((x) => x.id === last.memberId)
          if (g && m) { setEntryGroupId(g.id); await enterAs(g, m) }
        }
        setLoading(false)
        return
      }

      // 2) Offline Guest Mode — everything lives in localStorage.
      if (isGuestMode()) {
        const gs = guestSeedIfEmpty()
        setGroups(gs)
        const last = loadLastContext()
        const g = gs.find((x) => x.id === last?.groupId) ?? gs[0]
        const m = g?.members.find((x) => x.id === last?.memberId) ?? g?.members[0]
        if (g && m) { setEntryGroupId(g.id); await enterAs(g, m) }
        setLoading(false)
        return
      }

      // 3) Anonymous Room guest — RLS returns only the group(s) they redeemed a
      //    code for. Read-only: they land on the profile step (sign-in prompt),
      //    or resume the member they were last viewing as.
      if (me) {
        setAuthUserId(me.id)
        setAuthIsAnonymous(true)
        const gs = await fetchGroups()
        setGroups(gs)
        const last = loadLastContext()
        if (last) {
          const g = gs.find((x) => x.id === last.groupId)
          const m = g?.members.find((x) => x.id === last.memberId)
          if (g && m) { setEntryGroupId(g.id); await enterAs(g, m); setLoading(false); return }
        }
        // Freshly joined via a Room Code → show the profile / read-only screen.
        if (gs.length > 0) { setEntryGroupId(gs[0].id); setEntryStep("profile") }
        setLoading(false)
        return
      }

      // 4) Not signed in → the auth gate redirects to /login.
      setLoading(false)
    }
    boot()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Custom categories are scoped to the active member ───
  useEffect(() => {
    if (!member || !isSupabaseConfigured) { setCustomCategories([]); return }
    let active = true
    fetchCustomCategories(member.id).then((cats) => { if (active) setCustomCategories(cats) })
    return () => { active = false }
  }, [member?.id])

  // ── Remember the active group + member for next open ────
  useEffect(() => {
    if (group && member) saveLastContext({ groupId: group.id, memberId: member.id })
  }, [group?.id, member?.id])

  // ── Load the active group's transactions ────────────────
  useEffect(() => {
    if (!group) { setTransactions([]); return }
    let active = true
    fetchTransactions(group.id).then((txs) => { if (active) setTransactions(txs) })
    return () => { active = false }
  }, [group?.id])

  // ── Notifications: load inbox + live-subscribe ──────────
  useEffect(() => {
    if (!member || !isSupabaseConfigured || isGuestMode()) return
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
    if (!group || !member || readOnly) return

    // Guest mode is capped — nudge to the cloud once the local limit is hit.
    if (isGuestMode() && guestTransactionCount() >= GUEST_TX_LIMIT) {
      alert(
        `โหมดทดลองใช้ได้สูงสุด ${GUEST_TX_LIMIT} รายการ\n` +
          "เข้าสู่ระบบเพื่อใช้งานแบบไม่จำกัดและซิงก์ข้อมูลขึ้นคลาวด์",
      )
      window.location.href = "/login"
      return
    }

    const newTx: Transaction = {
      ...tx,
      id: crypto.randomUUID(),
      groupId: group.id,
      payerId: member.id,
      createdAt: Date.now(),
    }

    if (slipFile && isSupabaseConfigured) {
      const path = await uploadSlip(newTx.id, slipFile)
      if (path) {
        newTx.slipPath = path
        newTx.hasSlip = true
        // Resolve a signed URL so the thumbnail renders (path alone isn't fetchable).
        newTx.slipUrl = (await getSlipUrl(path)) ?? newTx.slipUrl
      }
    }

    setTransactions((prev) => [newTx, ...prev])
    insertTransaction(newTx)
    notifyOthers(`${member.name} เพิ่มรายการ "${newTx.detail}" ฿${formatBaht(newTx.amount)}`, "add", newTx.id)
  }

  function handleEdit(updated: Transaction) {
    if (readOnly) return
    setTransactions((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
    updateTransaction(updated)
  }

  function handleDelete(txId: string) {
    if (readOnly) return
    setTransactions((prev) => prev.filter((t) => t.id !== txId))
    deleteTransaction(txId)
  }

  function handleAddCategory(label: string, emoji: string) {
    const cat = makeCustomCategory(label, emoji, customCategories.length)
    setCustomCategories((prev) => [...prev, cat])
    insertCustomCategory(cat, customCategories.length, member?.id)
    return cat.id
  }

  function handleConfirmSettle() {
    if (!group || !member || readOnly) return
    setTransactions((prev) => prev.map((t) => ({ ...t, settled: true })))
    setShowSettlement(false)
    settleAllTransactions(group.id)
    notifyOthers(`${member.name} เคลียร์ยอดทั้งหมดแล้ว`, "edit")
  }

  // ── Group / member entry ─────────────────────────────────
  async function handleCreateGroup(name: string): Promise<Group | null> {
    // Pass the host so the new group is owned by its creator (also stamped
    // server-side by the set_group_host trigger under the strict RLS model).
    try {
      const g = await createGroup(name, authUserId ?? undefined)
      if (!g) {
        alert("สร้างกลุ่มไม่สำเร็จ กรุณาลองใหม่อีกครั้ง")
        return null
      }
      setGroups((prev) => [...prev, g])
      return g
    } catch (e) {
      // Surface the real DB/RLS message so failures are diagnosable.
      const err = e as { message?: string; code?: string; details?: string }
      const detail = err?.message || err?.details || "unknown error"
      alert(`สร้างกลุ่มไม่สำเร็จ\n${detail}${err?.code ? `\n(code: ${err.code})` : ""}`)
      console.error("handleCreateGroup", e)
      return null
    }
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

  /** Remember "this email = this member" so next login enters directly. */
  function bindMemberToMe(m: Member) {
    // Anonymous room guests can't claim (writes are blocked) — skip silently.
    if (!authUserId || authIsAnonymous || m.userId) return // unauthenticated/guest or already bound
    claimMember(m.id, authUserId)
    applyMemberUpdate(m.id, { userId: authUserId })
  }

  /** Settings: assign my email to a chosen member, moving it off any previous one. */
  function handleClaimMember(memberId: string) {
    if (!authUserId || !group || readOnly) return
    const prev = group.members.find((m) => m.userId === authUserId)
    if (prev && prev.id !== memberId) {
      releaseMember(prev.id)
      applyMemberUpdate(prev.id, { userId: undefined })
    }
    claimMember(memberId, authUserId)
    applyMemberUpdate(memberId, { userId: authUserId })
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
      bindMemberToMe(m)
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

  function handleSettingsSave(updated: Partial<Member>, pinHash?: string | null) {
    if (!member || readOnly) return
    setMember((prev) => (prev ? { ...prev, ...updated } : prev))
    applyMemberUpdate(member.id, updated)
    updateMember(member.id, updated, pinHash)
  }

  async function handleAddGroupMember(name: string) {
    if (!group || readOnly) return
    await handleAddMember(group.id, { name })
  }

  function handleRemoveMember(memberId: string) {
    if (!group || readOnly) return
    setGroups((prev) =>
      prev.map((g) => (g.id === group.id ? { ...g, members: g.members.filter((m) => m.id !== memberId) } : g)),
    )
    setGroup((prev) => (prev ? { ...prev, members: prev.members.filter((m) => m.id !== memberId) } : prev))
    removeMember(memberId)
  }

  function handleRenameGroup(name: string) {
    if (!group || readOnly) return
    setGroups((prev) => prev.map((g) => (g.id === group.id ? { ...g, name } : g)))
    setGroup((prev) => (prev ? { ...prev, name } : prev))
    renameGroup(group.id, name)
  }

  /** Settings: mint (or reveal) the active group's shareable Room Code. */
  async function handleGenerateRoomCode(): Promise<string | null> {
    if (!group || readOnly) return null
    const code = await ensureRoomCode(group.id, group.roomCode)
    if (code) {
      setGroups((prev) => prev.map((g) => (g.id === group.id ? { ...g, roomCode: code } : g)))
      setGroup((prev) => (prev ? { ...prev, roomCode: code } : prev))
    }
    return code
  }

  function handleSaveGroupAvatar(avatarUrl: string) {
    if (!group || readOnly) return
    setGroups((prev) => prev.map((g) => (g.id === group.id ? { ...g, avatar: avatarUrl } : g)))
    setGroup((prev) => (prev ? { ...prev, avatar: avatarUrl } : prev))
    updateGroupAvatar(group.id, avatarUrl)
  }

  // ── Header navigation ────────────────────────────────────
  /** Switch the active group → reopen the member picker for it. */
  function handleSelectGroup(g: Group) {
    setEntryGroupId(g.id)
    setMember(null)
    setGroup(null)
    setTab("home")
  }

  /** "Back to Home" → the 'who are you?' profile picker for the current group. */
  function handleBackToHome() {
    setEntryGroupId(group?.id ?? null)
    setMember(null)
    setGroup(null)
    setTab("home")
  }

  /** Sign out → clear cached context and go to the login page. */
  async function handleLogout() {
    clearLastContext()
    exitLocalModes()
    await signOut()
    // Hard navigation: ends the session and lands the user on /login.
    window.location.href = "/login"
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
        onSuccess={() => { bindMemberToMe(pending.member); setMember(pending.member); setPending(null); setTab("home") }}
        onCancel={() => { setPending(null); setGroup(null) }}
      />
    )
  }

  // ── Entry: pick group + member ──────────────────────────
  if (!member || !group) {
    return (
      <EntryScreen
        groups={groups}
        initialGroupId={entryGroupId}
        initialStep={entryStep}
        readOnly={readOnly}
        authEmail={authEmail}
        onEnter={enterAs}
        onCreateGroup={handleCreateGroup}
        onAddMember={handleAddMember}
        onCreateProfile={handleAddMember}
      />
    )
  }

  // ── Main app ────────────────────────────────────────────
  const theme = getTheme(member.themeId)
  // Per-member theme is a light-mode personalization; in dark mode we let the
  // global .dark palette (clean black/gray) take over for a consistent look.
  const themeStyle: React.CSSProperties | undefined =
    themeMode === "dark"
      ? undefined
      : ({
          "--background": theme.vars.background,
          "--primary": theme.vars.primary,
          "--accent": theme.vars.accent,
          "--ring": theme.vars.ring,
          "--chart-1": theme.vars["chart-1"],
        } as React.CSSProperties)

  const myNotifications = notifications.filter((n) => n.recipientId === member.id)

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-background" style={themeStyle}>
      <div className="flex-1 pb-6">
        {tab === "home" && (
          <>
            <AppHeader
              group={group}
              groups={groups}
              member={member}
              notifications={myNotifications}
              authEmail={authEmail}
              onSelectGroup={handleSelectGroup}
              onBackToHome={handleBackToHome}
              onLogout={handleLogout}
              onMarkAllRead={handleMarkAllRead}
            />
            <div className="space-y-5 pt-2">
              {readOnly && (
                <div className="mx-5 flex items-center gap-3 rounded-[1.4rem] bg-accent/10 p-4 ring-1 ring-accent/25">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
                    <Eye className="size-[18px]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">โหมดอ่านอย่างเดียว</p>
                    <p className="text-xs text-muted-foreground">เข้าสู่ระบบเพื่อเพิ่มและแก้ไขรายการ</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { window.location.href = "/login" }}
                    className="shrink-0 rounded-full bg-accent px-3.5 py-2 text-xs font-semibold text-accent-foreground transition active:scale-95"
                  >
                    เข้าสู่ระบบ
                  </button>
                </div>
              )}
              <BalanceCard
                net={net}
                members={group.members}
                currentMemberId={member.id}
                balances={balances}
                onRequestSettle={() => setShowSettlement(true)}
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
          <SummaryView
            transactions={transactions}
            categories={allCategories}
            members={group.members}
            currentMember={member}
          />
        )}

        {tab === "history" && (
          <HistoryView
            transactions={transactions}
            categories={allCategories}
            members={group.members}
            currentMember={member}
            readOnly={readOnly}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onNotify={notifyOthers}
          />
        )}

        {tab === "settings" && (
          <SettingsPanel
            embedded
            group={group}
            member={member}
            readOnly={readOnly}
            authEmail={authEmail}
            authUserId={authUserId}
            onClaimMember={handleClaimMember}
            onSave={handleSettingsSave}
            onAddMember={handleAddGroupMember}
            onRemoveMember={handleRemoveMember}
            onRenameGroup={handleRenameGroup}
            onSaveGroupAvatar={handleSaveGroupAvatar}
            onGenerateRoomCode={handleGenerateRoomCode}
            roomCodeEnabled={!isGuestMode() && !!authEmail}
          />
        )}
      </div>

      <BottomNav active={tab} onChange={setTab} canAdd={!readOnly} onAdd={() => setShowAddForm(true)} />

      {/* One-click add: the FAB opens the expense form directly */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <button
            type="button"
            aria-label="ปิด"
            onClick={() => setShowAddForm(false)}
            className="absolute inset-0 bg-foreground/30 backdrop-blur-sm"
          />
          <div className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-[2rem] bg-background pb-4 shadow-2xl ring-1 ring-border animate-in slide-in-from-bottom-4 fade-in duration-300 sm:rounded-[2rem]">
            <div className="sticky top-0 z-10 flex items-center justify-between bg-background/90 px-5 pb-2 pt-4 backdrop-blur-sm">
              <div className="absolute left-1/2 top-1.5 h-1.5 w-10 -translate-x-1/2 rounded-full bg-border sm:hidden" />
              <h2 className="text-base font-semibold text-foreground">เพิ่มรายการ</h2>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                aria-label="ปิด"
                className="grid size-8 place-items-center rounded-full bg-secondary text-muted-foreground transition active:scale-90"
              >
                <X className="size-4" />
              </button>
            </div>
            <AddTransaction
              categories={allCategories}
              members={group.members}
              currentMember={member}
              onAdd={handleAdd}
              onAddCategory={handleAddCategory}
              onSubmitted={() => setShowAddForm(false)}
            />
          </div>
        </div>
      )}

      {showSettlement && (
        <SettlementModal
          transactions={transactions}
          categories={allCategories}
          members={group.members}
          currentMemberId={member.id}
          balances={balances}
          readOnly={readOnly}
          onConfirm={handleConfirmSettle}
          onClose={() => setShowSettlement(false)}
        />
      )}
    </div>
  )
}
