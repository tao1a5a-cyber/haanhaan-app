import { Ellipsis } from "lucide-react"
import type { Category } from "./categories"

export function CategoryGlyph({
  category,
  size = 20,
}: {
  category: Category
  size?: number
}) {
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
