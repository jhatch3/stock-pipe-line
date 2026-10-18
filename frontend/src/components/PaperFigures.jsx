// Live example figures for the Indicators paper: SPY daily bars with each indicator,
// computed in the browser by src/lib/indicators.js (the same code the price chart uses).
import { useEffect, useState } from 'react'
import {
  Area, Bar, CartesianGrid, Cell, ComposedChart, Line, ReferenceArea, ReferenceLine,
  ResponsiveContainer, XAxis, YAxis,
} from 'recharts'
import { supabase } from '../lib/supabase.js'
import { computeIndicators } from '../lib/indicators.js'

const SYMBOL = 'SPY'
const DISPLAY_DAYS = 365
const WARMUP_DAYS = 330 // ~220 trading days so SMA 200 is defined across the whole window

export function useSpyIndicators() {
  const [rows, setRows] = useState(null)
  useEffect(() => {
    const since = new Date()
    since.setDate(since.getDate() - DISPLAY_DAYS - WARMUP_DAYS)
    supabase.from('stock_clean_data_yf').select('timestamp,open,high,low,close,volume')
      .eq('ticker', SYMBOL).eq('interval', '1d').gte('timestamp', since.toISOString())
      .order('timestamp', { ascending: true })
      .then(({ data }) => {
        if (!data?.length) return setRows([])
        const cutoff = new Date()
        cutoff.setDate(cutoff.getDate() - DISPLAY_DAYS)
        setRows(computeIndicators(data).filter(r => new Date(r.timestamp) >= cutoff))
      })
  }, [])
  return rows
}

const axis = { axisLine: false, tickLine: false, tick: { fontSize: 11, fill: '#555' } }
const fmtMonth = ts => new Date(ts).toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' })
const PRICE = '#222'

function Figure({ n, caption, rows, height = 200, children }) {
  return (
    <figure className="my-6">
      <div className="border border-gray-300 px-2 pt-3 pb-1" style={{ height }}>
        {rows == null ? (
          <div className="h-full animate-pulse bg-gray-100" />
        ) : rows.length === 0 ? (
          <p className="flex h-full items-center justify-center text-sm text-gray-500">No {SYMBOL} data</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
        )}
      </div>
      <figcaption className="mt-2 text-center text-[0.92rem]">
        <span className="font-bold">Figure {n}.</span> {caption}
      </figcaption>
    </figure>
  )
}

function PriceFrame({ rows, children, domain = ['auto', 'auto'] }) {
  return (
    <ComposedChart data={rows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
      <CartesianGrid stroke="#e5e5e5" vertical={false} />
      <XAxis dataKey="timestamp" tickFormatter={fmtMonth} minTickGap={50} {...axis} />
      <YAxis domain={domain} tickFormatter={v => v.toFixed(0)} width={40} {...axis} />
      {children}
    </ComposedChart>
  )
}

const line = (key, color, dash) => (
  <Line type="monotone" dataKey={key} stroke={color} strokeWidth={1.4} strokeDasharray={dash}
    dot={false} isAnimationActive={false} connectNulls />
)

export function SmaFigure({ n, rows }) {
  return (
    <Figure n={n} rows={rows}
      caption={<>{SYMBOL} daily close (solid) with SMA<sub>50</sub> (dashed) and SMA<sub>200</sub> (dotted) over the past year.</>}>
      <PriceFrame rows={rows}>
        {line('close', PRICE)}
        {line('sma50', '#0d9488', '6 3')}
        {line('sma200', '#b45309', '2 3')}
      </PriceFrame>
    </Figure>
  )
}

export function BollingerFigure({ n, rows }) {
  return (
    <Figure n={n} rows={rows}
      caption={<>{SYMBOL} close with Bollinger bands (<i>n</i> = 20, <i>k</i> = 2); the shaded region is [<i>L<sub>t</sub></i>, <i>U<sub>t</sub></i>].</>}>
      <PriceFrame rows={(rows ?? []).map(r => ({ ...r, band: r.bb_lower != null ? [r.bb_lower, r.bb_upper] : null }))}>
        <Area type="monotone" dataKey="band" stroke="none" fill="#0d9488" fillOpacity={0.12} isAnimationActive={false} connectNulls />
        {line('bb_middle', '#0d9488', '6 3')}
        {line('close', PRICE)}
      </PriceFrame>
    </Figure>
  )
}

export function RsiFigure({ n, rows }) {
  return (
    <Figure n={n} rows={rows} height={170}
      caption={<>RSI<sub>14</sub> of {SYMBOL}. Shaded bands mark the oversold (&lt; 30) and overbought (&gt; 70) regions.</>}>
      <ComposedChart data={rows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#e5e5e5" vertical={false} />
        <XAxis dataKey="timestamp" tickFormatter={fmtMonth} minTickGap={50} {...axis} />
        <YAxis domain={[0, 100]} ticks={[0, 30, 50, 70, 100]} width={40} {...axis} />
        <ReferenceArea y1={70} y2={100} fill="#e11d48" fillOpacity={0.07} />
        <ReferenceArea y1={0} y2={30} fill="#16a34a" fillOpacity={0.07} />
        <ReferenceLine y={50} stroke="#bbb" strokeDasharray="3 3" />
        {line('rsi', PRICE)}
      </ComposedChart>
    </Figure>
  )
}

export function MacdFigure({ n, rows }) {
  return (
    <Figure n={n} rows={rows} height={180}
      caption={<>MACD line (solid), signal line (dashed) and histogram for {SYMBOL}.</>}>
      <ComposedChart data={rows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#e5e5e5" vertical={false} />
        <XAxis dataKey="timestamp" tickFormatter={fmtMonth} minTickGap={50} {...axis} />
        <YAxis width={40} tickFormatter={v => v.toFixed(0)} {...axis} />
        <ReferenceLine y={0} stroke="#999" />
        <Bar dataKey="macd_hist" isAnimationActive={false}>
          {(rows ?? []).map((r, i) => <Cell key={i} fill={(r.macd_hist ?? 0) >= 0 ? '#16a34a' : '#e11d48'} fillOpacity={0.55} />)}
        </Bar>
        {line('macd', PRICE)}
        {line('macd_signal', '#0d9488', '6 3')}
      </ComposedChart>
    </Figure>
  )
}

export function VwapFigure({ n, rows }) {
  return (
    <Figure n={n} rows={rows}
      caption={<>{SYMBOL} close (solid) and its rolling 20-day VWAP (dashed), the daily-bar variant described in Section 6.</>}>
      <PriceFrame rows={rows}>
        {line('close', PRICE)}
        {line('vwap', '#0d9488', '6 3')}
      </PriceFrame>
    </Figure>
  )
}
