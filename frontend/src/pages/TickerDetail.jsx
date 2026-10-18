// UI: Untitled UI buttons, badges, tables —
//   https://www.untitledui.com/react/components/buttons
//   https://www.untitledui.com/react/components/tables
import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Inbox01, SwitchHorizontal01 } from '@untitledui/icons'
import { Button } from '@/components/base/buttons/button'
import { supabase } from '../lib/supabase.js'
import { CARD, fmtPrice } from '../lib/ui.js'
import { computeIndicators } from '../lib/indicators.js'
import SectorBadge from '../components/SectorBadge.jsx'
import PriceChange from '../components/PriceChange.jsx'
import PriceChart from '../components/PriceChart.jsx'
import AgentPanel from '../components/AgentPanel.jsx'
import NewsFeed from '../components/NewsFeed.jsx'
import MetricsTables from '../components/MetricsTables.jsx'
import SectorCompareTable from '../components/SectorCompareTable.jsx'
import { RsiGauge, RankRings, SectorRadar, ValuationBars } from '../components/TickerVisuals.jsx'
import { KeyStats, DailySignals } from '../components/TickerSidebar.jsx'

function formatTimestamp(ts) {
  if (!ts) return null
  try {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
    }).format(new Date(ts))
  } catch { return ts }
}

function Card({ title, subtitle, className = '', children }) {
  return (
    <section className={`${CARD} p-5 ${className}`}>
      <h2 className="text-lg font-semibold text-primary">{title}</h2>
      {subtitle && <p className="text-sm text-tertiary">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}

export default function TickerDetail() {
  const { symbol } = useParams()

  const [ticker,         setTicker]         = useState(null)
  const [features,       setFeatures]       = useState(null)
  const [bars,           setBars]           = useState([])
  const [sectorFeatures, setSectorFeatures] = useState([])
  const [loading,        setLoading]        = useState(true)
  const [error,          setError]          = useState(null)

  // ── Main data fetch ──────────────────────────────────────────────────────
  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      setError(null)
      setSectorFeatures([])

      const [
        { data: tickerData, error: tickerError },
        { data: featuresData },
        { data: dailyRows },
      ] = await Promise.all([
        supabase.from('tickers').select('*').eq('symbol', symbol).single(),
        supabase.from('stock_features').select('*').eq('ticker', symbol).eq('interval', '1h')
          .order('timestamp', { ascending: false }).limit(1).maybeSingle(),
        // ~1.5 years of daily bars: price, 52-week range and daily signals (SMA 200 needs warmup)
        supabase.from('stock_clean_data_yf').select('timestamp,open,high,low,close,volume').eq('ticker', symbol)
          .eq('interval', '1d').gte('timestamp', new Date(Date.now() - 550 * 864e5).toISOString())
          .order('timestamp', { ascending: true }),
      ])

      if (tickerError || !tickerData) {
        setError(`Ticker "${symbol}" not found.`)
        setLoading(false)
        return
      }
      setTicker(tickerData)
      setFeatures(featuresData ?? null)
      setBars(dailyRows ?? [])
      setLoading(false)
    }
    fetchData()
  }, [symbol])

  // ── Latest feature row for every stock in the sector (peer comparisons) ──
  useEffect(() => {
    if (!ticker?.sector) return
    async function fetchSectorFeatures() {
      const { data: tickerRows } = await supabase
        .from('tickers').select('symbol').eq('sector', ticker.sector)
      if (!tickerRows?.length) return
      const { data: featRows } = await supabase
        .from('stock_features').select('*')
        .in('ticker', tickerRows.map(t => t.symbol)).eq('interval', '1h')
        .order('timestamp', { ascending: false })
      if (!featRows) return
      const seen = new Set()
      setSectorFeatures(featRows.filter(r => !seen.has(r.ticker) && seen.add(r.ticker)))
    }
    fetchSectorFeatures()
  }, [ticker?.sector])

  const daily = useMemo(() => (bars.length ? computeIndicators(bars) : []), [bars])

  // ── Loading / error ──────────────────────────────────────────────────────
  if (loading) return (
    <div className="mx-auto max-w-container px-4 py-8 md:px-8">
      <div className="mb-6 h-10 w-64 animate-pulse rounded-lg bg-secondary" />
      <div className="grid gap-6">
        {[0, 1, 2].map(i => <div key={i} className={`${CARD} h-64 animate-pulse`} />)}
      </div>
    </div>
  )

  if (error) return (
    <div className="flex flex-col items-center justify-center px-4 py-32 text-center">
      <AlertTriangle className="mb-4 size-12 text-fg-warning-primary" aria-hidden="true" />
      <p className="text-lg font-medium text-primary">{error}</p>
      <Button className="mt-6" size="md" color="secondary" iconLeading={ArrowLeft} href="/">Back to dashboard</Button>
    </div>
  )

  const lastUpdated = features?.timestamp ? formatTimestamp(features.timestamp) : null
  const close       = bars.at(-1)?.close ?? null
  const prevClose   = bars.at(-2)?.close ?? null
  const change      = close != null && prevClose ? close - prevClose : null
  const changeFrac  = change !== null ? change / prevClose : null
  const peers       = sectorFeatures

  return (
    <div className="flex flex-col xl:flex-row">

      {/* ── Main feed ─────────────────────────────────────────────────────── */}
      <div className="min-w-0 flex-1 bg-secondary px-4 py-6 md:px-8 xl:min-h-[calc(100dvh-4rem)]">
        <div className="mx-auto flex max-w-6xl flex-col gap-6">

          {/* Title + price */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm" color="link-gray" iconLeading={ArrowLeft} href="/">Dashboard</Button>
              <div className="h-5 w-px bg-border-primary" />
              <h1 className="text-display-xs font-semibold text-primary">{ticker?.symbol}</h1>
              {ticker?.name && <span className="hidden text-lg text-tertiary sm:block">{ticker.name}</span>}
              <SectorBadge sector={ticker?.sector} size="md" />
              <div className="ml-auto flex items-center gap-3">
                {lastUpdated && <span className="hidden text-xs text-quaternary md:block">Features updated {lastUpdated}</span>}
                <Button size="sm" color="secondary" iconLeading={SwitchHorizontal01} href={`/compare?tickers=${symbol}`}>Compare</Button>
              </div>
            </div>
            <div className="flex flex-wrap items-baseline gap-3">
              <span className="text-display-md font-semibold text-primary tabular-nums">{fmtPrice(close)}</span>
              {change !== null && (
                <span className="flex items-baseline gap-2">
                  <PriceChange value={changeFrac} size="lg" />
                  <span className={`text-md font-medium tabular-nums ${change >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    ({change >= 0 ? '+' : ''}{change.toFixed(2)})
                  </span>
                </span>
              )}
              <span className="text-xs text-quaternary">daily close · 1D change</span>
            </div>
          </div>

          <PriceChart ticker={symbol} />
          <AgentPanel ticker={symbol} />

          {!features ? (
            <div className={`${CARD} flex flex-col items-center justify-center py-16 text-center`}>
              <Inbox01 className="mb-3 size-10 text-fg-quaternary" aria-hidden="true" />
              <p className="text-lg font-medium text-primary">No feature data yet</p>
              <p className="mt-1 text-sm text-tertiary">
                Run <code className="rounded bg-secondary px-1">python -m pipelines.features --run {symbol}</code> to compute it.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <Card title="RSI (14)" subtitle="Momentum: below 30 oversold, above 70 overbought">
                  <RsiGauge value={features.rsi} />
                </Card>
                <DailySignals daily={daily} />
              </div>

              <Card title="Sector percentile"
                subtitle={`Share of ${Math.max(peers.length - 1, 0)} ${ticker?.sector ?? ''} peers this stock beats (100 = best)`}>
                <RankRings peers={peers} symbol={symbol} />
              </Card>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <Card title="Profile vs. sector" subtitle="Percentile on each metric; dashed ring is the sector median">
                  <SectorRadar peers={peers} symbol={symbol} />
                </Card>
                <Card title="Valuation vs. sector" subtitle="Multiples compared with the sector median">
                  <ValuationBars peers={peers} symbol={symbol} />
                </Card>
              </div>

              <MetricsTables features={features} peers={peers} symbol={symbol} />
            </>
          )}

          {ticker?.sector && <SectorCompareTable symbol={symbol} sector={ticker.sector} peers={peers} />}
        </div>
      </div>

      {/* ── Right rail: pinned to the window's right edge, scrolls on its own ── */}
      <aside className="flex shrink-0 flex-col divide-y divide-secondary border-t border-secondary bg-primary
        xl:sticky xl:top-16 xl:h-[calc(100dvh-4rem)] xl:w-96 xl:overflow-y-auto xl:border-t-0 xl:border-l">
        <KeyStats daily={daily} features={features} flat />
        <NewsFeed ticker={symbol} flat />
      </aside>
    </div>
  )
}
