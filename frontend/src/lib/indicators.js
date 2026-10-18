// Client-side chart indicators computed over OHLCV rows (ascending by timestamp).
// Output rows keep the input fields and add:
//   sma50, sma200, bb_upper, bb_middle, bb_lower, vwap, rsi, macd, macd_signal, macd_hist
// Values are null until each indicator's warmup window is filled.

function sma(values, period) {
  const out = new Array(values.length).fill(null)
  let sum = 0
  for (let i = 0; i < values.length; i++) {
    sum += values[i]
    if (i >= period) sum -= values[i - period]
    if (i >= period - 1) out[i] = sum / period
  }
  return out
}

function ema(values, period) {
  const out = new Array(values.length).fill(null)
  const k = 2 / (period + 1)
  let prev = null
  for (let i = 0; i < values.length; i++) {
    const v = values[i]
    if (v == null) continue
    prev = prev == null ? v : v * k + prev * (1 - k)
    out[i] = prev
  }
  return out
}

function bollinger(values, period = 20, mult = 2) {
  const mid = sma(values, period)
  const upper = new Array(values.length).fill(null)
  const lower = new Array(values.length).fill(null)
  for (let i = period - 1; i < values.length; i++) {
    let sq = 0
    for (let j = i - period + 1; j <= i; j++) sq += (values[j] - mid[i]) ** 2
    const sd = Math.sqrt(sq / (period - 1)) // sample std, matches pandas .std()
    upper[i] = mid[i] + mult * sd
    lower[i] = mid[i] - mult * sd
  }
  return { mid, upper, lower }
}

// Wilder-smoothed RSI
function rsi(values, period = 14) {
  const out = new Array(values.length).fill(null)
  if (values.length <= period) return out
  let gain = 0, loss = 0
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1]
    if (d >= 0) gain += d; else loss -= d
  }
  gain /= period; loss /= period
  out[period] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss)
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1]
    gain = (gain * (period - 1) + Math.max(d, 0)) / period
    loss = (loss * (period - 1) + Math.max(-d, 0)) / period
    out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss)
  }
  return out
}

// Intraday bars: VWAP resets each trading day. Daily+ bars: rolling 20-bar VWAP.
function vwap(rows, high, low, close, volume) {
  const out = new Array(rows.length).fill(null)
  const day = i => String(rows[i].timestamp).slice(0, 10)
  const intraday = rows.length > 1 && rows.some((_, i) => i > 0 && day(i) === day(i - 1))

  if (intraday) {
    let pv = 0, vol = 0
    for (let i = 0; i < rows.length; i++) {
      if (i > 0 && day(i) !== day(i - 1)) { pv = 0; vol = 0 }
      pv  += ((high[i] + low[i] + close[i]) / 3) * volume[i]
      vol += volume[i]
      out[i] = vol ? pv / vol : null
    }
    return out
  }

  const period = 20
  for (let i = period - 1; i < rows.length; i++) {
    let pv = 0, vol = 0
    for (let j = i - period + 1; j <= i; j++) {
      pv  += ((high[j] + low[j] + close[j]) / 3) * volume[j]
      vol += volume[j]
    }
    out[i] = vol ? pv / vol : null
  }
  return out
}

export function computeIndicators(rows) {
  const close  = rows.map(r => Number(r.close))
  const high   = rows.map(r => Number(r.high))
  const low    = rows.map(r => Number(r.low))
  const volume = rows.map(r => Number(r.volume) || 0)

  const sma50  = sma(close, 50)
  const sma200 = sma(close, 200)
  const bb     = bollinger(close, 20, 2)
  const rsi14  = rsi(close, 14)
  const vw     = vwap(rows, high, low, close, volume)

  const ema12  = ema(close, 12)
  const ema26  = ema(close, 26)
  const macd   = close.map((_, i) => (i >= 25 ? ema12[i] - ema26[i] : null))
  const signal = ema(macd, 9)
  const macdSignal = macd.map((m, i) => (m != null && i >= 33 ? signal[i] : null))

  return rows.map((r, i) => ({
    ...r,
    sma50:       sma50[i],
    sma200:      sma200[i],
    bb_upper:    bb.upper[i],
    bb_middle:   bb.mid[i],
    bb_lower:    bb.lower[i],
    vwap:        vw[i],
    rsi:         rsi14[i],
    macd:        macd[i],
    macd_signal: macdSignal[i],
    macd_hist:   macd[i] != null && macdSignal[i] != null ? macd[i] - macdSignal[i] : null,
  }))
}
