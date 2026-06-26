import { tryGetSupabase } from "./supabase"
import { makeCustomCategory, type Transaction, type Category } from "@/components/expense/categories"
import type { User } from "@/components/expense/users"

// ── Profiles ──────────────────────────────────────────────

export type ProfileRow = Partial<User> & { pinHash?: string }

export async function fetchProfile(userId: string): Promise<ProfileRow | null> {
  const db = tryGetSupabase()
  if (!db) return null

  const { data, error } = await db
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle()

  if (error) { console.error("fetchProfile", error); return null }
  if (!data) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = data as any
  return {
    ...(row.name ? { name: row.name } : {}),
    ...(row.tint ? { tint: row.tint } : {}),
    ...(row.theme_id ? { themeId: row.theme_id } : {}),
    ...(row.avatar_url ? { avatar: row.avatar_url } : {}),
    ...(row.pin_hash ? { pinHash: row.pin_hash } : {}),
  }
}

export async function upsertProfile(
  userId: string,
  updated: Partial<User>,
  pinHash?: string,
) {
  const db = tryGetSupabase()
  if (!db) return

  const { error } = await db.from("profiles").upsert({
    user_id: userId,
    ...(updated.name !== undefined ? { name: updated.name } : {}),
    ...(updated.tint !== undefined ? { tint: updated.tint } : {}),
    ...(updated.themeId !== undefined ? { theme_id: updated.themeId } : {}),
    ...(updated.avatar !== undefined ? { avatar_url: updated.avatar } : {}),
    ...(pinHash !== undefined ? { pin_hash: pinHash } : {}),
    updated_at: new Date().toISOString(),
  })
  if (error) console.error("upsertProfile", error)
}

// ── Transactions ──────────────────────────────────────────

export async function fetchTransactions(): Promise<Transaction[]> {
  const db = tryGetSupabase()
  if (!db) return []

  const { data, error } = await db
    .from("transactions")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) { console.error("fetchTransactions", error); return [] }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => ({
    id: row.id,
    payerId: row.payer_id,
    detail: row.detail,
    amount: row.amount,
    owed: row.owed,
    categoryId: row.category_id,
    split: row.split as Transaction["split"],
    settled: row.settled,
    createdAt: new Date(row.created_at).getTime(),
  }))
}

export async function insertTransaction(tx: Transaction) {
  const db = tryGetSupabase()
  if (!db) return

  const { error } = await db.from("transactions").insert({
    id: tx.id,
    payer_id: tx.payerId,
    detail: tx.detail,
    amount: tx.amount,
    owed: tx.owed,
    category_id: tx.categoryId,
    split: tx.split,
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
      owed: tx.owed,
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

export async function settleAllTransactions() {
  const db = tryGetSupabase()
  if (!db) return

  const { error } = await db
    .from("transactions")
    .update({ owed: 0, settled: true })
    .eq("settled", false)
  if (error) console.error("settleAllTransactions", error)
}

// ── Custom categories ─────────────────────────────────────

export async function fetchCustomCategories(): Promise<Category[]> {
  const db = tryGetSupabase()
  if (!db) return []

  const { data, error } = await db
    .from("custom_categories")
    .select("*")
    .order("sort_order", { ascending: true })

  if (error) { console.error("fetchCustomCategories", error); return [] }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any, i: number) =>
    makeCustomCategory(row.label, row.emoji, i),
  )
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
