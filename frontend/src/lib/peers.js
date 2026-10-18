// Sector-peer statistics over rows of latest feature values (one row per ticker).

export function median(rows, key) {
  const xs = rows.map(r => r[key]).filter(v => v != null).sort((a, b) => a - b)
  if (!xs.length) return null
  const m = Math.floor(xs.length / 2)
  return xs.length % 2 ? xs[m] : (xs[m - 1] + xs[m]) / 2
}

// Share of peers (0–100) the ticker beats on `key`; higherBetter=false flips the order.
export function percentile(rows, symbol, key, higherBetter = true) {
  const me = rows.find(r => r.ticker === symbol)?.[key]
  const peers = rows.filter(r => r.ticker !== symbol && r[key] != null)
  if (me == null || !peers.length) return null
  const beaten = peers.filter(r => (higherBetter ? me > r[key] : me < r[key])).length
  const ties = peers.filter(r => r[key] === me).length
  return ((beaten + ties / 2) / peers.length) * 100
}
