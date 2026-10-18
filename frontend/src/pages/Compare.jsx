// UI: Untitled UI buttons, button group, combobox, table, chart styling —
//   https://www.untitledui.com/react/components/button-groups
//   https://www.untitledui.com/react/components/select
//   https://www.untitledui.com/react/components/tables
//   https://www.untitledui.com/react/components/charts
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, PolarAngleAxis, PolarGrid,
  Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { ArrowLeft, BarChartSquare02, XClose } from '@untitledui/icons'
import { ChartTooltipContent } from '@/components/application/charts/charts-base'
import { Table, TableCard } from '@/components/application/table/table'
import { Button } from '@/components/base/buttons/button'
import { ButtonGroup, ButtonGroupItem } from '@/components/base/button-group/button-group'
import { Select } from '@/components/base/select/select'
import { supabase } from '../lib/supabase.js'
import { formatValue } from '../lib/constants.js'
import { CARD } from '../lib/ui.js'
import { percentile } from '../lib/peers.js'
import { PEER_METRICS } from '../components/TickerVisuals.jsx'
import { useTickers } from '../components/AppShell.jsx'

const COLORS = ['#0D9488', '#2563EB', '#F59E0B', '#E11D48', '#7C3AED']
const MAX_TICKERS = 5

const RANGES = [
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: '1Y', days: 365 },
]

const COMPARE_METRICS = [
  { key: 'rsi',               label: 'RSI',           format: 'number',  decimals: 1 },
  { key: 'volatility',        label: 'Volatility',    format: 'percent', decimals: 2 },
  { key: 'sharpe_ratio',      label: 'Sharpe',        format: 'number',  decimals: 2 },
  { key: 'beta',              label: 'Beta',          format: 'number',  decimals: 2 },
  { key: 'alpha',             label: 'Alpha',         format: 'percent', decimals: 2 },
  { key: 'max_drawdown',      label: 'Max drawdown',  format: 'percent', decimals: 2 },
  { key: 'pe_ratio',          label: 'P/E',           format: 'number',  decimals: 1 },
  { key: 'pb_ratio',          label: 'P/B',           format: 'number',  decimals: 2 },
  { key: 'roe',               label: 'ROE',           format: 'percent', decimals: 2 },
  { key: 'net_profit_margin', label: 'Net margin',    format: 'percent', decimals: 2 },
  { key: 'debt_to_equity',    label: 'D/E',           format: 'number',  decimals: 2 },
  { key: 'current_ratio',     label: 'Current ratio', format: 'number',  decimals: 2 },
]

const chartClass = 'text-tertiary [&_.recharts-text]:text-xs'
const fmtDate = d => new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

function Card({ title, subtitle, right, children, className = '' }) {
  return (
    <section className={`${CARD} p-5 ${className}`}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-primary">{title}</h2>
          {subtitle && <p className="text-sm text-tertiary">{subtitle}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  )
}

// Pearson correlation of two equal-length arrays
function pearson(a, b) {
  const n = a.length
  if (n < 3) return null
  const ma = a.reduce((s, x) => s + x, 0) / n
  const mb = b.reduce((s, x) => s + x, 0) / n
  let cov = 0, va = 0, vb = 0
  for (let i = 0; i < n; i++) {
    cov += (a[i] - ma) * (b[i] - mb)
    va += (a[i] - ma) ** 2
    vb += (b[i] - mb) ** 2
  }
  return va && vb ? cov / Math.sqrt(va * vb) : null
}

// Daily returns on dates where every ticker traded, then pairwise correlation
function correlationMatrix(closesBySym, symbols) {
  const dates = Object.keys(closesBySym[symbols[0]] ?? {})
    .filter(d => symbols.every(s => closesBySym[s]?.[d] != null)).sort()
  const rets = Object.fromEntries(symbols.map(s => [s, dates.slice(1).map((d, i) =>
    closesBySym[s][d] / closesBySym[s][dates[i]] - 1)]))
  return symbols.map(a => symbols.map(b => (a === b ? 1 : pearson(rets[a], rets[b]))))
}

function heatColor(r) {
  if (r == null) return 'transparent'
  return r >= 0 ? `rgba(13, 148, 136, ${0.12 + 0.75 * r})` : `rgba(225, 29, 72, ${0.12 + 0.75 * -r})`
}

export default function Compare() {
  const [searchParams, setSearchParams] = useSearchParams()
  const allTickers = useTickers()
  const [selected, setSelected] = useState(() => {
    const t = searchParams.get('tickers')
    return t ? t.split(',').filter(Boolean).slice(0, MAX_TICKERS) : []
  })
  const [range, setRange] = useState('3M')
  const [closes, setCloses] = useState({})      // { sym: { 'YYYY-MM-DD': close } }
  const [universe, setUniverse] = useState([])  // latest feature row for every ticker
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setSearchParams(selected.length ? { tickers: selected.join(',') } : {})
  }, [selected])

  // Latest features for all tickers (one bar timestamp), for values + universe percentiles
  useEffect(() => {
    async function load() {
      const { data: latest } = await supabase.from('stock_features').select('timestamp')
        .eq('interval', '1h').order('timestamp', { ascending: false }).limit(1)
      if (!latest?.length) return
      const { data } = await supabase.from('stock_features').select('*')
        .eq('interval', '1h').eq('timestamp', latest[0].timestamp)
      setUniverse(data ?? [])
    }
    load()
  }, [])

  // Daily closes for the selected tickers over the chosen range
  useEffect(() => {
    if (!selected.length) { setCloses({}); return }
    let cancelled = false
    async function load() {
      setLoading(true)
      const since = new Date()
      since.setDate(since.getDate() - (RANGES.find(r => r.label === range)?.days ?? 90))
      const results = await Promise.all(selected.map(sym =>
        supabase.from('stock_clean_data_yf').select('timestamp,close')
          .eq('ticker', sym).eq('interval', '1d').gte('timestamp', since.toISOString())
          .order('timestamp', { ascending: true })
          .then(({ data }) => [sym, Object.fromEntries((data ?? []).map(r => [r.timestamp.slice(0, 10), r.close]))])))
      if (!cancelled) { setCloses(Object.fromEntries(results)); setLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [selected, range])

  const features = useMemo(
    () => Object.fromEntries(universe.filter(r => selected.includes(r.ticker)).map(r => [r.ticker, r])),
    [universe, selected],
  )

  // % return from the first bar, one row per date
  const perfData = useMemo(() => {
    const byDate = {}
    for (const sym of selected) {
      const entries = Object.entries(closes[sym] ?? {}).sort(([a], [b]) => a.localeCompare(b))
      const base = entries[0]?.[1]
      for (const [d, c] of entries) (byDate[d] ??= { date: d })[sym] = base ? (c / base - 1) * 100 : null
    }
    return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date))
  }, [closes, selected])

  const radarData = useMemo(() => PEER_METRICS.map(m => ({
    metric: m.label,
    ...Object.fromEntries(selected.map(sym => [sym, Math.round(percentile(universe, sym, m.key, m.higherBetter) ?? 0)])),
  })), [universe, selected])

  const corr = useMemo(
    () => (selected.length > 1 && Object.keys(closes).length === selected.length ? correlationMatrix(closes, selected) : null),
    [closes, selected],
  )

  const addTicker = sym => {
    if (sym && !selected.includes(sym) && selected.length < MAX_TICKERS) setSelected(s => [...s, sym])
  }
  const removeTicker = sym => setSelected(s => s.filter(x => x !== sym))
  const colorOf = sym => COLORS[selected.indexOf(sym)]

  const searchItems = allTickers
    .filter(t => !selected.includes(t.symbol))
    .map(t => ({ id: t.symbol, label: t.symbol, supportingText: t.name ?? '' }))

  return (
    <div className="mx-auto max-w-container px-4 py-6 md:px-8">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Button size="sm" color="link-gray" iconLeading={ArrowLeft} href="/">Dashboard</Button>
        <div className="h-5 w-px bg-border-secondary" />
        <h1 className="text-display-xs font-semibold text-primary">Compare</h1>
        <span className="text-sm text-tertiary">up to {MAX_TICKERS} tickers</span>
      </div>

      {/* Selected tickers + add */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {selected.map(sym => (
          <span key={sym} className="inline-flex items-center gap-2 rounded-md bg-primary py-1 pr-1.5 pl-2.5 text-sm font-semibold text-primary ring-1 ring-secondary ring-inset">
            <span className="size-2.5 rounded-full" style={{ background: colorOf(sym) }} aria-hidden="true" />
            {sym}
            <button onClick={() => removeTicker(sym)} aria-label={`Remove ${sym}`}
              className="rounded p-0.5 text-fg-quaternary hover:bg-primary_hover hover:text-fg-quaternary_hover">
              <XClose className="size-3.5" aria-hidden="true" />
            </button>
          </span>
        ))}
        {selected.length < MAX_TICKERS && (
          <div className="w-64">
            <Select.ComboBox aria-label="Add ticker" placeholder="Add ticker" size="sm" shortcut={false}
              items={searchItems} selectedKey={null} onSelectionChange={addTicker}>
              {item => <Select.Item id={item.id} label={item.label} supportingText={item.supportingText} />}
            </Select.ComboBox>
          </div>
        )}
      </div>

      {selected.length === 0 ? (
        <div className={`${CARD} flex flex-col items-center justify-center py-24 text-center`}>
          <BarChartSquare02 className="mb-4 size-12 text-fg-quaternary" aria-hidden="true" />
          <p className="text-lg font-medium text-primary">Add tickers to compare</p>
          <p className="mt-1 text-sm text-tertiary">Search above and add up to {MAX_TICKERS}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <Card title="Relative performance" subtitle="% return from the start of the period"
            right={
              <ButtonGroup size="sm" aria-label="Range" disallowEmptySelection selectedKeys={new Set([range])}
                onSelectionChange={keys => { const k = [...keys][0]; if (k) setRange(k) }}>
                {RANGES.map(r => <ButtonGroupItem key={r.label} id={r.label}>{r.label}</ButtonGroupItem>)}
              </ButtonGroup>
            }>
            {loading ? <div className="h-72 animate-pulse rounded-lg bg-secondary" /> : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={perfData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} className={chartClass}>
                  <CartesianGrid vertical={false} stroke="currentColor" className="text-utility-neutral-100" />
                  <XAxis dataKey="date" tickFormatter={fmtDate} axisLine={false} tickLine={false} fill="currentColor" minTickGap={60} />
                  <YAxis tickFormatter={v => `${v >= 0 ? '+' : ''}${v.toFixed(0)}%`} axisLine={false} tickLine={false} fill="currentColor" width={52} />
                  <Tooltip content={<ChartTooltipContent />} labelFormatter={fmtDate}
                    formatter={v => `${v >= 0 ? '+' : ''}${Number(v).toFixed(2)}%`} />
                  {selected.map(sym => (
                    <Line key={sym} type="monotone" dataKey={sym} stroke={colorOf(sym)} strokeWidth={2} dot={false} connectNulls />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </Card>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card title="Profile" subtitle="Percentile vs. all tracked stocks (100 = best)">
              <ResponsiveContainer width="100%" height={320}>
                <RadarChart data={radarData} outerRadius="70%" className={chartClass}>
                  <PolarGrid stroke="currentColor" className="text-utility-neutral-200" />
                  <PolarAngleAxis dataKey="metric" fill="currentColor" />
                  <Tooltip content={<ChartTooltipContent />} formatter={v => `${v}th percentile`} />
                  {selected.map(sym => (
                    <Radar key={sym} dataKey={sym} stroke={colorOf(sym)} fill={colorOf(sym)} fillOpacity={0.12} strokeWidth={2} />
                  ))}
                </RadarChart>
              </ResponsiveContainer>
            </Card>

            <Card title="Return correlation" subtitle={`Daily returns over ${range}; 1 = move together, −1 = opposite`}>
              {selected.length < 2 ? (
                <p className="py-16 text-center text-sm text-tertiary">Add a second ticker to see correlations</p>
              ) : !corr ? (
                <div className="h-64 animate-pulse rounded-lg bg-secondary" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="mx-auto border-separate border-spacing-1 text-sm">
                    <thead>
                      <tr>
                        <th />
                        {selected.map(s => <th key={s} className="px-2 pb-1 text-xs font-semibold text-tertiary">{s}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {selected.map((a, i) => (
                        <tr key={a}>
                          <th className="pr-2 text-right text-xs font-semibold text-tertiary">{a}</th>
                          {selected.map((b, j) => (
                            <td key={b} className="size-16 rounded-md text-center font-semibold text-primary tabular-nums"
                              style={{ background: heatColor(corr[i][j]) }}
                              title={`${a} vs ${b}`}>
                              {corr[i][j] == null ? '—' : corr[i][j].toFixed(2)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>

          <Card title="Metrics at a glance" subtitle="Latest values, one chart per metric">
            <div className="grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-3 xl:grid-cols-4">
              {COMPARE_METRICS.map(m => {
                const scale = m.format === 'percent' ? 100 : 1
                const data = selected.map(sym => ({ sym, value: features[sym]?.[m.key] != null ? features[sym][m.key] * scale : null }))
                return (
                  <div key={m.key}>
                    <p className="mb-1 text-sm font-medium text-secondary">{m.label}</p>
                    <ResponsiveContainer width="100%" height={110}>
                      <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} className={chartClass}>
                        <XAxis dataKey="sym" axisLine={false} tickLine={false} fill="currentColor" interval={0} />
                        <YAxis hide domain={['auto', 'auto']} />
                        <Tooltip cursor={{ className: 'fill-utility-neutral-50' }} content={<ChartTooltipContent />}
                          formatter={v => formatValue(v / scale, m.format, m.decimals)} />
                        <Bar dataKey="value" name={m.label} radius={[3, 3, 0, 0]} maxBarSize={28}>
                          {data.map(d => <Cell key={d.sym} fill={colorOf(d.sym)} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )
              })}
            </div>
          </Card>

          <TableCard.Root size="sm">
            <TableCard.Header title="Metrics" description="Exact latest values" />
            <div className="overflow-x-auto">
              <Table aria-label="Metrics comparison">
                <Table.Header>
                  <Table.Head id="metric" label="Metric" isRowHeader />
                  {selected.map(sym => <Table.Head key={sym} id={sym} label={sym} />)}
                </Table.Header>
                <Table.Body items={COMPARE_METRICS.map(m => ({ ...m, id: m.key }))} dependencies={[selected, features]}>
                  {m => (
                    <Table.Row id={m.key}>
                      <Table.Cell className="text-secondary">{m.label}</Table.Cell>
                      {selected.map(sym => (
                        <Table.Cell key={sym} className="whitespace-nowrap font-medium text-primary tabular-nums">
                          {formatValue(features[sym]?.[m.key], m.format, m.decimals)}
                        </Table.Cell>
                      ))}
                    </Table.Row>
                  )}
                </Table.Body>
              </Table>
            </div>
          </TableCard.Root>
        </div>
      )}
    </div>
  )
}
