type Slice = {
  label: string
  value: number
  color: string
}

/**
 * Lightweight SVG donut chart. Renders proportional arcs using
 * stroke-dasharray on stacked circles — no external dependency.
 */
export function DonutChart({
  slices,
  total,
  size = 180,
  thickness = 22,
}: {
  slices: Slice[]
  total: number
  size?: number
  thickness?: number
}) {
  const radius = (size - thickness) / 2
  const circumference = 2 * Math.PI * radius
  const center = size / 2

  let offset = 0

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* track */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="var(--secondary)"
          strokeWidth={thickness}
        />
        {total > 0 &&
          slices.map((s, i) => {
            const fraction = s.value / total
            const dash = fraction * circumference
            const gap = circumference - dash
            const circle = (
              <circle
                key={i}
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={s.color}
                strokeWidth={thickness}
                strokeDasharray={`${dash} ${gap}`}
                strokeDashoffset={-offset}
                strokeLinecap={fraction < 0.98 ? "round" : "butt"}
              />
            )
            offset += dash
            return circle
          })}
      </svg>
    </div>
  )
}
