/** Bundled goose profile avatars — shown in the "โปรไฟล์" wheel picker. */
export type AvatarChoice = { src: string; label: string }

export const avatarChoices: AvatarChoice[] = [
  { src: "/avatars/goose-pretty.png", label: "ห่านแต่งสวย" },
  { src: "/avatars/goose-rich.png", label: "ห่านคนรวย" },
  { src: "/avatars/goose-hero.png", label: "ห่านซุปเปอร์ฮีโร่" },
  { src: "/avatars/goose-spy.png", label: "ห่านสายลับ" },
  { src: "/avatars/goose-flashy.png", label: "ห่านฉูดฉาด" },
  { src: "/avatars/goose-angry.png", label: "ห่านโกรธ" },
  { src: "/avatars/goose-black.png", label: "ห่านดำ" },
  { src: "/avatars/goose-beggar.png", label: "ห่านยาจก" },
  { src: "/avatars/goose-introvert.png", label: "ห่าน introvert" },
]

export function avatarLabel(src: string | undefined | null): string | null {
  if (!src) return null
  return avatarChoices.find((a) => a.src === src)?.label ?? null
}
