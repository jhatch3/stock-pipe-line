// Sticky right-rail cards for the ticker page: key stats and daily technical signals.
// `daily` is computeIndicators() output over ~1.5 years of daily bars (ascending).
// UI: Untitled UI badges — https://www.untitledui.com/react/components/badges
import { Badge } from '@/components/base/badges/badges'
import { formatValue } from '../lib/constants.js'
import { CARD, fmtPrice } from '../lib/ui.js'

const YEAR_BARS = 252

function RailCard({ title, subtitle, children, large }) {
  return (
    <section className={`${CARD} p-5`}>
      <h2 className={`${large ? 'text-lg' : 'text-md'} font-semibold text-primary`}>{title}</h2>
      {subtitle && <p className="text-xs text-tertiary">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}

function Row({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 text-sm">
      <span className="text-tertiary">{label}</span>
      <span className="font-medium text-primary tabular-nums">{children}</span>
    </div>
  )
}

const back = (closes, n) => (closes.length > n ? closes[closes.length - 1] / closes[closes.length - 1 - n] - 1 : null)

// ── Key stats ────────────────────────────────────────────────────────────────
export function KeyStats({ daily, features }) {
  if (!daily.length) return null
  const year = daily.slice(-YEAR_BARS)
  const last = daily[daily.length - 1]
  const hi = Math.max(...year.map(r => Number(r.high)))
  const lo = Math.min(...year.map(r => Number(r.low)))
  const pos = hi > lo ? ((last.close - lo) / (hi - lo)) * 100 : 50
  const closes = daily.map(r => Number(r.close))

  const thisYear = new Date(last.timestamp).getUTCFullYear()
  const ytdBase = daily.findLast(r => new Date(r.timestamp).getUTCFullYear() < thisYear)?.close
  const perf = [
    ['1W', back(closes, 5)],
    ['1M', back(closes, 21)],
    ['3M', back(closes, 63)],
    ['YTD', ytdBase ? last.close / ytdBase - 1 : null],
    ['1Y', back(closes, YEAR_BARS)],
  ]

  const vols = daily.slice(-31, -1).map(r => Number(r.volume))
  const avgVol = vols.length ? vols.reduce((a, b) => a + b, 0) / vols.length : null
  const fmtVol = v => (v >= 1e9 ? `${(v / 1e9).toFixed(2)}B` : v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : `${(v / 1e3).toFixed(0)}K`)

  return (
    <RailCard title="Key stats">
      <p className="mb-2 text-xs font-medium text-tertiary">52-week range</p>
      <div className="relative h-1.5 rounded-full bg-secondary">
        <div className="absolute inset-y-0 left-0 rounded-full bg-brand-solid" style={{ width: `${pos}%` }} />
        <div className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary ring-2 ring-brand"
          style={{ left: `${pos}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between text-xs text-tertiary tabular-nums">
        <span>{fmtPrice(lo)}</span>
        <span>{((last.close / hi - 1) * 100).toFixed(1)}% from high</span>
        <span>{fmtPrice(hi)}</span>
      </div>

      <div className="mt-4 grid grid-cols-5 gap-1 text-center">
        {perf.map(([label, v]) => (
          <div key={label} className="rounded-md bg-secondary px-1 py-2">
            <p className="text-xs text-tertiary">{label}</p>
            <p className={`text-xs font-semibold tabular-nums ${v == null ? 'text-quaternary' : v >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {v == null ? '—' : `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-3 divide-y divide-secondary">
        <Row label="Volume (last)">
          {fmtVol(Number(last.volume))}
          {avgVol ? <span className="ml-1.5 text-xs text-tertiary">{(last.volume / avgVol).toFixed(1)}× avg</span> : null}
        </Row>
        <Row label="Beta (vs. S&P 500)">{formatValue(features?.beta, 'number', 2)}</Row>
        <Row label="Volatility (ann.)">{formatValue(features?.volatility, 'percent', 1)}</Row>
        <Row label="P/E (TTM)">{formatValue(features?.pe_ratio, 'number', 1)}</Row>
        <Row label="EPS (TTM)">{formatValue(features?.eps, 'currency', 2)}</Row>
      </div>
    </RailCard>
  )
}

// ── Daily signals ────────────────────────────────────────────────────────────
const TONE = { bull: ['success', 'Bullish'], bear: ['error', 'Bearish'], neutral: ['gray', 'Neutral'] }

export function DailySignals({ daily }) {
  if (daily.length < 2) return null
  const t = daily[daily.length - 1]
  const p = Number(t.close)
  const pctb = t.bb_upper != null && t.bb_upper !== t.bb_lower ? (p - t.bb_lower) / (t.bb_upper - t.bb_lower) : null

  const signals = [
    { label: 'Price vs. SMA 50', value: t.sma50 && `${((p / t.sma50 - 1) * 100).toFixed(1)}%`, tone: t.sma50 == null ? null : p > t.sma50 ? 'bull' : 'bear' },
    { label: 'Price vs. SMA 200', value: t.sma200 && `${((p / t.sma200 - 1) * 100).toFixed(1)}%`, tone: t.sma200 == null ? null : p > t.sma200 ? 'bull' : 'bear' },
    { label: 'SMA 50 vs. 200', value: t.sma200 && (t.sma50 > t.sma200 ? 'Golden cross' : 'Death cross'),
      tone: t.sma200 == null ? null : t.sma50 > t.sma200 ? 'bull' : 'bear' },
    { label: 'RSI (14)', value: t.rsi?.toFixed(1),
      tone: t.rsi == null ? null : t.rsi > 70 ? 'bear' : t.rsi < 30 ? 'bull' : 'neutral' },
    { label: 'MACD vs. signal', value: t.macd_hist != null && `${t.macd_hist >= 0 ? '+' : ''}${t.macd_hist.toFixed(2)}`,
      tone: t.macd_hist == null ? null : t.macd_hist > 0 ? 'bull' : 'bear' },
    { label: 'Bollinger %B', value: pctb != null && pctb.toFixed(2),
      tone: pctb == null ? null : pctb > 1 ? 'bear' : pctb < 0 ? 'bull' : 'neutral' },
  ].filter(s => s.tone)

  const bulls = signals.filter(s => s.tone === 'bull').length
  const bears = signals.filter(s => s.tone === 'bear').length

  return (
    <RailCard large title="Daily signals" subtitle={`${bulls} bullish · ${bears} bearish · from daily closes`}>
      <div className="mb-3 flex h-1.5 overflow-hidden rounded-full bg-secondary">
        <div className="bg-success-solid" style={{ width: `${(bulls / signals.length) * 100}%` }} />
        <div className="ml-auto bg-error-solid" style={{ width: `${(bears / signals.length) * 100}%` }} />
      </div>
      <div className="divide-y divide-secondary">
        {signals.map(s => (
          <div key={s.label} className="flex items-center justify-between gap-3 py-2 text-sm">
            <span className="text-tertiary">{s.label}</span>
            <span className="flex items-center gap-2">
              <span className="font-medium text-primary tabular-nums">{s.value}</span>
              <Badge type="color" size="sm" color={TONE[s.tone][0]}>{TONE[s.tone][1]}</Badge>
            </span>
          </div>
        ))}
      </div>
    </RailCard>
  )
}

