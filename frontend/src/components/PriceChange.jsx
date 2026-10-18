// Green/red % change with a trend icon — same style on the dashboard and the ticker page.
import { TrendDown01, TrendUp01 } from '@untitledui/icons'
import { fmtPct } from '../lib/ui.js'

const SIZES = {
  sm: { text: 'text-sm', icon: 'size-4' },
  md: { text: 'text-md', icon: 'size-4' },
  lg: { text: 'text-lg', icon: 'size-5' },
}

export default function PriceChange({ value, size = 'sm', className = '' }) {
  if (value == null) return <span className={`${SIZES[size].text} text-quaternary ${className}`}>—</span>
  const up = value >= 0
  const Icon = up ? TrendUp01 : TrendDown01
  return (
    <span className={`inline-flex items-center gap-1 font-semibold tabular-nums whitespace-nowrap ${SIZES[size].text} ${up ? 'text-emerald-600' : 'text-rose-600'} ${className}`}>
      <Icon className={SIZES[size].icon} aria-hidden="true" />
      {fmtPct(value)}
    </span>
  )
}
