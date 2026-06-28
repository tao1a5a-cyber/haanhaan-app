import type { Group } from "./types"

type Props = {
  group: Pick<Group, "name" | "avatar">
  /** pixel diameter of the circle */
  size?: number
  className?: string
}

/**
 * Renders a group's image as a perfect circle — its uploaded photo, or the
 * first character of its name on a soft accent background as a fallback.
 */
export function GroupAvatar({ group, size = 40, className = "" }: Props) {
  const hasImage = Boolean(group.avatar)

  return (
    <span
      className={`relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-accent/12 text-accent ${className}`}
      style={{ width: size, height: size }}
    >
      {hasImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={group.avatar} alt="" className="absolute inset-0 size-full object-cover" />
      ) : (
        <span className="font-bold leading-none" style={{ fontSize: size * 0.42 }}>
          {group.name.trim().charAt(0) || "?"}
        </span>
      )}
    </span>
  )
}
