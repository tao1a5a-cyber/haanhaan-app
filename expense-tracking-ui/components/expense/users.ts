export type User = {
  id: string
  name: string
  initial: string
  avatar: string
  /** soft tile background tint for the profile picker card */
  tint: string
  /** id of the active ThemePreset — undefined means default (amber) */
  themeId?: string
}

export const USERS: User[] = [
  {
    id: "tao",
    name: "เตา",
    initial: "ต",
    avatar: "/avatars/bear.png",
    tint: "oklch(0.93 0.05 70)",
    themeId: "amber",
  },
  {
    id: "ice",
    name: "ไอซ์",
    initial: "อ",
    avatar: "/avatars/ice.png",
    tint: "oklch(0.93 0.05 195)",
    themeId: "teal",
  },
]

export function partnerOf(userId: string): User {
  return USERS.find((u) => u.id !== userId) ?? USERS[0]
}
