// UI: Untitled UI tabs, select, input, pagination, chart styling —
//   https://www.untitledui.com/react/components/tabs
//   https://www.untitledui.com/react/components/select
//   https://www.untitledui.com/react/components/pagination
//   https://www.untitledui.com/react/components/charts
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer,
  Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis,
} from 'recharts'
import { SearchLg, Inbox01 } from '@untitledui/icons'
import { Tabs, TabList } from '@/components/application/tabs/tabs'
import { PaginationPageDefault } from '@/components/application/pagination/pagination'
import { Select } from '@/components/base/select/select'
import { Input } from '@/components/base/input/input'
import { supabase } from '../lib/supabase.js'
import { SECTOR_BADGE_COLOR } from '../lib/constants.js'
import { CARD, fmtPct, fmtPrice } from '../lib/ui.js'
import { useTickers } from '../components/AppShell.jsx'
import SectorBadge from '../components/SectorBadge.jsx'
import Sparkline from '../components/Sparkline.jsx'
import PriceChange from '../components/PriceChange.jsx'

const PAGE_SIZE = 24

const WINDOWS = [
  { id: 'chg_1d', label: '1D' },
  { id: 'chg_1w', label: '1W' },
  { id: 'chg_1m', label: '1M' },
]

const SORTS = [
  { id: 'symbol',       label: 'Name (A–Z)' },
  { id: 'chg_1d',       label: '1D change' },
  { id: 'chg_1m',       label: '1M change' },
  { id: 'rsi',          label: 'RSI' },
  { id: 'sharpe_ratio', label: 'Sharpe ratio' },
]

// Badge color name -> Untitled utility palette (chart fills use currentColor)
const PALETTE = { gray: 'neutral', brand: 'brand', error: 'red', warning: 'yellow', success: 'green' }
const sectorTextClass = sector => {
  const c = SECTOR_BADGE_COLOR[sector] ?? 'gray'
  return `text-utility-${PALETTE[c] ?? c}-500`
}

const mean = xs => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

function SectionTitle({ title, subtitle, right }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold text-primary">{title}</h2>
        {subtitle && <p className="text-sm text-tertiary">{subtitle}</p>}
      </div>
      {right}
    </div>
  )
}

function WindowTabs({ value, onChange }) {
  return (
    <Tabs selectedKey={value} onSelectionChange={onChange}>
      <TabList type="button-border" size="sm" items={WINDOWS} className="w-max" />
    </Tabs>
  )
}

function ChartTooltip({ active, payload, render }) {
  if (!active || !payload?.length) return null
  const [title, sub] = render(payload[0].payload)
  return (
    <div className="flex flex-col gap-0.5 rounded-lg bg-primary-solid px-3 py-2 shadow-lg">
      <p className="text-xs font-semibold text-white">{title}</p>
      <p className="text-xs text-tooltip-supporting-text">{sub}</p>
    </div>
  )
}

function sectorAverages(rows, key) {
  const by = {}
  for (const r of rows) {
    if (!r.sector || r[key] == null) continue
    ;(by[r.sector] ??= []).push(r[key])
  }
  return Object.entries(by)
    .map(([sector, xs]) => ({ sector, avg: mean(xs), n: xs.length }))
    .sort((a, b) => b.avg - a.avg)
}

// ── KPI cards ────────────────────────────────────────────────────────────────
function KpiCard({ label, children }) {
  return (
    <div className={`${CARD} p-5`}>
      <p className="text-sm font-medium text-tertiary">{label}</p>
      <div className="mt-2">{children}</div>
    </div>
  )
}

function Kpis({ rows }) {
  const spy = rows.find(r => r.ticker === 'SPY')
  const stocks = rows.filter(r => r.sector !== 'ETF' && r.chg_1d != null)
  const up = stocks.filter(r => r.chg_1d > 0).length
  const down = stocks.filter(r => r.chg_1d < 0).length
  const sectors = sectorAverages(stocks, 'chg_1d')
  const best = sectors[0]
  const worst = sectors[sectors.length - 1]

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <KpiCard label="S&P 500 (SPY)">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-display-xs font-semibold text-primary tabular-nums">{fmtPrice(spy?.last_close)}</p>
            <div className="mt-2"><PriceChange value={spy?.chg_1d} /></div>
          </div>
          <Sparkline data={spy?.spark} width={120} height={44} />
        </div>
      </KpiCard>

      <KpiCard label="Market breadth (1D)">
        <p className="text-display-xs font-semibold text-primary tabular-nums">
          {up} <span className="text-md font-medium text-tertiary">up</span>
          {' · '}
          {down} <span className="text-md font-medium text-tertiary">down</span>
        </p>
        <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-secondary">
          <div className="bg-success-solid" style={{ width: `${(up / (up + down || 1)) * 100}%` }} />
          <div className="bg-error-solid" style={{ width: `${(down / (up + down || 1)) * 100}%` }} />
        </div>
      </KpiCard>

      <KpiCard label="Best / worst sector (1D)">
        <div className="flex flex-col gap-2">
          {[best, worst].filter(Boolean).map(s => (
            <div key={s.sector} className="flex items-center justify-between gap-2">
              <SectorBadge sector={s.sector} />
              <PriceChange value={s.avg} size="md" />
            </div>
          ))}
        </div>
      </KpiCard>
    </div>
  )
}

// ── Charts ───────────────────────────────────────────────────────────────────
function SectorPerformance({ rows, win }) {
  const data = sectorAverages(rows.filter(r => r.sector !== 'ETF'), win).map(s => ({ ...s, pct: s.avg * 100 }))
  return (
    <ResponsiveContainer width="100%" height="100%" minHeight={Math.max(260, data.length * 30)}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}
        className="text-tertiary [&_.recharts-text]:text-xs">
        <CartesianGrid horizontal={false} stroke="currentColor" className="text-utility-neutral-100" />
        <XAxis type="number" axisLine={false} tickLine={false} fill="currentColor" tickFormatter={v => `${v.toFixed(1)}%`} />
        <YAxis type="category" dataKey="sector" axisLine={false} tickLine={false} width={150} fill="currentColor" />
        <Tooltip
          cursor={{ className: 'fill-utility-neutral-50' }}
          content={<ChartTooltip render={d => [d.sector, `${fmtPct(d.avg)} avg · ${d.n} stocks`]} />}
        />
        <Bar dataKey="pct" radius={[0, 4, 4, 0]} maxBarSize={18}>
          {data.map(d => (
            <Cell key={d.sector} fill="currentColor" className={d.pct >= 0 ? 'text-utility-green-500' : 'text-utility-red-500'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function Movers({ rows, win, onOpen }) {
  const ranked = rows.filter(r => r[win] != null).sort((a, b) => b[win] - a[win])
  const lists = [
    { title: 'Top gainers', items: ranked.slice(0, 5) },
    { title: 'Top losers', items: ranked.slice(-5).reverse() },
  ]
  return (
    <div className="flex flex-col gap-6">
      {lists.map(list => (
        <div key={list.title}>
          <p className="mb-1 text-sm font-medium text-tertiary">{list.title}</p>
          <ul className="divide-y divide-secondary">
            {list.items.map(r => (
              <li key={r.ticker}>
                <button onClick={() => onOpen(r.ticker)}
                  className="flex w-full items-center gap-3 rounded-md px-1 py-2 text-left hover:bg-primary_hover">
                  <span className="w-14 shrink-0 text-sm font-semibold text-primary">{r.ticker}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-tertiary">{r.name}</span>
                  <Sparkline data={r.spark} width={64} height={22} />
                  <span className="w-24 text-right"><PriceChange value={r[win]} /></span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

function RiskReturn({ rows, onOpen }) {
  const bySector = {}
  for (const r of rows) {
    if (r.sector === 'ETF' || r.volatility == null || r.chg_1m == null) continue
    ;(bySector[r.sector] ??= []).push({ ...r, x: r.volatility * 100, y: r.chg_1m * 100 })
  }
  return (
    <>
    <ResponsiveContainer width="100%" height={360}>
      <ScatterChart margin={{ left: 0, right: 16, top: 8, bottom: 16 }} className="text-tertiary [&_.recharts-text]:text-xs">
        <CartesianGrid stroke="currentColor" className="text-utility-neutral-100" />
        <XAxis type="number" dataKey="x" name="Volatility" axisLine={false} tickLine={false} fill="currentColor"
          tickFormatter={v => `${v.toFixed(0)}%`}
          label={{ value: 'Annualized volatility', position: 'insideBottom', offset: -10, fill: 'currentColor' }} />
        <YAxis type="number" dataKey="y" name="1M return" axisLine={false} tickLine={false} fill="currentColor"
          tickFormatter={v => `${v.toFixed(0)}%`} width={48} />
        <ZAxis range={[40, 40]} />
        <Tooltip
          cursor={{ strokeDasharray: '3 3' }}
          content={<ChartTooltip render={d => [`${d.ticker} · ${d.sector}`, `Volatility ${d.x.toFixed(1)}% · 1M ${fmtPct(d.chg_1m)}`]} />}
        />
        {Object.entries(bySector).map(([sector, data]) => (
          <Scatter key={sector} name={sector} data={data} fill="currentColor" fillOpacity={0.75}
            className={`${sectorTextClass(sector)} cursor-pointer`}
            onClick={d => onOpen(d.ticker ?? d.payload?.ticker)} />
        ))}
      </ScatterChart>
    </ResponsiveContainer>
    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
      {Object.keys(bySector).sort().map(sector => (
        <li key={sector} className="flex items-center gap-1.5 text-xs text-tertiary">
          <span className={`size-2.5 rounded-full bg-current ${sectorTextClass(sector)}`} />
          {sector}
        </li>
      ))}
    </ul>
    </>
  )
}

// ── Ticker grid ──────────────────────────────────────────────────────────────
function TickerCard({ row, onOpen }) {
  return (
    <button onClick={() => onOpen(row.ticker)}
      className={`${CARD} flex flex-col gap-3 p-4 text-left transition hover:bg-primary_hover`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-md font-semibold text-primary">{row.ticker}</p>
          <p className="truncate text-xs text-tertiary">{row.name || '—'}</p>
        </div>
        <PriceChange value={row.chg_1d} />
      </div>
      <div className="flex items-end justify-between gap-2">
        <SectorBadge sector={row.sector} />
        <Sparkline data={row.spark} width={80} height={26} />
      </div>
    </button>
  )
}

function TickerGrid({ rows, onOpen }) {
  const [sector, setSector] = useState('All')
  const [sort, setSort] = useState('symbol')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)

  const sectors = useMemo(
    () => ['All', ...Array.from(new Set(rows.map(r => r.sector).filter(Boolean))).sort()],
    [rows],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = rows.filter(r =>
      (sector === 'All' || r.sector === sector) &&
      (!q || r.ticker.toLowerCase().includes(q) || r.name?.toLowerCase().includes(q)))
    return sort === 'symbol'
      ? list.sort((a, b) => a.ticker.localeCompare(b.ticker))
      : list.sort((a, b) => (b[sort] ?? -Infinity) - (a[sort] ?? -Infinity))
  }, [rows, sector, sort, query])

  useEffect(() => { setPage(1) }, [sector, sort, query])

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div>
      <div className="mb-4 overflow-x-auto pb-1">
        <Tabs selectedKey={sector} onSelectionChange={setSector}>
          <TabList type="button-border" size="sm" items={sectors.map(s => ({ id: s, label: s }))} className="w-max" />
        </Tabs>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input icon={SearchLg} size="sm" placeholder="Filter by symbol or name" aria-label="Filter tickers"
          value={query} onChange={setQuery} className="w-full sm:w-72" />
        <div className="w-full sm:w-52">
          <Select aria-label="Sort by" size="sm" items={SORTS} selectedKey={sort} onSelectionChange={k => k && setSort(k)}>
            {item => <Select.Item id={item.id} label={item.label} />}
          </Select>
        </div>
        <span className="text-sm text-tertiary sm:ml-auto">{filtered.length} tickers</span>
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-tertiary">
          <Inbox01 className="mb-3 size-10 text-quaternary" aria-hidden="true" />
          <p className="text-md font-medium">No tickers found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map(r => <TickerCard key={r.ticker} row={r} onOpen={onOpen} />)}
        </div>
      )}

      {pages > 1 && <PaginationPageDefault className="mt-6" page={page} total={pages} onPageChange={setPage} />}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function Home() {
  const navigate = useNavigate()
  const tickers = useTickers()
  const [snapshot, setSnapshot] = useState([])
  const [win, setWin] = useState('chg_1d')

  useEffect(() => {
    supabase.from('ticker_snapshot').select('*').then(({ data }) => { if (data) setSnapshot(data) })
  }, [])

  // One row per ticker: snapshot metrics + name/sector from the shared ticker list
  const rows = useMemo(() => {
    const snap = Object.fromEntries(snapshot.map(s => [s.ticker, s]))
    return tickers.map(t => ({ ...snap[t.symbol], ticker: t.symbol, name: t.name, sector: t.sector }))
  }, [tickers, snapshot])

  const open = sym => navigate(`/ticker/${sym}`)
  const loading = !tickers.length || !snapshot.length
  const asOf = snapshot[0]?.last_ts
    ? new Date(snapshot[0].last_ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
    : null

  return (
    <div className="mx-auto max-w-container px-4 py-8 md:px-8">
      <div className="mb-8">
        <h1 className="text-display-xs font-semibold text-primary">Market overview</h1>
        <p className="mt-1 text-md text-tertiary">
          {tickers.length || '—'} tickers{asOf && <> · prices as of {asOf} close</>}
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[0, 1, 2].map(i => <div key={i} className={`${CARD} h-32 animate-pulse`} />)}
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          <Kpis rows={rows} />

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
            <section className={`${CARD} flex flex-col p-5 xl:col-span-3`}>
              <SectionTitle title="Sector performance" subtitle="Average change per sector"
                right={<WindowTabs value={win} onChange={setWin} />} />
              <div className="min-h-0 flex-1"><SectorPerformance rows={rows} win={win} /></div>
            </section>
            <section className={`${CARD} p-5 xl:col-span-2`}>
              <SectionTitle title="Movers" subtitle={`Largest ${WINDOWS.find(w => w.id === win).label} moves`} />
              <Movers rows={rows} win={win} onOpen={open} />
            </section>
          </div>

          <section className={`${CARD} p-5`}>
            <SectionTitle title="Risk vs. return" subtitle="Each dot is a stock: 30-day volatility vs. 1-month return. Click a dot to open it." />
            <RiskReturn rows={rows} onOpen={open} />
          </section>

          <section>
            <SectionTitle title="All tickers" />
            <TickerGrid rows={rows} onOpen={open} />
          </section>
        </div>
      )}
    </div>
  )
}
