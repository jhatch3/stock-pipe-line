// Shared presentation helpers for pages built on Untitled UI tokens.

// Untitled UI card surface
export const CARD = 'rounded-xl bg-primary shadow-xs ring-1 ring-secondary ring-inset'

export const fmtPct = v => (v == null ? '—' : `${v >= 0 ? '+' : ''}${(v * 100).toFixed(2)}%`)
export const fmtPrice = v =>
  v == null ? '—' : `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
