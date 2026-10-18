// Tiny SVG line for price sparklines (lighter than a Recharts chart per card).
export default function Sparkline({ data, width = 96, height = 28, className = '' }) {
  if (!data?.length) return <svg width={width} height={height} />
  const min = Math.min(...data)
  const max = Math.max(...data)
  const span = max - min || 1
  const step = data.length > 1 ? width / (data.length - 1) : 0
  const points = data
    .map((v, i) => `${(i * step).toFixed(1)},${(height - 2 - ((v - min) / span) * (height - 4)).toFixed(1)}`)
    .join(' ')
  const up = data[data.length - 1] >= data[0]
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className} aria-hidden="true">
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        className={up ? 'text-utility-green-500' : 'text-utility-red-500'}
      />
    </svg>
  )
}
