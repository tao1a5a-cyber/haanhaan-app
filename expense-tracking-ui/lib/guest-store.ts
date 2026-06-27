/**
 * Offline data store for Guest Mode — a localStorage-backed mirror of the
 * Supabase tables the app actually reads/writes. Everything here is synchronous
 * and SSR-safe (returns empty defaults when `window` is missing). The async
 * db.ts wrappers delegate to these when isGuestMode() is true.
 */

import { memberDefaults } from "@/components/expense/users"
import type { Group, Member, Transaction } from "@/components/expense/types"

const GROUPS_KEY = "haanhaan:guest:groups"
const TXS_KEY = "haanhaan:guest:txs"

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write<T>(key: string, value: T) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage full or disabled */
  }
}

// ── Groups & members ──────────────────────────────────────

export function guestFetchGroups(): Group[] {
  return read<Group[]>(GROUPS_KEY, [])
}

function saveGroups(groups: Group[]) {
  write(GROUPS_KEY, groups)
}

/** Ensure the guest has at least one group + member so they can use the app immediately. */
export function guestSeedIfEmpty(): Group[] {
  const groups = guestFetchGroups()
  if (groups.length > 0) return groups
  const groupId = crypto.randomUUID()
  const seeded: Group = {
    id: groupId,
    name: "กลุ่มของฉัน",
    members: [
      {
        id: crypto.randomUUID(),
        groupId,
        name: "ฉัน",
        avatar: "",
        ...memberDefaults(0),
      },
    ],
  }
  saveGroups([seeded])
  return [seeded]
}

export function guestCreateGroup(name: string): Group {
  const groups = guestFetchGroups()
  const g: Group = { id: crypto.randomUUID(), name, members: [] }
  saveGroups([...groups, g])
  return g
}

export function guestRenameGroup(groupId: string, name: string) {
  saveGroups(guestFetchGroups().map((g) => (g.id === groupId ? { ...g, name } : g)))
}

export function guestUpdateGroupAvatar(groupId: string, avatarUrl: string) {
  saveGroups(guestFetchGroups().map((g) => (g.id === groupId ? { ...g, avatar: avatarUrl } : g)))
}

export function guestAddMember(
  groupId: string,
  m: { name: string; avatar?: string; tint: string; themeId?: string },
): Member | null {
  const groups = guestFetchGroups()
  const g = groups.find((x) => x.id === groupId)
  if (!g) return null
  const member: Member = {
    id: crypto.randomUUID(),
    groupId,
    name: m.name,
    avatar: m.avatar || "",
    tint: m.tint,
    themeId: m.themeId,
  }
  g.members = [...g.members, member]
  saveGroups(groups)
  return member
}

export function guestUpdateMember(memberId: string, updated: Partial<Member>) {
  saveGroups(
    guestFetchGroups().map((g) => ({
      ...g,
      members: g.members.map((m) => (m.id === memberId ? { ...m, ...updated } : m)),
    })),
  )
}

export function guestRemoveMember(memberId: string) {
  saveGroups(
    guestFetchGroups().map((g) => ({
      ...g,
      members: g.members.filter((m) => m.id !== memberId),
    })),
  )
}

// ── Transactions ──────────────────────────────────────────

export function guestFetchTransactions(groupId: string): Transaction[] {
  return read<Transaction[]>(TXS_KEY, [])
    .filter((t) => t.groupId === groupId)
    .sort((a, b) => b.createdAt - a.createdAt)
}

/** Total transactions stored across all guest groups (for the limit check). */
export function guestTransactionCount(): number {
  return read<Transaction[]>(TXS_KEY, []).length
}

export function guestInsertTransaction(tx: Transaction) {
  write(TXS_KEY, [tx, ...read<Transaction[]>(TXS_KEY, [])])
}

export function guestUpdateTransaction(tx: Transaction) {
  write(
    TXS_KEY,
    read<Transaction[]>(TXS_KEY, []).map((t) => (t.id === tx.id ? { ...t, ...tx } : t)),
  )
}

export function guestDeleteTransaction(txId: string) {
  write(
    TXS_KEY,
    read<Transaction[]>(TXS_KEY, []).filter((t) => t.id !== txId),
  )
}

export function guestSettleAll(groupId: string) {
  write(
    TXS_KEY,
    read<Transaction[]>(TXS_KEY, []).map((t) => (t.groupId === groupId ? { ...t, settled: true } : t)),
  )
}
