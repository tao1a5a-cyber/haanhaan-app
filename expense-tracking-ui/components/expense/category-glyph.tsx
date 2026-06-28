import { Ellipsis } from "lucide-react"
import type { Category } from "./categories"

export function CategoryGlyph({
  category,
  size = 20,
}: {
  category: Category
  size?: number
}) {
  if (category.image) {
    // Frameless illustrated icon — transparent PNG, scaled up to fill the chip.
    const s = Math.round(size * 1.7)
    return (
      <img
        src={category.image}
        alt=""
        width={s}
        height={s}
        style={{ width: s, height: s }}
        className="object-contain"
      />
    )
  }
  if (category.emoji) {
    return (
      <span style={{ fontSize: size * 0.95 }} className="leading-none">
        {category.emoji}
      </span>
    )
  }
  const Icon = category.icon ?? Ellipsis
  return <Icon style={{ width: size, height: size }} />
}
