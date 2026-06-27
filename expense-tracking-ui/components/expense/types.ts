import type { SplitMode } from "./categories"

/** A person inside a group. */
export type Member = {
  id: string
  groupId: string
  /** Supabase Auth user id this member belongs to (undefined = placeholder member) */
  userId?: string
  name: string
  /** Supabase Storage public URL, or "" when the member has no photo yet. */
  avatar: string
  /** pastel background color (oklch string) */
  tint: string
  /** id of the active ThemePreset — undefined means default (amber) */
  themeId?: string
  /** salt used when hashing this member's PIN (defaults to the member id) */
  pinSalt?: string
}

/** A shared ledger with its own members. */
export type Group = {
  id: string
  name: string
  members: Member[]
  /** Supabase Storage public URL for the group image, or "" when none. */
  avatar?: string
  /** auth user id of the creator (Host) */
  hostUserId?: string
  /** unique token used to build the shareable invite link */
  inviteToken?: string
}

export type Transaction = {
  id: string
  groupId: string
  /** member id of who paid */
  payerId: string
  amount: number
  detail: string
  categoryId: string
  split: SplitMode
  /** memberId → portion of `amount` that member owes; sum(shares) === amount.
   *  Debt of member m to the payer = shares[m] for m !== payerId. */
  shares: Record<string, number>
  settled?: boolean
  createdAt: number
  hasSlip?: boolean
  /** Displayable image URL: a signed URL (Supabase), object/data URL (local), or "" */
  slipUrl?: string
  /** Storage path inside the private 'slips' bucket — what we persist to the DB. */
  slipPath?: string
}
