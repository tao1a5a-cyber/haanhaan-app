import { tryGetSupabase } from "./supabase"
import { makeCustomCategory, type Category } from "@/components/expense/categories"
import type { Group, Member, Transaction } from "@/components/expense/types"
import type { AppNotification } from "@/components/expense/notifications"

// ── Groups & Members ──────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapMember(row: any): Member {
  return {
    id: row.id,
    groupId: row.group_id,
    name: row.name,
    avatar: row.avatar_url ?? "",
    tint: row.tint ?? "oklch(0.93 0.05 70)",
    themeId: row.theme_id ?? undefined,
    pinSalt: row.pin_salt ?? row.id,
  }
}

/** Load every group with its members nested. */
export async function fetchGroups(): Promise<Group[]> {
  const db = tryGetSupabase()
  if (!db) return []

  const [{ data: groupRows, error: gErr }, { data: memberRows, error: mErr }] = await Promise.all([
    db.from("groups").select("*").order("created_at", { ascending: true }),
    db.from("members").select("*").order("created_at", { ascending: true }),
  ])
  if (gErr) { console.error("fetchGroups", gErr); return [] }
  if (mErr) { console.error("fetchGroups members", mErr); return [] }

  const byGroup = new Map<string, Member[]>()
  for (const row of memberRows ?? []) {
    const m = mapMember(row)
    const list = byGroup.get(m.groupId) ?? []
    list.push(m)
    byGroup.set(m.groupId, list)
  }

  return (groupRows ?? []).map((g: any) => ({
    id: g.id,
    name: g.name,
    members: byGroup.get(g.id) ?? [],
  }))
}

/** Create a group and return its id (null offline / on error). */
export async function createGroup(name: string): Promise<string | null> {
  const db = tryGetSupabase()
  if (!db) return null
  const { data, error } = await db.from("groups").insert({ name }).select("id").single()
  if (error) { console.error("createGroup", error); return null }
  return (data as any)?.id ?? null
}

export async function renameGroup(groupId: string, name: string) {
  const db = tryGetSupabase()
  if (!db) return
  const { error } = await db.from("groups").update({ name }).eq("id", groupId)
  if (error) console.error("renameGroup", error)
}

/** Insert a member; returns the created member (with db id) or null. */
export async function addMember(
  groupId: string,
  m: { name: string; avatar?: string; tint: string; themeId?: string },
): Promise<Member | null> {
  const db = tryGetSupabase()
  if (!db) return null
  const { data, error } = await db
    .from("members")
    .insert({
      group_id: groupId,
      name: m.name,
      avatar_url: m.avatar || null,
      tint: m.tint,
      theme_id: m.themeId ?? null,
    })
    .select("*")
    .single()
  if (error) { console.error("addMember", error); return null }
  return mapMember(data)
}

export async function updateMember(
  memberId: string,
  updated: Partial<Member>,
  pinHash?: string,
) {
  const db = tryGetSupabase()
  if (!db) return
  const { error } = await db
    .from("members")
    .update({
      ...(updated.name !== undefined ? { name: updated.name } : {}),
      ...(updated.tint !== undefined ? { tint: updated.tint } : {}),
      ...(updated.themeId !== undefined ? { theme_id: updated.themeId } : {}),
      ...(updated.avatar !== undefined ? { avatar_url: updated.avatar || null } : {}),
      ...(pinHash !== undefined ? { pin_hash: pinHash, pin_salt: memberId } : {}),
    })
    .eq("id", memberId)
  if (error) console.error("updateMember", error)
}

export async function removeMember(memberId: string) {
  const db = tryGetSupabase()
  if (!db) return
  const { error } = await db.from("members").delete().eq("id", memberId)
  if (error) console.error("removeMember", error)
}

/** Fetch a member's stored PIN hash (null if none). */
export async function fetchMemberPinHash(memberId: string): Promise<string | null> {
  const db = tryGetSupabase()
  if (!db) return null
  const { data, error } = await db
    .from("members")
    .select("pin_hash")
    .eq("id", memberId)
    .maybeSingle()
  if (error) { console.error("fetchMemberPinHash", error); return null }
  return (data as any)?.pin_hash ?? null
}

// ── Transactions (group-scoped) ───────────────────────────

export async function fetchTransactions(groupId: string): Promise<Transaction[]> {
  const db = tryGetSupabase()
  if (!db) return []

  const { data, error } = await db
    .from("transactions")
    .select("*")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false })

  if (error) { console.error("fetchTransactions", error); return [] }

  return (data ?? []).map((row: any) => ({
    id: row.id,
    groupId: row.group_id,
    payerId: row.payer_id,
    detail: row.detail,
    amount: Number(row.amount),
    shares: normalizeShares(row.shares),
    categoryId: row.category_id,
    split: row.split as Transaction["split"],
    settled: row.settled,
    slipUrl: row.slip_path ?? undefined,
    hasSlip: Boolean(row.slip_path),
    createdAt: new Date(row.created_at).getTime(),
  }))
}

function normalizeShares(raw: any): Record<string, number> {
  if (!raw || typeof raw !== "object") return {}
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(raw)) out[k] = Number(v) || 0
  return out
}

export async function insertTransaction(tx: Transaction) {
  const db = tryGetSupabase()
  if (!db) return
  const { error } = await db.from("transactions").insert({
    id: tx.id,
    group_id: tx.groupId,
    payer_id: tx.payerId,
    detail: tx.detail,
    amount: tx.amount,
    shares: tx.shares,
    category_id: tx.categoryId,
    split: tx.split,
    slip_path: tx.slipUrl ?? null,
    settled: tx.settled ?? false,
    created_at: new Date(tx.createdAt).toISOString(),
  })
  if (error) console.error("insertTransaction", error)
}

export async function updateTransaction(tx: Transaction) {
  const db = tryGetSupabase()
  if (!db) return
  const { error } = await db
    .from("transactions")
    .update({
      detail: tx.detail,
      amount: tx.amount,
      shares: tx.shares,
      category_id: tx.categoryId,
      split: tx.split,
      settled: tx.settled ?? false,
    })
    .eq("id", tx.id)
  if (error) console.error("updateTransaction", error)
}

export async function deleteTransaction(txId: string) {
  const db = tryGetSupabase()
  if (!db) return
  const { error } = await db.from("transactions").delete().eq("id", txId)
  if (error) console.error("deleteTransaction", error)
}

export async function settleAllTransactions(groupId: string) {
  const db = tryGetSupabase()
  if (!db) return
  const { error } = await db
    .from("transactions")
    .update({ settled: true })
    .eq("group_id", groupId)
    .eq("settled", false)
  if (error) console.error("settleAllTransactions", error)
}

// ── Custom categories (global) ────────────────────────────

export async function fetchCustomCategories(): Promise<Category[]> {
  const db = tryGetSupabase()
  if (!db) return []
  const { data, error } = await db
    .from("custom_categories")
    .select("*")
    .order("sort_order", { ascending: true })
  if (error) { console.error("fetchCustomCategories", error); return [] }
  return (data ?? []).map((row: any, i: number) => makeCustomCategory(row.label, row.emoji, i))
}

export async function insertCustomCategory(cat: Category, sortOrder: number) {
  const db = tryGetSupabase()
  if (!db) return
  const { error } = await db.from("custom_categories").insert({
    id: cat.id,
    label: cat.label,
    emoji: cat.emoji ?? "📦",
    sort_order: sortOrder,
  })
  if (error) console.error("insertCustomCategory", error)
}

// ── Notifications ─────────────────────────────────────────

/** Map a raw notifications row (snake_case) into the app's AppNotification. */
export function mapNotificationRow(row: any): AppNotification {
  return {
    id: row.id,
    groupId: row.group_id ?? undefined,
    recipientId: row.recipient_id,
    fromName: row.from_name,
    message: row.message,
    txId: row.tx_id ?? undefined,
    type: row.type as AppNotification["type"],
    ts: new Date(row.created_at).getTime(),
    read: row.read,
  }
}

/** Load the most recent notifications addressed to a member. */
export async function fetchNotifications(memberId: string): Promise<AppNotification[]> {
  const db = tryGetSupabase()
  if (!db) return []
  const { data, error } = await db
    .from("notifications")
    .select("*")
    .eq("recipient_id", memberId)
    .order("created_at", { ascending: false })
    .limit(50)
  if (error) { console.error("fetchNotifications", error); return [] }
  return (data ?? []).map(mapNotificationRow)
}

/** Insert many notifications at once (fan-out to every other group member). */
export async function insertNotifications(list: AppNotification[]) {
  const db = tryGetSupabase()
  if (!db || list.length === 0) return
  const { error } = await db.from("notifications").insert(
    list.map((n) => ({
      id: n.id,
      group_id: n.groupId ?? null,
      recipient_id: n.recipientId,
      from_name: n.fromName,
      message: n.message,
      tx_id: n.txId ?? null,
      type: n.type,
      read: n.read,
      created_at: new Date(n.ts).toISOString(),
    })),
  )
  if (error) console.error("insertNotifications", error)
}

export async function markNotificationsRead(memberId: string) {
  const db = tryGetSupabase()
  if (!db) return
  const { error } = await db
    .from("notifications")
    .update({ read: true })
    .eq("recipient_id", memberId)
    .eq("read", false)
  if (error) console.error("markNotificationsRead", error)
}
