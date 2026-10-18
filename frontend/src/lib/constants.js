import { TrendUp01, Scales02, Compass03, CurrencyDollarCircle, Bank } from '@untitledui/icons'

// Untitled UI Badge color per sector (yfinance sector names)
export const SECTOR_BADGE_COLOR = {
  'Technology':             'blue',
  'Financial Services':     'success',
  'Healthcare':             'error',
  'Industrials':            'slate',
  'Energy':                 'warning',
  'Consumer Cyclical':      'orange',
  'Consumer Defensive':     'pink',
  'Utilities':              'sky',
  'Basic Materials':        'gray',
  'Communication Services': 'purple',
  'Real Estate':            'indigo',
  'ETF':                    'brand',
}

export const SECTION_COLORS = {
  blue:    { borderColor: 'border-blue-500',    headerBg: 'bg-blue-50',    accentText: 'text-blue-700' },
  violet:  { borderColor: 'border-violet-500',  headerBg: 'bg-violet-50',  accentText: 'text-violet-700' },
  emerald: { borderColor: 'border-emerald-500', headerBg: 'bg-emerald-50', accentText: 'text-emerald-700' },
  rose:    { borderColor: 'border-rose-500',    headerBg: 'bg-rose-50',    accentText: 'text-rose-700' },
  amber:   { borderColor: 'border-amber-500',   headerBg: 'bg-amber-50',   accentText: 'text-amber-700' },
  indigo:  { borderColor: 'border-indigo-500',  headerBg: 'bg-indigo-50',  accentText: 'text-indigo-700' },
  slate:   { borderColor: 'border-slate-500',   headerBg: 'bg-slate-50',   accentText: 'text-slate-700' },
}

// Field keys match the columns written by data/features.py (compute_features_df).
// Percent fields are stored as fractions (0.12 = 12%).
// higherBetter: true/false drives sector rank badges; null = no rank.
export const FEATURE_SECTIONS = [
  {
    id: 'technical', title: 'Technical Indicators', icon: TrendUp01, color: 'violet',
    description: 'RSI, MACD, Bollinger Bands, VWAP',
    fields: [
      { key: 'rsi',            label: 'RSI (14)',        format: 'number',   decimals: 1, higherBetter: null },
      { key: 'macd',           label: 'MACD',            format: 'number',   decimals: 3, higherBetter: null },
      { key: 'macd_signal',    label: 'MACD Signal',     format: 'number',   decimals: 3, higherBetter: null },
      { key: 'macd_histogram', label: 'MACD Histogram',  format: 'number',   decimals: 3, higherBetter: null },
      { key: 'bb_upper',       label: 'BB Upper',        format: 'currency', decimals: 2, higherBetter: null },
      { key: 'bb_middle',      label: 'BB Middle',       format: 'currency', decimals: 2, higherBetter: null },
      { key: 'bb_lower',       label: 'BB Lower',        format: 'currency', decimals: 2, higherBetter: null },
      { key: 'bb_bandwidth',   label: 'BB Bandwidth',    format: 'percent',  decimals: 2, higherBetter: null },
      { key: 'vwap',           label: 'VWAP',            format: 'currency', decimals: 2, higherBetter: null },
      { key: 'vix',            label: 'VIX',             format: 'number',   decimals: 2, higherBetter: null },
    ],
  },
  {
    id: 'risk', title: 'Risk & Return', icon: Scales02, color: 'rose',
    description: 'Rolling volatility and risk-adjusted returns',
    fields: [
      { key: 'volatility',    label: 'Volatility (Ann.)', format: 'percent', decimals: 2, higherBetter: false },
      { key: 'sharpe_ratio',  label: 'Sharpe Ratio',      format: 'number',  decimals: 2, higherBetter: true  },
      { key: 'sortino_ratio', label: 'Sortino Ratio',     format: 'number',  decimals: 2, higherBetter: true  },
      { key: 'max_drawdown',  label: 'Max Drawdown',      format: 'percent', decimals: 2, higherBetter: true  },
      { key: 'var_95',        label: 'VaR (95%)',         format: 'percent', decimals: 2, higherBetter: true  },
      { key: 'skewness',      label: 'Skewness',          format: 'number',  decimals: 2, higherBetter: null  },
      { key: 'kurtosis',      label: 'Kurtosis',          format: 'number',  decimals: 2, higherBetter: null  },
    ],
  },
  {
    id: 'market', title: 'Market Relative', icon: Compass03, color: 'blue',
    description: 'vs. SPY benchmark',
    fields: [
      { key: 'beta',              label: 'Beta',              format: 'number',  decimals: 2, higherBetter: null },
      { key: 'alpha',             label: "Jensen's Alpha",    format: 'percent', decimals: 2, higherBetter: true },
      { key: 'correlation',       label: 'Correlation',       format: 'number',  decimals: 2, higherBetter: null },
      { key: 'r_squared',         label: 'R²',                format: 'number',  decimals: 2, higherBetter: null },
      { key: 'information_ratio', label: 'Information Ratio', format: 'number',  decimals: 2, higherBetter: true },
    ],
  },
  {
    id: 'valuation', title: 'Valuation', icon: CurrencyDollarCircle, color: 'amber',
    description: 'Price multiples',
    fields: [
      { key: 'pe_ratio',   label: 'P/E (TTM)',  format: 'number',   decimals: 1, higherBetter: false },
      { key: 'forward_pe', label: 'Forward P/E', format: 'number',  decimals: 1, higherBetter: false },
      { key: 'pb_ratio',   label: 'P/B',        format: 'number',   decimals: 2, higherBetter: false },
      { key: 'ps_ratio',   label: 'P/S',        format: 'number',   decimals: 2, higherBetter: false },
      { key: 'ev_ebitda',  label: 'EV/EBITDA',  format: 'number',   decimals: 2, higherBetter: false },
      { key: 'pcf_ratio',  label: 'P/CF',       format: 'number',   decimals: 2, higherBetter: false },
      { key: 'peg_ratio',  label: 'PEG',        format: 'number',   decimals: 2, higherBetter: false },
      { key: 'eps',        label: 'EPS (TTM)',  format: 'currency', decimals: 2, higherBetter: true  },
    ],
  },
  {
    id: 'fundamentals', title: 'Profitability & Health', icon: Bank, color: 'emerald',
    description: 'Returns, margins, leverage',
    fields: [
      { key: 'roe',                     label: 'ROE',               format: 'percent', decimals: 2, higherBetter: true  },
      { key: 'roa',                     label: 'ROA',               format: 'percent', decimals: 2, higherBetter: true  },
      { key: 'net_profit_margin',       label: 'Net Margin',        format: 'percent', decimals: 2, higherBetter: true  },
      { key: 'debt_to_equity',          label: 'Debt / Equity',     format: 'number',  decimals: 2, higherBetter: false },
      { key: 'current_ratio',           label: 'Current Ratio',     format: 'number',  decimals: 2, higherBetter: true  },
      { key: 'interest_coverage_ratio', label: 'Interest Coverage', format: 'number',  decimals: 2, higherBetter: true  },
    ],
  },
]

export function formatValue(value, format, decimals = 2) {
  if (value === null || value === undefined || value === '') return '—'
  if (format === null || format === undefined) return String(value)
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  const opts = { minimumFractionDigits: decimals, maximumFractionDigits: decimals }
  switch (format) {
    case 'percent':  return `${(n * 100).toLocaleString('en-US', opts)}%`
    case 'currency': return `$${n.toLocaleString('en-US', opts)}`
    default:         return n.toLocaleString('en-US', opts)
  }
}
