import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { supabase } from '../lib/supabase.js'
import { FEATURE_SECTIONS, SECTOR_STYLES, formatValue } from '../lib/constants.js'
import Header from '../components/Header.jsx'

const COLORS = ['#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6']
const MAX_TICKERS = 5

const RANGES = [
  { label: '1W', days: 7 },
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: '1Y', days: 365 },
]

// Metrics to show in comparison table (one per section, most useful)
const COMPARE_METRICS = [
  { key: 'rsi',              label: 'RSI',                format: 'number',  decimals: 1 },
  { key: 'volatility',       label: 'Volatility',         format: 'percent', decimals: 2 },
  { key: 'sharpe_ratio',     label: 'Sharpe',             format: 'number',  decimals: 2 },
  { key: 'beta',             label: 'Beta',               format: 'number',  decimals: 2 },
  { key: 'alpha',            label: 'Alpha',              format: 'percent', decimals: 2 },
  { key: 'max_drawdown',     label: 'Max Drawdown',       format: 'percent', decimals: 2 },
  { key: 'pe_ratio',         label: 'P/E',                format: 'number',  decimals: 1 },
  { key: 'pb_ratio',         label: 'P/B',                format: 'number',  decimals: 2 },
  { key: 'roe',              label: 'ROE',                format: 'percent', decimals: 2 },
  { key: 'net_profit_margin',label: 'Net Margin',         format: 'percent', decimals: 2 },
  { key: 'debt_to_equity',   label: 'D/E',                format: 'number',  decimals: 2 },
  { key: 'current_ratio',    label: 'Current Ratio',      format: 'number',  decimals: 2 },
]

function fmt(ts) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function NormalizedTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-600 mb-1">{label}</p>
      {payload.map(p => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="text-gray-700 font-medium">{p.dataKey}</span>
          <span className="ml-auto font-semibold" style={{ color: p.color }}>
            {p.value >= 0 ? '+' : ''}{Number(p.value).toFixed(2)}%
          </span>
        </div>
      ))}
    </div>
  )
}

function TickerSearch({ tickers, selected, onAdd }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  const filtered = query.trim()
    ? tickers
        .filter(t =>
          !selected.includes(t.symbol) &&
          (t.symbol.toLowerCase().includes(query.toLowerCase()) ||
           (t.name && t.name.toLowerCase().includes(query.toLowerCase())))
        )
        .slice(0, 8)
    : []

  useEffect(() => {
    function h(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  function handleAdd(symbol) {
    setQuery('')
    setOpen(false)
    onAdd(symbol)
  }

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">🔍</span>
        <input
          type="text"
          placeholder="Add ticker to compare…"
          value={query}
          disabled={selected.length >= MAX_TICKERS}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden z-50">
          {filtered.map(t => (
            <button
              key={t.symbol}
              onMouseDown={() => handleAdd(t.symbol)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-blue-50 transition-colors"
            >
              <span className="font-bold text-sm text-gray-900 w-14 shrink-0">{t.symbol}</span>
              <span className="text-xs text-gray-500 truncate flex-1">{t.name}</span>
              {t.sector && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${SECTOR_STYLES[t.sector] ?? 'bg-gray-100 text-gray-600'}`}>
                  {t.sector}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Compare() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  const [allTickers, setAllTickers] = useState([])
  const [selected, setSelected] = useState(() => {
    const t = searchParams.get('tickers')
    return t ? t.split(',').filter(Boolean).slice(0, MAX_TICKERS) : []
  })
  const [range, setRange] = useState('3M')
  const [chartData, setChartData] = useState([])
  const [features, setFeatures] = useState({}) // { symbol: featuresRow }
  const [loadingChart, setLoadingChart] = useState(false)

  // Keep URL in sync
  useEffect(() => {
    if (selected.length > 0) setSearchParams({ tickers: selected.join(',') })
    else setSearchParams({})
  }, [selected])

  // Fetch all tickers for search
  useEffect(() => {
    supabase.from('tickers').select('symbol,name,sector').order('symbol').then(({ data }) => {
      if (data) setAllTickers(data)
    })
  }, [])

  // Fetch price + features data when selection or range changes
  useEffect(() => {
    if (selected.length === 0) { setChartData([]); return }

    async function fetchAll() {
      setLoadingChart(true)
      const days = RANGES.find(r => r.label === range)?.days ?? 90
      const since = new Date()
      since.setDate(since.getDate() - days)

      // Fetch price data for all selected tickers
      const priceResults = await Promise.all(
        selected.map(sym =>
          supabase
            .from('stock_clean_data_yf')
            .select('timestamp,close')
            .eq('ticker', sym)
            .eq('interval', '1d')
            .gte('timestamp', since.toISOString())
            .order('timestamp', { ascending: true })
            .then(({ data }) => ({ sym, rows: data ?? [] }))
        )
      )

      // Fetch latest features for all selected tickers
      const featResults = await Promise.all(
        selected.map(sym =>
          supabase
            .from('stock_features')
            .select('*')
            .eq('ticker', sym)
            .eq('interval', '1h')
            .order('timestamp', { ascending: false })
            .limit(1)
            .single()
            .then(({ data }) => ({ sym, data: data ?? null }))
        )
      )
      const featMap = {}
      featResults.forEach(({ sym, data }) => { featMap[sym] = data })
      setFeatures(featMap)

      // Normalize prices to % return from first bar
      const byDate = {}
      priceResults.forEach(({ sym, rows }) => {
        if (!rows.length) return
        const base = rows[0].close
        rows.forEach(row => {
          const d = row.timestamp.slice(0, 10)
          if (!byDate[d]) byDate[d] = { date: d }
          byDate[d][sym] = base > 0 ? ((row.close - base) / base) * 100 : 0
        })
      })

      const merged = Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date))
      setChartData(merged)
      setLoadingChart(false)
    }

    fetchAll()
  }, [selected, range])

  function addTicker(sym) {
    if (!selected.includes(sym) && selected.length < MAX_TICKERS) {
      setSelected(prev => [...prev, sym])
    }
  }

  function removeTicker(sym) {
    setSelected(prev => prev.filter(s => s !== sym))
  }

  return (
    <div className="min-h-screen bg-white">
      <Header tickers={allTickers} onSelectTicker={sym => navigate(`/ticker/${sym}`)} />

      <main className="max-w-screen-xl mx-auto px-4 py-8">
        {/* Page header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate('/')}
            className="text-sm text-gray-500 hover:text-gray-900 font-medium transition-colors"
          >
            ← Back
          </button>
          <div className="w-px h-5 bg-gray-300" />
          <h1 className="text-2xl font-extrabold text-gray-900">Compare Tickers</h1>
          <span className="text-sm text-gray-400 font-normal">up to {MAX_TICKERS}</span>
        </div>

        {/* Ticker pills + search */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          {selected.map((sym, i) => (
            <div
              key={sym}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-semibold"
              style={{ borderColor: COLORS[i], color: COLORS[i], background: `${COLORS[i]}12` }}
            >
              <span className="w-2 h-2 rounded-full" style={{ background: COLORS[i] }} />
              {sym}
              <button
                onClick={() => removeTicker(sym)}
                className="ml-1 text-gray-400 hover:text-gray-700 leading-none"
              >
                ×
              </button>
            </div>
          ))}
          {selected.length < MAX_TICKERS && (
            <div className="w-64">
              <TickerSearch tickers={allTickers} selected={selected} onAdd={addTicker} />
            </div>
          )}
        </div>

        {selected.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-gray-400">
            <span className="text-5xl mb-4">📊</span>
            <p className="text-lg font-medium text-gray-600">Add tickers above to compare</p>
            <p className="text-sm mt-1">Search and add up to {MAX_TICKERS} tickers</p>
          </div>
        ) : (
          <>
            {/* Chart */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-semibold text-gray-800">Relative Performance</h2>
                  <p className="text-xs text-gray-400 mt-0.5">% return from start of period</p>
                </div>
                <div className="flex gap-1">
                  {RANGES.map(r => (
                    <button
                      key={r.label}
                      onClick={() => setRange(r.label)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
                        range === r.label ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              {loadingChart ? (
                <div className="h-64 bg-gray-50 rounded-xl animate-pulse" />
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={d => fmt(d + 'T00:00:00')}
                      tick={{ fontSize: 10, fill: '#9CA3AF' }}
                      tickLine={false}
                      axisLine={false}
                      minTickGap={40}
                    />
                    <YAxis
                      tickFormatter={v => `${v >= 0 ? '+' : ''}${v.toFixed(0)}%`}
                      tick={{ fontSize: 10, fill: '#9CA3AF' }}
                      tickLine={false}
                      axisLine={false}
                      width={52}
                    />
                    <Tooltip content={<NormalizedTooltip />} />
                    <Legend
                      formatter={v => <span className="text-xs font-semibold text-gray-700">{v}</span>}
                    />
                    {selected.map((sym, i) => (
                      <Line
                        key={sym}
                        type="monotone"
                        dataKey={sym}
                        stroke={COLORS[i]}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, strokeWidth: 0 }}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Metrics comparison table */}
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-800">Metrics Comparison</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-40">
                        Metric
                      </th>
                      {selected.map((sym, i) => (
                        <th key={sym} className="px-4 py-3 text-center">
                          <span
                            className="inline-flex items-center gap-1.5 text-sm font-bold"
                            style={{ color: COLORS[i] }}
                          >
                            <span className="w-2 h-2 rounded-full" style={{ background: COLORS[i] }} />
                            {sym}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {COMPARE_METRICS.map((metric, idx) => (
                      <tr key={metric.key} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-5 py-2.5 text-xs font-medium text-gray-500">{metric.label}</td>
                        {selected.map((sym, i) => {
                          const val = features[sym]?.[metric.key]
                          return (
                            <td key={sym} className="px-4 py-2.5 text-center font-semibold text-gray-800">
                              {formatValue(val, metric.format, metric.decimals)}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
