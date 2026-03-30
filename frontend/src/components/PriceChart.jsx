import { useState, useEffect, useMemo } from 'react'
import {
  ComposedChart, BarChart, LineChart,
  Area, Bar, Line, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
  ResponsiveContainer,
} from 'recharts'
import { supabase } from '../lib/supabase.js'
import { computeIndicators } from '../lib/indicators.js'

const RANGES = [
  { label: '1D',  days: 1    },
  { label: '1W',  days: 7    },
  { label: '1M',  days: 30   },
  { label: '3M',  days: 90   },
  { label: '6M',  days: 180  },
  { label: '1Y',  days: 365  },
  { label: '5Y',  days: 1825 },
  { label: 'Max', days: null },
]

const SUB_PANELS = [
  { value: 'vol_24h', label: '24h Volume' },
  { value: 'rsi',     label: 'RSI (14)' },
  { value: 'macd',    label: 'MACD (12, 26, 9)' },
]

const SYNC = 'price-sync'

function fmtDate(ts, interval) {
  const d = new Date(ts)
  if (interval === '1h') {
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
  }
  if (interval === '1w') {
    return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function fmtVol(v) {
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`
  if (v >= 1e6) return `${(v / 1e6).toFixed(0)}M`
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`
  return String(v)
}

const axisProps = {
  tick:     { fontSize: 10, fill: '#9CA3AF' },
  tickLine: false,
  axisLine: false,
}

// ── Tooltips ──────────────────────────────────────────────────────────────────
function PriceTooltip({ active, payload, showBB, showVWAP, showSMA50, showSMA200, interval }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  const extras = [
    showBB && d.bb_upper != null && ['BB↑', d.bb_upper],
    showBB && d.bb_middle!= null && ['BB—', d.bb_middle],
    showBB && d.bb_lower != null && ['BB↓', d.bb_lower],
    showVWAP  && d.vwap  != null && ['VWAP',  d.vwap],
    showSMA50 && d.sma50 != null && ['SMA50', d.sma50],
    showSMA200&& d.sma200!= null && ['SMA200',d.sma200],
  ].filter(Boolean)
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-xs min-w-[170px]">
      <p className="font-semibold text-gray-600 mb-2">{fmtDate(d.timestamp, interval)}</p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-gray-600">
        <span>O</span><span className="text-right font-medium">${Number(d.open).toFixed(2)}</span>
        <span>H</span><span className="text-right font-medium text-emerald-600">${Number(d.high).toFixed(2)}</span>
        <span>L</span><span className="text-right font-medium text-rose-600">${Number(d.low).toFixed(2)}</span>
        <span>C</span><span className="text-right font-bold text-gray-900">${Number(d.close).toFixed(2)}</span>
        <span>Vol</span><span className="text-right font-medium">{fmtVol(Number(d.volume))}</span>
      </div>
      {extras.length > 0 && (
        <div className="border-t border-gray-100 mt-2 pt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 text-gray-500">
          {extras.map(([label, val]) => (
            <>
              <span key={label + 'l'}>{label}</span>
              <span key={label + 'v'} className="text-right">${Number(val).toFixed(2)}</span>
            </>
          ))}
        </div>
      )}
    </div>
  )
}

function VolumeTooltip({ active, payload, interval }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-md px-2.5 py-1.5 text-xs">
      <p className="text-gray-400 mb-0.5">{fmtDate(d.timestamp, interval)}</p>
      <span className="font-semibold text-gray-800">Vol {fmtVol(Number(d.volume))}</span>
    </div>
  )
}

function RSITooltip({ active, payload, interval }) {
  if (!active || !payload?.length || payload[0]?.value == null) return null
  const v = Number(payload[0].value)
  const d = payload[0]?.payload
  const color = v > 70 ? '#EF4444' : v < 30 ? '#10B981' : '#8B5CF6'
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-md px-2.5 py-1.5 text-xs">
      {d && <p className="text-gray-400 mb-0.5">{fmtDate(d.timestamp, interval)}</p>}
      <span className="font-semibold" style={{ color }}>RSI {v.toFixed(1)}</span>
    </div>
  )
}

function MACDTooltip({ active, payload, interval }) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload
  if (!row) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-md px-3 py-2 text-xs space-y-0.5">
      <p className="text-gray-400 mb-1">{fmtDate(row.timestamp, interval)}</p>
      {row.macd        != null && <p><span className="text-blue-600 font-semibold">MACD </span>{Number(row.macd).toFixed(4)}</p>}
      {row.macd_signal != null && <p><span className="text-orange-500 font-semibold">Sig  </span>{Number(row.macd_signal).toFixed(4)}</p>}
      {row.macd_hist   != null && <p><span className={row.macd_hist >= 0 ? 'text-emerald-600' : 'text-rose-500'}>Hist </span>{Number(row.macd_hist).toFixed(4)}</p>}
    </div>
  )
}

// ── Sub-panel charts ──────────────────────────────────────────────────────────
function Vol24hPanel({ data, interval }) {
  const fmt = ts => fmtDate(ts, interval)
  return (
    <div className="flex flex-col gap-3">
      <ResponsiveContainer width="100%" height={100}>
        <BarChart data={data} syncId={SYNC} margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
          <XAxis dataKey="timestamp" tickFormatter={fmt} {...axisProps} minTickGap={50} />
          <YAxis tickFormatter={fmtVol} {...axisProps} width={52} tickCount={3} />
          <Tooltip content={<VolumeTooltip interval={interval} />} />
          <Bar dataKey="volume" maxBarSize={8} radius={[2, 2, 0, 0]} fill="#6366F1" opacity={0.6} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function RSIPanel({ data, interval }) {
  const fmt = ts => fmtDate(ts, interval)
  return (
    <ResponsiveContainer width="100%" height={130}>
      <LineChart data={data} syncId={SYNC} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
        <XAxis dataKey="timestamp" tickFormatter={fmt} {...axisProps} minTickGap={50} />
        <YAxis domain={[0, 100]} ticks={[30, 50, 70]} {...axisProps} width={52} />
        <Tooltip content={<RSITooltip interval={interval} />} />
        <ReferenceLine y={70} stroke="#EF444466" strokeDasharray="3 2" strokeWidth={1}
          label={{ value: 'OB 70', position: 'right', fontSize: 9, fill: '#EF4444' }} />
        <ReferenceLine y={50} stroke="#E5E7EB" strokeWidth={1} />
        <ReferenceLine y={30} stroke="#10B98166" strokeDasharray="3 2" strokeWidth={1}
          label={{ value: 'OS 30', position: 'right', fontSize: 9, fill: '#10B981' }} />
        <Line type="monotone" dataKey="rsi" stroke="#8B5CF6" strokeWidth={2} dot={false} connectNulls />
      </LineChart>
    </ResponsiveContainer>
  )
}

function MACDPanel({ data, interval }) {
  const fmt = ts => fmtDate(ts, interval)
  return (
    <ResponsiveContainer width="100%" height={130}>
      <ComposedChart data={data} syncId={SYNC} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
        <XAxis dataKey="timestamp" tickFormatter={fmt} {...axisProps} minTickGap={50} />
        <YAxis domain={['auto', 'auto']} {...axisProps} width={52} tickCount={3} tickFormatter={v => v.toFixed(2)} />
        <Tooltip content={<MACDTooltip interval={interval} />} />
        <ReferenceLine y={0} stroke="#D1D5DB" strokeWidth={1} />
        <Bar dataKey="macd_hist" maxBarSize={8} radius={[2, 2, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={(d.macd_hist ?? 0) >= 0 ? '#10B981' : '#EF4444'} />
          ))}
        </Bar>
        <Line type="monotone" dataKey="macd"        stroke="#2563EB" strokeWidth={1.5} dot={false} connectNulls />
        <Line type="monotone" dataKey="macd_signal" stroke="#F97316" strokeWidth={1.5} dot={false} connectNulls />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

// ── Range toolbar (shared) ────────────────────────────────────────────────────
function RangeBar({ range, setRange }) {
  return (
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
  )
}

// ── Overlay toggle pill ───────────────────────────────────────────────────────
function OverlayBtn({ label, active, bg, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all ${
        active ? 'border-transparent text-white' : 'border-gray-300 text-gray-500 hover:border-gray-400'
      }`}
      style={active ? { background: bg } : {}}
    >
      {label}
    </button>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function PriceChart({ ticker, sector }) {
  const [range,       setRange]       = useState('3M')
  const [showBB,      setShowBB]      = useState(false)
  const [showVWAP,    setShowVWAP]    = useState(false)
  const [showSMA50,   setShowSMA50]   = useState(false)
  const [showSMA200,  setShowSMA200]  = useState(false)
  const [subPanel,    setSubPanel]    = useState('vol_24h')
  const [raw,         setRaw]         = useState([])
  const [data,        setData]        = useState([])
  const [loading,     setLoading]     = useState(true)
  const [sectorRanks, setSectorRanks] = useState(null)

  const isHourly = range === '1D' || range === '1W'
  const interval = isHourly ? '1h' : '1d'

  useEffect(() => {
    if (!ticker) return
    let cancelled = false
    async function go() {
      setLoading(true)
      const cfg = RANGES.find(r => r.label === range) ?? { days: 90 }
      // hourly: fetch 35 days for indicator warmup
      // daily:  add 250 extra days so SMA200 is seeded across the full visible range
      // Max:    no date filter — fetch everything
      let query = supabase
        .from('stock_clean_data_yf')
        .select('timestamp,open,high,low,close,volume')
        .eq('ticker', ticker)
        .eq('interval', interval)
        .order('timestamp', { ascending: true })
        .limit(10000)

      if (cfg.days !== null) {
        // SMA200 needs 200 trading-day warmup ≈ 285 calendar days (weekends) + ~10 holidays.
        // hourly: 200 bars / 6.5 hrs ≈ 31 trading days; fetch 65 calendar days for safety.
        // daily:  +310 calendar days ensures ~220 trading-day warmup even after holidays.
        const fetchDays = isHourly ? 65 : cfg.days + 310
        const since = new Date()
        since.setDate(since.getDate() - fetchDays)
        query = query.gte('timestamp', since.toISOString())
      }

      const { data: rows } = await query
      if (!cancelled) { setRaw(rows ?? []); setLoading(false) }
    }
    go()
    return () => { cancelled = true }
  }, [ticker, range])

  useEffect(() => {
    setData(raw.length ? computeIndicators(raw) : [])
  }, [raw])

  useEffect(() => {
    if (!ticker || !sector) return
    let cancelled = false
    async function fetchRanks() {
      // Get all tickers in sector
      const { data: tickerRows } = await supabase
        .from('tickers')
        .select('symbol')
        .eq('sector', sector)
      if (!tickerRows?.length || cancelled) return
      const symbols = tickerRows.map(t => t.symbol)
      // Get latest features for each
      const { data: featRows } = await supabase
        .from('stock_features')
        .select('ticker,rsi,volatility,sharpe_ratio,max_drawdown')
        .in('ticker', symbols)
        .eq('interval', '1h')
        .order('timestamp', { ascending: false })
      if (!featRows || cancelled) return
      // Keep latest row per ticker
      const seen = new Set()
      const latest = featRows.filter(r => { if (seen.has(r.ticker)) return false; seen.add(r.ticker); return true })
      const n = latest.length
      const rank = (key, higherIsBetter = true) => {
        const me = latest.find(r => r.ticker === ticker)
        if (!me || me[key] == null) return null
        const sorted = [...latest].filter(r => r[key] != null).sort((a, b) => higherIsBetter ? b[key] - a[key] : a[key] - b[key])
        const pos = sorted.findIndex(r => r.ticker === ticker) + 1
        return { rank: pos, total: sorted.length }
      }
      if (!cancelled) setSectorRanks({
        rsi:      rank('rsi', false),        // lower RSI = more oversold = ranked lower numerically
        sharpe:   rank('sharpe_ratio', true),
        vol:      rank('volatility', false), // lower vol = less risky = ranked higher
        drawdown: rank('max_drawdown', true), // less negative = better
        n,
      })
    }
    fetchRanks()
    return () => { cancelled = true }
  }, [ticker, sector])

  // Trim display data to the selected range (drops warmup bars fetched for indicator seeding)
  const displayData = useMemo(() => {
    if (!data.length) return data
    const cfg = RANGES.find(r => r.label === range) ?? { days: 90 }

    // 1D: show only bars from the most recent trading session.
    // A simple date cutoff breaks on weekends/holidays (last session was 2+ days ago).
    if (range === '1D') {
      const lastDate = data[data.length - 1].timestamp.slice(0, 10)
      return data.filter(d => d.timestamp.slice(0, 10) === lastDate)
    }

    // 5Y / Max: downsample to one bar per week (Friday) for smooth rendering.
    // Use getUTCDay() — daily timestamps are midnight UTC so getDay() can be off by one.
    if (range === '5Y' || range === 'Max') {
      const pool = cfg.days === null ? data : (() => {
        const cutoff = new Date()
        cutoff.setDate(cutoff.getDate() - cfg.days)
        return data.filter(d => new Date(d.timestamp) >= cutoff)
      })()
      const fridays = pool.filter(d => new Date(d.timestamp).getUTCDay() === 5)
      return fridays.length ? fridays : pool
    }

    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - cfg.days)
    return data.filter(d => new Date(d.timestamp) >= cutoff)
  }, [data, range])

  // Compute explicit Y-domain that encompasses price + all active overlays
  const yDomain = useMemo(() => {
    if (!displayData.length) return ['auto', 'auto']
    let lo = Infinity, hi = -Infinity
    for (const d of displayData) {
      const c = Number(d.close)
      if (!isNaN(c)) { lo = Math.min(lo, c); hi = Math.max(hi, c) }
      if (showBB) {
        if (d.bb_upper != null) hi = Math.max(hi, Number(d.bb_upper))
        if (d.bb_lower != null) lo = Math.min(lo, Number(d.bb_lower))
      }
      if (showVWAP  && d.vwap   != null) { lo = Math.min(lo, Number(d.vwap));   hi = Math.max(hi, Number(d.vwap))   }
      if (showSMA50 && d.sma50  != null) { lo = Math.min(lo, Number(d.sma50));  hi = Math.max(hi, Number(d.sma50))  }
      if (showSMA200&& d.sma200 != null) { lo = Math.min(lo, Number(d.sma200)); hi = Math.max(hi, Number(d.sma200)) }
    }
    if (!isFinite(lo) || !isFinite(hi)) return ['auto', 'auto']
    const pad = (hi - lo) * 0.06
    return [lo - pad, hi + pad]
  }, [displayData, showBB, showVWAP, showSMA50, showSMA200])

  const isUp   = displayData.length >= 2
    ? Number(displayData[displayData.length - 1].close) >= Number(displayData[0].close)
    : true
  const color  = isUp ? '#10B981' : '#EF4444'
  const gradId = `pg-${ticker}`

  const activeOverlays = [showBB, showVWAP, showSMA50, showSMA200].some(Boolean)

  if (loading) return (
    <div className="space-y-3">
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <div className="h-8 w-64 bg-gray-100 rounded animate-pulse mb-3" />
        <div className="h-[320px] bg-gray-50 rounded-xl animate-pulse" />
      </div>
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <div className="h-[160px] bg-gray-50 rounded-xl animate-pulse" />
      </div>
    </div>
  )

  if (!displayData.length) return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5">
      <div className="h-40 flex items-center justify-center text-gray-400 text-sm">
        No price data available
      </div>
    </div>
  )

  return (
    <div className="space-y-3">

      {/* ── Card 1: Price chart ──────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <RangeBar range={range} setRange={setRange} />
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <span className="text-xs text-gray-400">Overlays:</span>
            <OverlayBtn label="BB"     active={showBB}     bg="#64748B" onClick={() => setShowBB(v => !v)} />
            <OverlayBtn label="VWAP"   active={showVWAP}   bg="#F59E0B" onClick={() => setShowVWAP(v => !v)} />
            <OverlayBtn label="SMA 50" active={showSMA50}  bg="#6366F1" onClick={() => setShowSMA50(v => !v)} />
            <OverlayBtn label="SMA 200"active={showSMA200} bg="#EC4899" onClick={() => setShowSMA200(v => !v)} />
          </div>
        </div>

        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={displayData} syncId={SYNC} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={color} stopOpacity={0.18} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
            <XAxis
              dataKey="timestamp"
              tickFormatter={ts => fmtDate(ts, interval)}
              {...axisProps}
              minTickGap={60}
            />
            <YAxis
              domain={yDomain}
              tickFormatter={v => `$${Number(v).toFixed(0)}`}
              {...axisProps}
              width={56}
              allowDataOverflow={false}
            />
            <Tooltip content={<PriceTooltip showBB={showBB} showVWAP={showVWAP} showSMA50={showSMA50} showSMA200={showSMA200} interval={interval} />} />

            {/* Overlays rendered BEFORE Area so price sits on top */}
            {showBB && <>
              <Line type="monotone" dataKey="bb_upper"  stroke="#94A3B8" strokeWidth={1}   dot={false} strokeDasharray="4 2" connectNulls legendType="none" />
              <Line type="monotone" dataKey="bb_middle" stroke="#64748B" strokeWidth={1}   dot={false}                       connectNulls legendType="none" />
              <Line type="monotone" dataKey="bb_lower"  stroke="#94A3B8" strokeWidth={1}   dot={false} strokeDasharray="4 2" connectNulls legendType="none" />
            </>}
            {showVWAP   && <Line type="monotone" dataKey="vwap"  stroke="#F59E0B" strokeWidth={1.5} dot={false} connectNulls legendType="none" />}
            {showSMA50  && <Line type="monotone" dataKey="sma50" stroke="#6366F1" strokeWidth={1.5} dot={false} connectNulls legendType="none" />}
            {showSMA200 && <Line type="monotone" dataKey="sma200"stroke="#EC4899" strokeWidth={1.5} dot={false} connectNulls legendType="none" />}

            {/* Price area on top */}
            <Area
              type="monotone" dataKey="close"
              stroke={color} strokeWidth={2.5}
              fill={`url(#${gradId})`}
              dot={false} activeDot={{ r: 4, strokeWidth: 0, fill: color }}
            />
          </ComposedChart>
        </ResponsiveContainer>

        {/* Overlay legend */}
        {activeOverlays && (
          <div className="flex flex-wrap gap-4 mt-3 text-xs text-gray-500">
            {showBB    && <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-slate-400 inline-block" style={{borderTop:'1px dashed #94A3B8',height:0}} />BB (20, 2σ)</span>}
            {showVWAP  && <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 inline-block" style={{background:'#F59E0B'}} />VWAP</span>}
            {showSMA50 && <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 inline-block" style={{background:'#6366F1'}} />SMA 50</span>}
            {showSMA200&& <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 inline-block" style={{background:'#EC4899'}} />SMA 200</span>}
          </div>
        )}
      </div>

      {/* ── Card 2: Indicator panel ──────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <select
            value={subPanel}
            onChange={e => setSubPanel(e.target.value)}
            className="text-xs font-semibold text-gray-700 bg-gray-100 border-0 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-300 cursor-pointer"
          >
            {SUB_PANELS.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>

          {subPanel === 'macd' && (
            <div className="flex gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-blue-600 inline-block" />MACD</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-orange-500 inline-block" />Signal</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-emerald-500 inline-block rounded-sm" />+Hist</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-rose-500 inline-block rounded-sm" />−Hist</span>
            </div>
          )}
          {subPanel === 'rsi' && (
            <div className="flex gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-violet-500 inline-block" />RSI</span>
              <span className="text-rose-400 font-medium">70 overbought</span>
              <span className="text-emerald-500 font-medium">30 oversold</span>
            </div>
          )}
        </div>

        {subPanel === 'vol_24h' && <Vol24hPanel data={displayData} interval={interval} />}
        {subPanel === 'rsi'     && <RSIPanel    data={displayData} interval={interval} />}
        {subPanel === 'macd'    && <MACDPanel   data={displayData} interval={interval} />}

        {sectorRanks && (
          <div className="mt-4 pt-3 border-t border-gray-100">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Sector Ranking ({sectorRanks.n} peers)</p>
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'RSI',       r: sectorRanks.rsi },
                { label: 'Sharpe',    r: sectorRanks.sharpe },
                { label: 'Volatility',r: sectorRanks.vol },
                { label: 'Max DD',    r: sectorRanks.drawdown },
              ].filter(x => x.r).map(({ label, r }) => (
                <span key={label} className="inline-flex items-center gap-1 bg-gray-100 rounded-lg px-2.5 py-1 text-xs">
                  <span className="text-gray-500">{label}</span>
                  <span className="font-bold text-gray-800">#{r.rank}</span>
                  <span className="text-gray-400">/ {r.total}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

    </div>
  )
}
