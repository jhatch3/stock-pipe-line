import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { FEATURE_SECTIONS, SECTOR_STYLES } from '../lib/constants.js'
import Header from '../components/Header.jsx'
import FeatureSection from '../components/FeatureSection.jsx'
import PriceChart from '../components/PriceChart.jsx'
import SectorCompareTable from '../components/SectorCompareTable.jsx'
import AgentPanel from '../components/AgentPanel.jsx'

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function SkeletonSection() {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden animate-pulse">
      <div className="h-14 bg-gray-100" />
      <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-gray-100 rounded-xl p-3 h-14" />
        ))}
      </div>
    </div>
  )
}

function formatTimestamp(ts) {
  if (!ts) return null
  try {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
    }).format(new Date(ts))
  } catch { return ts }
}

// ─── Ticker Detail Page ───────────────────────────────────────────────────────
export default function TickerDetail() {
  const { symbol } = useParams()
  const navigate   = useNavigate()

  const [tickers,        setTickers]        = useState([])
  const [ticker,         setTicker]         = useState(null)
  const [features,       setFeatures]       = useState(null)
  const [price,          setPrice]          = useState(null)
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
        { data: allTickers },
        { data: tickerData, error: tickerError },
        { data: featuresData },
        { data: priceRows },
      ] = await Promise.all([
        supabase.from('tickers').select('symbol,name,sector').order('symbol'),
        supabase.from('tickers').select('*').eq('symbol', symbol).single(),
        supabase.from('stock_features').select('*').eq('ticker', symbol).eq('interval', '1h')
          .order('timestamp', { ascending: false }).limit(1).single(),
        supabase.from('stock_clean_data_yf').select('close,timestamp').eq('ticker', symbol)
          .eq('interval', '1d').order('timestamp', { ascending: false }).limit(2),
      ])

      if (allTickers) setTickers(allTickers)

      if (tickerError || !tickerData) {
        setError(`Ticker "${symbol}" not found.`)
        setLoading(false)
        return
      }
      setTicker(tickerData)
      setFeatures(featuresData ?? null)

      if (priceRows?.length) {
        setPrice({
          close:      priceRows[0].close,
          prev_close: priceRows[1]?.close ?? null,
          timestamp:  priceRows[0].timestamp,
        })
      }

      setLoading(false)
    }
    fetchData()
  }, [symbol])

  // ── Sector features for ranking ──────────────────────────────────────────
  useEffect(() => {
    if (!ticker?.sector) return
    async function fetchSectorFeatures() {
      const { data: tickerRows } = await supabase
        .from('tickers').select('symbol').eq('sector', ticker.sector)
      if (!tickerRows?.length) return
      const symbols = tickerRows.map(t => t.symbol)
      const { data: featRows } = await supabase
        .from('stock_features').select('*')
        .in('ticker', symbols).eq('interval', '1h')
        .order('timestamp', { ascending: false })
      if (!featRows) return
      const seen = new Set()
      setSectorFeatures(featRows.filter(r => {
        if (seen.has(r.ticker)) return false
        seen.add(r.ticker)
        return true
      }))
    }
    fetchSectorFeatures()
  }, [ticker?.sector])

  // ── Compute per-field sector ranks ───────────────────────────────────────
  const sectorRanks = useMemo(() => {
    if (!sectorFeatures.length) return {}
    const ranks = {}
    const allFields = FEATURE_SECTIONS.flatMap(s => s.fields)
    for (const field of allFields) {
      if (field.higherBetter === null || field.higherBetter === undefined) continue
      const peers = sectorFeatures.filter(r => r[field.key] != null)
      if (peers.length < 2) continue
      const me = sectorFeatures.find(r => r.ticker === symbol)
      if (!me || me[field.key] == null) continue
      const sorted = [...peers].sort((a, b) =>
        field.higherBetter ? b[field.key] - a[field.key] : a[field.key] - b[field.key]
      )
      const pos = sorted.findIndex(r => r.ticker === symbol) + 1
      ranks[field.key] = { rank: pos, total: peers.length }
    }
    return ranks
  }, [sectorFeatures, symbol])

  // ── Loading / error ──────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-white">
      <Header tickers={tickers} onSelectTicker={sym => navigate(`/ticker/${sym}`)} />
      <div className="sticky top-14 z-40 bg-white border-b border-gray-200">
        <div className="max-w-screen-xl mx-auto px-4 py-4 flex items-center gap-4 animate-pulse">
          <div className="h-8 w-20 bg-gray-200 rounded" />
          <div className="h-8 w-24 bg-gray-200 rounded" />
        </div>
      </div>
      <main className="max-w-screen-xl mx-auto px-4 py-8 flex flex-col gap-5">
        {FEATURE_SECTIONS.map(s => <SkeletonSection key={s.id} />)}
      </main>
    </div>
  )

  if (error) return (
    <div className="min-h-screen bg-white">
      <Header tickers={tickers} onSelectTicker={sym => navigate(`/ticker/${sym}`)} />
      <div className="flex flex-col items-center justify-center py-32 text-gray-400">
        <span className="text-5xl mb-4">⚠️</span>
        <p className="text-lg font-medium text-gray-700">{error}</p>
        <button onClick={() => navigate('/')}
          className="mt-6 px-5 py-2 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-700 transition-colors">
          ← Back to Dashboard
        </button>
      </div>
    </div>
  )

  const sectorClass  = ticker?.sector ? (SECTOR_STYLES[ticker.sector] ?? 'bg-gray-100 text-gray-600') : null
  const lastUpdated  = features?.timestamp ? formatTimestamp(features.timestamp) : null
  const change       = price?.prev_close ? price.close - price.prev_close : null
  const changePct    = change !== null ? (change / price.prev_close) * 100 : null
  const up           = change === null ? true : change >= 0

  return (
    <div className="min-h-screen bg-white">
      <Header tickers={tickers} onSelectTicker={sym => navigate(`/ticker/${sym}`)} />

      {/* Sticky sub-header */}
      <div className="sticky top-14 z-40 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-screen-xl mx-auto px-4 py-3 flex flex-wrap items-center gap-3">
          <button onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors font-medium">
            ← Back
          </button>
          <div className="w-px h-5 bg-gray-300" />
          <span className="text-2xl font-extrabold text-gray-900 tracking-tight">{ticker?.symbol}</span>
          {ticker?.name && <span className="text-base text-gray-500 font-medium hidden sm:block">{ticker.name}</span>}
          {ticker?.sector && (
            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${sectorClass}`}>{ticker.sector}</span>
          )}
          <div className="ml-auto flex items-center gap-3">
            {lastUpdated && <span className="text-xs text-gray-400 hidden md:block">Updated {lastUpdated}</span>}
            <button onClick={() => navigate(`/compare?tickers=${symbol}`)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-600 transition-colors">
              ⇄ Compare
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-screen-xl mx-auto px-4 py-8">

        {/* AI Analysis — top of page */}
        <div className="mb-6">
          <AgentPanel ticker={symbol} />
        </div>

        {/* Price hero strip */}
        <div className="flex flex-wrap items-baseline gap-3 mb-4 px-1">
          <span className="text-5xl font-extrabold text-gray-900 tracking-tight tabular-nums">
            {price
              ? `$${Number(price.close).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : '—'}
          </span>
          {changePct !== null && (
            <span className={`flex items-center gap-1.5 text-lg font-semibold ${up ? 'text-emerald-600' : 'text-rose-600'}`}>
              <span>{up ? '▲' : '▼'}</span>
              <span>{up ? '+' : ''}{Number(change).toFixed(2)}</span>
              <span className="text-base font-medium opacity-80">({up ? '+' : ''}{changePct.toFixed(2)}%)</span>
            </span>
          )}
          <span className="text-xs text-gray-400 ml-1">daily close · 1d change</span>
        </div>

        {/* Full-width chart */}
        <div className="mb-6">
          <PriceChart ticker={symbol} sector={ticker?.sector} />
        </div>

        {/* Feature sections with sector ranks */}
        {!features ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-400">
            <span className="text-5xl mb-4">📭</span>
            <p className="text-lg font-medium text-gray-700">No features data yet</p>
            <p className="text-sm mt-1 text-gray-400">
              Run <code className="bg-gray-100 px-1 rounded">pipeline_features.py</code> to generate features for <strong>{symbol}</strong>.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {FEATURE_SECTIONS.map(section => (
              <FeatureSection key={section.id} section={section} data={features} ranks={sectorRanks} />
            ))}
          </div>
        )}

        {/* Sector comparison table */}
        {ticker?.sector && (
          <div className="mt-6">
            <SectorCompareTable symbol={symbol} sector={ticker.sector} />
          </div>
        )}
      </main>
    </div>
  )
}
