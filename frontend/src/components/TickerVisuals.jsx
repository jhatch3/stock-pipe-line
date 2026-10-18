// Visual summaries for the ticker page, styled with Untitled UI tokens.
// UI: Untitled UI chart styling — https://www.untitledui.com/react/components/charts
import {
  Bar, BarChart, CartesianGrid, Legend, PolarAngleAxis, PolarGrid, Radar, RadarChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { ChartLegendContent, ChartTooltipContent } from '@/components/application/charts/charts-base'
import { median, percentile } from '../lib/peers.js'

// Metrics compared against sector peers. higherBetter decides the percentile direction.
export const PEER_METRICS = [
  { key: 'sharpe_ratio',  label: 'Sharpe',         higherBetter: true  },
  { key: 'sortino_ratio', label: 'Sortino',        higherBetter: true  },
  { key: 'volatility',    label: 'Low volatility', higherBetter: false },
  { key: 'max_drawdown',  label: 'Drawdown',       higherBetter: true  },
  { key: 'roe',           label: 'ROE',            higherBetter: true  },
  { key: 'pe_ratio',      label: 'Cheap P/E',      higherBetter: false },
]

const VALUATION = [
  { key: 'pe_ratio',  label: 'P/E' },
  { key: 'pb_ratio',  label: 'P/B' },
  { key: 'ps_ratio',  label: 'P/S' },
  { key: 'ev_ebitda', label: 'EV/EBITDA' },
]

const chartClass = 'text-tertiary [&_.recharts-text]:text-xs'

// ── RSI gauge ───────────────────────────────────────────────────────────────
const CX = 100, CY = 96, R = 76
const pt = (v, r = R) => {
  const a = Math.PI * (1 - v / 100)
  return [CX + r * Math.cos(a), CY - r * Math.sin(a)]
}
const arc = (from, to) => {
  const [x1, y1] = pt(from)
  const [x2, y2] = pt(to)
  return `M ${x1} ${y1} A ${R} ${R} 0 0 1 ${x2} ${y2}`
}

export function RsiGauge({ value }) {
  const v = value == null ? null : Math.max(0, Math.min(100, value))
  const zone = v == null ? null : v > 70 ? 'Overbought' : v < 30 ? 'Oversold' : 'Neutral'
  const zoneClass = v == null ? 'text-tertiary' : v > 70 ? 'text-error-primary' : v < 30 ? 'text-success-primary' : 'text-tertiary'
  const [nx, ny] = pt(v ?? 50, R - 14)
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 110" className="w-full max-w-64" role="img" aria-label={`RSI ${v?.toFixed(1) ?? 'unavailable'}`}>
        <path d={arc(0, 30)} stroke="currentColor" className="text-utility-green-400" strokeWidth="14" fill="none" />
        <path d={arc(30, 70)} stroke="currentColor" className="text-utility-neutral-200" strokeWidth="14" fill="none" />
        <path d={arc(70, 100)} stroke="currentColor" className="text-utility-red-400" strokeWidth="14" fill="none" />
        {v != null && (
          <>
            <line x1={CX} y1={CY} x2={nx} y2={ny} stroke="currentColor" className="text-fg-primary" strokeWidth="3" strokeLinecap="round" />
            <circle cx={CX} cy={CY} r="5" fill="currentColor" className="text-fg-primary" />
          </>
        )}
        {[0, 30, 70, 100].map(t => {
          const [x, y] = pt(t, R + 14)
          return <text key={t} x={x} y={y + 3} textAnchor="middle" fill="currentColor" className="text-quaternary text-[9px]">{t}</text>
        })}
      </svg>
      <p className="-mt-1 text-display-xs font-semibold text-primary tabular-nums">{v == null ? '—' : v.toFixed(1)}</p>
      <p className={`text-sm font-medium ${zoneClass}`}>{zone ?? 'No data'}</p>
    </div>
  )
}

// ── Sector-rank rings ───────────────────────────────────────────────────────
function Ring({ pct, label }) {
  const r = 26, c = 2 * Math.PI * r
  const color = pct == null ? 'text-utility-neutral-300'
    : pct >= 67 ? 'text-utility-green-500' : pct >= 33 ? 'text-utility-yellow-500' : 'text-utility-red-500'
  return (
    <div className="flex flex-col items-center gap-1.5 text-center">
      <div className="relative size-16">
        <svg viewBox="0 0 64 64" className="size-16 -rotate-90" aria-hidden="true">
          <circle cx="32" cy="32" r={r} fill="none" stroke="currentColor" strokeWidth="6" className="text-utility-neutral-100" />
          {pct != null && (
            <circle cx="32" cy="32" r={r} fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round"
              strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} className={color} />
          )}
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-primary tabular-nums">
          {pct == null ? '—' : Math.round(pct)}
        </span>
      </div>
      <span className="text-xs font-medium text-tertiary">{label}</span>
    </div>
  )
}

export function RankRings({ peers, symbol }) {
  return (
    <div className="grid grid-cols-3 gap-y-5 sm:grid-cols-6">
      {PEER_METRICS.map(m => (
        <Ring key={m.key} label={m.label} pct={percentile(peers, symbol, m.key, m.higherBetter)} />
      ))}
    </div>
  )
}

// ── Radar vs. sector median ─────────────────────────────────────────────────
export function SectorRadar({ peers, symbol }) {
  const data = PEER_METRICS.map(m => ({
    metric: m.label,
    Stock: Math.round(percentile(peers, symbol, m.key, m.higherBetter) ?? 0),
    'Sector median': 50,
  }))
  return (
    <ResponsiveContainer width="100%" height={300}>
      <RadarChart data={data} outerRadius="72%" className={chartClass}>
        <PolarGrid stroke="currentColor" className="text-utility-neutral-200" />
        <PolarAngleAxis dataKey="metric" fill="currentColor" />
        <Tooltip content={<ChartTooltipContent />} formatter={v => `${v}th percentile`} />
        <Legend verticalAlign="bottom" content={<ChartLegendContent />} />
        <Radar dataKey="Sector median" stroke="currentColor" fill="none" strokeDasharray="4 3"
          className="text-utility-neutral-400" isAnimationActive={false} />
        <Radar dataKey="Stock" stroke="currentColor" fill="currentColor" fillOpacity={0.25} strokeWidth={2}
          className="text-utility-brand-600" />
      </RadarChart>
    </ResponsiveContainer>
  )
}

// ── Valuation vs. sector median ─────────────────────────────────────────────
export function ValuationBars({ peers, symbol }) {
  const me = peers.find(r => r.ticker === symbol) ?? {}
  const data = VALUATION.map(m => ({
    metric: m.label,
    [symbol]: me[m.key] ?? null,
    'Sector median': median(peers, m.key),
  }))
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }} className={chartClass}>
        <CartesianGrid vertical={false} stroke="currentColor" className="text-utility-neutral-100" />
        <XAxis dataKey="metric" axisLine={false} tickLine={false} fill="currentColor" />
        <YAxis axisLine={false} tickLine={false} fill="currentColor" width={40} tickFormatter={v => v.toFixed(0)} />
        <Tooltip content={<ChartTooltipContent />} formatter={v => (v == null ? '—' : Number(v).toFixed(2))}
          cursor={{ className: 'fill-utility-neutral-50' }} />
        <Legend verticalAlign="top" align="right" content={<ChartLegendContent />} />
        <Bar dataKey={symbol} fill="currentColor" className="text-utility-brand-600" radius={[4, 4, 0, 0]} maxBarSize={28} />
        <Bar dataKey="Sector median" fill="currentColor" className="text-utility-neutral-300" radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  )
}
