import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import Header from '../components/Header.jsx'

const INDICATORS = [
  {
    id: 'rsi',
    name: 'RSI — Relative Strength Index',
    icon: '📊',
    color: 'violet',
    params: 'Period: 14',
    what: 'Measures the speed and magnitude of recent price changes to evaluate whether a stock is overbought or oversold. Oscillates between 0 and 100.',
    formula: 'RSI = 100 − [100 / (1 + RS)]\nRS = Average Gain over N periods / Average Loss over N periods',
    formulaNote: 'Average Gain and Average Loss are exponentially smoothed after the initial simple average.',
    signals: [
      { level: '> 70', label: 'Overbought', desc: 'Price may have risen too fast; potential reversal or pullback.', color: 'text-rose-600' },
      { level: '< 30', label: 'Oversold',   desc: 'Price may have fallen too fast; potential bounce or reversal.', color: 'text-emerald-600' },
      { level: '50',   label: 'Midline',    desc: 'Crossing above 50 is bullish momentum; below 50 is bearish.', color: 'text-gray-600' },
    ],
    limitations: [
      'In strong uptrends, RSI can remain above 70 for extended periods without a reversal — overbought readings alone are not sell signals.',
      'Generates frequent false signals in ranging, sideways markets.',
      'The 14-period default is arbitrary; shorter periods produce noisier readings, longer periods produce fewer but slower signals.',
    ],
    bestWith: ['MACD (confirm momentum direction)', 'Bollinger Bands (confirm extreme prices)', 'Volume (high RSI + high volume = stronger signal)'],
    timeframes: 'Works on any timeframe. 1h–1d charts are common for swing trades. 4h–1d RSI is more reliable than 1m or 5m for avoiding noise.',
    tip: 'RSI divergence (price makes new high but RSI does not) is a powerful early warning signal.',
  },
  {
    id: 'macd',
    name: 'MACD — Moving Average Convergence Divergence',
    icon: '📈',
    color: 'blue',
    params: 'Fast: 12  ·  Slow: 26  ·  Signal: 9',
    what: 'Trend-following momentum indicator showing the relationship between two EMAs. The histogram shows the distance between the MACD line and its signal line.',
    formula: 'MACD Line   = EMA(12) − EMA(26)\nSignal Line = EMA(9) of MACD Line\nHistogram   = MACD Line − Signal Line',
    formulaNote: 'EMA = Exponential Moving Average. More recent prices receive exponentially higher weight.',
    signals: [
      { level: 'MACD crosses above Signal', label: 'Bullish crossover', desc: 'Potential buy signal, especially when crossing from below zero.', color: 'text-emerald-600' },
      { level: 'MACD crosses below Signal', label: 'Bearish crossover', desc: 'Potential sell signal, especially when crossing from above zero.', color: 'text-rose-600' },
      { level: 'Histogram expanding',       label: 'Momentum building', desc: 'The trend is strengthening in the direction of the bars.', color: 'text-gray-600' },
    ],
    limitations: [
      'Lagging indicator — by definition follows price, so crossover signals come after a move has already started.',
      'Produces many false signals in choppy or sideways markets.',
      'Poorly suited for very short-term (scalping) timeframes due to its smoothing nature.',
    ],
    bestWith: ['RSI (confirm overbought/oversold at crossover)', 'Volume (strong crossover with volume = higher conviction)', 'Support/resistance levels (signals near key levels are more reliable)'],
    timeframes: 'Most reliable on daily and weekly charts for swing and position trading. On hourly charts it can be used for short-term momentum but requires additional confirmation.',
    tip: 'Zero-line crossovers (MACD crossing 0) confirm trend direction changes and are stronger signals than simple crossovers.',
  },
  {
    id: 'bb',
    name: 'Bollinger Bands',
    icon: '〰️',
    color: 'slate',
    params: 'Period: 20  ·  Std Dev: 2σ',
    what: 'Volatility bands placed 2 standard deviations above and below a 20-period SMA. Bands widen during high volatility and contract during low volatility.',
    formula: 'Middle Band = SMA(20)\nUpper Band  = SMA(20) + 2 × σ(20)\nLower Band  = SMA(20) − 2 × σ(20)\nBandwidth   = (Upper − Lower) / Middle',
    formulaNote: 'σ = standard deviation of closing prices over the same N-period window as the SMA.',
    signals: [
      { level: 'Price touches upper band', label: 'Potentially overbought', desc: 'Price is at the high end of its recent range; watch for reversal.', color: 'text-rose-600' },
      { level: 'Price touches lower band', label: 'Potentially oversold',  desc: 'Price is at the low end of its recent range; watch for bounce.', color: 'text-emerald-600' },
      { level: 'Band squeeze',             label: 'Low volatility',        desc: 'Bands narrowing signals a potential breakout is approaching.', color: 'text-amber-600' },
    ],
    limitations: [
      'Touching a band is not a standalone signal — price can "walk the band" during strong trends.',
      'Does not predict the direction of a breakout after a squeeze; requires directional confirmation.',
      'Uses closing prices only, so intraday spikes that close near the open can be missed.',
    ],
    bestWith: ['RSI (RSI at extreme + price at band = stronger reversal signal)', 'Volume (breakout on high volume = more likely sustained)', 'MACD (confirm the breakout direction)'],
    timeframes: 'Flexible — widely used on 1h, 4h, and daily charts. Daily BBs are heavily watched by institutional traders. Very short timeframes generate too much noise.',
    tip: 'The "Bollinger Squeeze" — when bands are at their narrowest in 6 months — often precedes a large directional move.',
  },
  {
    id: 'vwap',
    name: 'VWAP — Volume Weighted Average Price',
    icon: '⚖️',
    color: 'amber',
    params: 'Cumulative from period start',
    what: 'The average price weighted by volume. Institutional traders use VWAP as a benchmark; price above VWAP is bullish, below is bearish.',
    formula: 'VWAP = Σ(Typical Price × Volume) / Σ(Volume)\nTypical Price = (High + Low + Close) / 3',
    formulaNote: 'Cumulative sum resets at the start of each period (day, week, etc.). This makes VWAP anchored to a specific starting point.',
    signals: [
      { level: 'Price above VWAP', label: 'Bullish bias',  desc: 'Buyers are in control; institutions may be accumulating.', color: 'text-emerald-600' },
      { level: 'Price below VWAP', label: 'Bearish bias',  desc: 'Sellers are in control; distribution may be occurring.', color: 'text-rose-600' },
      { level: 'Price returns to VWAP', label: 'Mean reversion', desc: 'Common support/resistance level for intraday traders.', color: 'text-gray-600' },
    ],
    limitations: [
      'VWAP resets each period, so it becomes less meaningful as the period extends — compare current price to multi-day anchored VWAP with care.',
      'On low-volume stocks, a few large trades can distort VWAP dramatically.',
      'Not useful for after-hours analysis since volume is much lower and unrepresentative.',
    ],
    bestWith: ['Volume profile (confirm where institutional interest is concentrated)', 'Price action (candlestick patterns at VWAP rejection levels)', 'SMA 50/200 (VWAP near a major SMA = stronger confluence level)'],
    timeframes: 'Primary use case is intraday (1m, 5m, 15m, 1h). On daily charts it represents longer-term institutional positioning. Less commonly used on weekly/monthly.',
    tip: 'VWAP resets each period. On shorter timeframes it is more useful intraday; on longer timeframes it reflects longer-term institutional positioning.',
  },
  {
    id: 'sma50',
    name: 'SMA 50 — 50-Period Simple Moving Average',
    icon: '📉',
    color: 'indigo',
    params: 'Period: 50',
    what: 'Average closing price over the last 50 bars. Widely watched as a medium-term trend indicator. Price above SMA 50 is generally considered bullish.',
    formula: 'SMA(N) = (P₁ + P₂ + … + Pₙ) / N\nFor SMA 50: N = 50 closing prices',
    formulaNote: 'Each price period has equal weight, unlike EMA which weights recent prices more heavily.',
    signals: [
      { level: 'Price crosses above SMA 50', label: 'Bullish signal', desc: 'Medium-term trend turning positive; potential entry point.', color: 'text-emerald-600' },
      { level: 'Price crosses below SMA 50', label: 'Bearish signal', desc: 'Medium-term trend deteriorating; potential exit or short entry.', color: 'text-rose-600' },
      { level: 'SMA 50 acts as support',     label: 'Trend intact',   desc: 'Price bouncing off SMA 50 in an uptrend confirms the trend.', color: 'text-gray-600' },
    ],
    limitations: [
      'Lagging by nature — the SMA is always behind current price, so signals come after a move has begun.',
      'Gives equal weight to all periods, so a large price spike 49 bars ago still affects the current value.',
      'In sideways markets, price repeatedly crosses the SMA generating false signals.',
    ],
    bestWith: ['SMA 200 (the 50/200 relationship defines macro trend context)', 'RSI (confirm momentum when price crosses SMA)', 'Volume (high-volume crossovers are more reliable)'],
    timeframes: 'On daily charts, SMA 50 represents ~10 trading weeks and is one of the most widely watched medium-term levels. On hourly charts it represents ~2 trading days.',
    tip: 'The SMA 50 / SMA 200 "Golden Cross" (50 crossing above 200) is one of the most cited long-term bullish signals in technical analysis.',
  },
  {
    id: 'sma200',
    name: 'SMA 200 — 200-Period Simple Moving Average',
    icon: '🏔️',
    color: 'pink',
    params: 'Period: 200',
    what: 'Average closing price over the last 200 bars. The most widely followed long-term trend indicator. Separates long-term bull markets from bear markets.',
    formula: 'SMA(N) = (P₁ + P₂ + … + Pₙ) / N\nFor SMA 200: N = 200 closing prices (~40 trading weeks on daily chart)',
    formulaNote: 'Requires 200 bars before the first value is plotted, so it appears blank at the start of a chart with limited history.',
    signals: [
      { level: 'Price above SMA 200', label: 'Bull market territory', desc: 'Long-term trend is up; most institutional investors are bullish.', color: 'text-emerald-600' },
      { level: 'Price below SMA 200', label: 'Bear market territory', desc: 'Long-term trend is down; risk-off sentiment dominates.', color: 'text-rose-600' },
      { level: 'Golden Cross',         label: 'SMA 50 crosses above SMA 200', desc: 'Historically one of the strongest long-term buy signals.', color: 'text-amber-600' },
    ],
    limitations: [
      'Very slow to react — a significant trend reversal can be 10–20% underway before the SMA 200 reflects it.',
      'Self-fulfilling to a degree: because so many traders watch it, bounces at the 200 can occur simply due to collective behavior.',
      'On weekly or monthly charts, it represents an even longer-term average and may be less actionable for short-term traders.',
    ],
    bestWith: ['SMA 50 (Golden/Death Cross setup)', 'RSI (monthly RSI below 30 + price at 200 = extreme long-term entry signal)', 'Fundamental data (value + technical confluence near 200 is a high-conviction entry)'],
    timeframes: 'Primarily used on daily charts where it represents ~40 weeks (nearly a full year). On weekly charts it represents 200 weeks (~4 years) — useful for macro trend analysis.',
    tip: 'A "Death Cross" (SMA 50 crossing below SMA 200) historically signals a potential prolonged bear market and is closely watched by institutions.',
  },
]

const COLOR_MAP = {
  violet: { border: 'border-violet-400', bg: 'bg-violet-50', text: 'text-violet-700', badge: 'bg-violet-100 text-violet-700' },
  blue:   { border: 'border-blue-400',   bg: 'bg-blue-50',   text: 'text-blue-700',   badge: 'bg-blue-100 text-blue-700' },
  slate:  { border: 'border-slate-400',  bg: 'bg-slate-50',  text: 'text-slate-700',  badge: 'bg-slate-100 text-slate-600' },
  amber:  { border: 'border-amber-400',  bg: 'bg-amber-50',  text: 'text-amber-700',  badge: 'bg-amber-100 text-amber-700' },
  indigo: { border: 'border-indigo-400', bg: 'bg-indigo-50', text: 'text-indigo-700', badge: 'bg-indigo-100 text-indigo-700' },
  pink:   { border: 'border-pink-400',   bg: 'bg-pink-50',   text: 'text-pink-700',   badge: 'bg-pink-100 text-pink-700' },
}

export default function Indicators() {
  const navigate  = useNavigate()
  const [tickers, setTickers] = useState([])

  useEffect(() => {
    supabase.from('tickers').select('symbol,name,sector').order('symbol')
      .then(({ data }) => { if (data) setTickers(data) })
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      <Header tickers={tickers} onSelectTicker={sym => navigate(`/ticker/${sym}`)} />

      <main className="max-w-screen-lg mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Technical Indicator Guide</h1>
          <p className="mt-2 text-gray-500 text-sm max-w-2xl">
            A reference for every indicator available in StockIQ charts. Learn what each indicator measures, how to interpret signals, and when to use them.
          </p>
        </div>

        <div className="flex flex-col gap-6">
          {INDICATORS.map(ind => {
            const c = COLOR_MAP[ind.color]
            return (
              <div key={ind.id} className={`bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden`}>
                {/* Header */}
                <div className={`flex items-center gap-3 px-6 py-4 border-l-4 ${c.border} ${c.bg}`}>
                  <span className="text-2xl">{ind.icon}</span>
                  <div>
                    <h2 className={`font-bold text-base ${c.text}`}>{ind.name}</h2>
                    <span className="text-xs text-gray-400 font-mono">{ind.params}</span>
                  </div>
                </div>

                <div className="px-6 py-5 space-y-5">
                  {/* What it measures */}
                  <p className="text-sm text-gray-600 leading-relaxed">{ind.what}</p>

                  {/* Formula */}
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Formula</p>
                    <pre className={`text-xs font-mono ${c.text} bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 whitespace-pre-wrap leading-relaxed`}>{ind.formula}</pre>
                    {ind.formulaNote && (
                      <p className="text-xs text-gray-400 mt-2 italic">{ind.formulaNote}</p>
                    )}
                  </div>

                  {/* Signals */}
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Key Signals</p>
                    <div className="flex flex-col gap-2">
                      {ind.signals.map((s, i) => (
                        <div key={i} className="flex gap-3 items-start">
                          <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded mt-0.5 shrink-0 whitespace-nowrap">{s.level}</span>
                          <div>
                            <span className={`text-xs font-bold ${s.color}`}>{s.label}</span>
                            <span className="text-xs text-gray-500"> — {s.desc}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Two-column: Limitations + Best Used With */}
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Limitations</p>
                      <ul className="flex flex-col gap-1.5">
                        {ind.limitations.map((l, i) => (
                          <li key={i} className="flex gap-2 items-start text-xs text-gray-500">
                            <span className="text-rose-400 mt-0.5 shrink-0">✕</span>
                            <span>{l}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Best Used With</p>
                      <ul className="flex flex-col gap-1.5">
                        {ind.bestWith.map((b, i) => (
                          <li key={i} className="flex gap-2 items-start text-xs text-gray-500">
                            <span className="text-emerald-500 mt-0.5 shrink-0">✓</span>
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Timeframes */}
                  <div className={`rounded-xl border px-4 py-3 ${c.bg} border-gray-100`}>
                    <p className="text-xs text-gray-600">
                      <span className={`font-semibold ${c.text}`}>Timeframes: </span>{ind.timeframes}
                    </p>
                  </div>

                  {/* Pro tip */}
                  <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
                    <p className="text-xs text-gray-500"><span className="font-semibold text-gray-700">Pro tip: </span>{ind.tip}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </main>
    </div>
  )
}
