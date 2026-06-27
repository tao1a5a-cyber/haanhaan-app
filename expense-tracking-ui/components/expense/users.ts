import { THEMES } from "./themes"
import type { Member } from "./types"

// Member/Group are the domain model now — re-export for convenient imports.
export type { Member, Group } from "./types"

/**
 * Defaults for a newly-created member, cycling through the theme palette so
 * each member gets a distinct pastel tint + matching theme.
 */
export function memberDefaults(index: number): { tint: string; themeId: string } {
  const theme = THEMES[index % THEMES.length]
  return { tint: theme.tint, themeId: theme.id }
}

/** First grapheme of a name, for the fallback avatar chip. */
export function initialOf(name: string): string {
  return name.trim().charAt(0) || "?"
}

/**
 * Whether an avatar is a user-uploaded photo (already cropped to a circle, so it
 * should fill the frame with object-cover) versus a bundled illustration that
 * lives under /avatars/ and is shown small over the tint background.
 */
export function isCustomAvatar(avatar: string | undefined | null): boolean {
  if (!avatar) return false
  if (avatar.startsWith("/avatars/")) return false
  if (avatar.endsWith("/placeholder.svg")) return false
  return true
}

/** Whether a member has any avatar image at all (photo or bundled illustration). */
export function hasAvatarImage(member: Pick<Member, "avatar">): boolean {
  return Boolean(member.avatar && !member.avatar.endsWith("/placeholder.svg"))
}
