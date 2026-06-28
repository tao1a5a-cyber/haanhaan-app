import { isCustomAvatar, hasAvatarImage, initialOf } from "./users"
import type { Member } from "./types"

type Props = {
  member: Pick<Member, "name" | "avatar" | "tint">
  /** pixel size of the circle */
  size?: number
  className?: string
  /** how much of the circle a bundled illustration fills (percent, default 72) */
  illoFill?: number
}

/**
 * Renders a member's avatar consistently everywhere:
 *  - uploaded photo  → fills the circle (object-cover)
 *  - bundled /avatars illustration → small over the tint background
 *  - no image        → first initial centered on the tint background
 */
export function MemberAvatar({ member, size = 44, className = "", illoFill = 72 }: Props) {
  const custom = isCustomAvatar(member.avatar)
  const hasImage = hasAvatarImage(member)

  return (
    <span
      className={`relative grid shrink-0 place-items-center overflow-hidden rounded-full ${className}`}
      style={{ width: size, height: size, backgroundColor: custom ? undefined : member.tint }}
    >
      {hasImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={member.avatar}
          alt=""
          className={custom ? "absolute inset-0 size-full object-cover" : "object-contain"}
          style={custom ? undefined : { width: `${illoFill}%`, height: `${illoFill}%` }}
        />
      ) : (
        <span
          className="font-bold leading-none text-foreground/80"
          style={{ fontSize: size * 0.42 }}
        >
          {initialOf(member.name)}
        </span>
      )}
    </span>
  )
}
