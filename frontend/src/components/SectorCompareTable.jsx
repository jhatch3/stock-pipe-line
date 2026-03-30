import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { formatValue, SECTOR_STYLES } from '../lib/constants.js'

// higherBetter: true = rank 1 is highest value, false = rank 1 is lowest, null = no rank badge
const COLUMNS = [
  { key: 'symbol',            label: 'Ticker',     format: null,      decimals: 2, higherBetter: null  },
  { key: 'rsi',               label: 'RSI',        format: 'number',  decimals: 1, higherBetter: null  },
  { key: 'volatility',        label: 'Volatility', format: 'percent', decimals: 2, higherBetter: false },
  { key: 'sharpe_ratio',      label: 'Sharpe',     format: 'number',  decimals: 2, higherBetter: true  },
  { key: 'sortino_ratio',     label: 'Sortino',    format: 'number',  decimals: 2, higherBetter: true  },
  { key: 'beta',              label: 'Beta',       format: 'number',  decimals: 2, higherBetter: null  },
  { key: 'alpha',             label: 'Alpha',      format: 'percent', decimals: 2, higherBetter: true  },
  { key: 'max_drawdown',      label: 'Max DD',     format: 'percent', decimals: 2, higherBetter: true  },
  { key: 'pe_ratio',          label: 'P/E',        format: 'number',  decimals: 1, higherBetter: false },
  { key: 'pb_ratio',          label: 'P/B',        format: 'number',  decimals: 2, higherBetter: false },
  { key: 'roe',               label: 'ROE',        format: 'percent', decimals: 2, higherBetter: true  },
  { key: 'net_profit_margin', label: 'Net Margin', format: 'percent', decimals: 2, higherBetter: true  },
  { key: 'debt_to_equity',    label: 'D/E',        format: 'number',  decimals: 2, higherBetter: false },
]

export default function SectorCompareTable({ symbol, sector }) {
  const navigate   = useNavigate()
  const [rows,     setRows]     = useState([])
  const [sortKey,  setSortKey]  = useState('sharpe_ratio')
  const [sortAsc,  setSortAsc]  = useState(false)
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    if (!sector) return
    let cancelled = false

    async function load() {
      setLoading(true)

      // 1. Get all tickers in this sector
      const { data: tickerRows } = await supabase
        .from('tickers')
        .select('symbol,name')
        .eq('sector', sector)

      if (!tickerRows?.length || cancelled) { setLoading(false); return }

      const symbols = tickerRows.map(t => t.symbol)

      // 2. Fetch latest features row for each ticker (1h interval)
      const { data: featRows } = await supabase
        .from('stock_features')
        .select('ticker,timestamp,rsi,volatility,sharpe_ratio,sortino_ratio,beta,alpha,max_drawdown,pe_ratio,pb_ratio,roe,net_profit_margin,debt_to_equity')
        .in('ticker', symbols)
        .eq('interval', '1h')
        .order('timestamp', { ascending: false })
        .limit(5000)

      if (cancelled) return

      // Keep only the most-recent row per ticker
      const seen = new Set()
      const latest = (featRows ?? []).filter(r => {
        if (seen.has(r.ticker)) return false
        seen.add(r.ticker)
        return true
      })

      // Merge ticker name
      const nameMap = Object.fromEntries(tickerRows.map(t => [t.symbol, t.name]))
      const merged  = latest.map(r => ({ ...r, symbol: r.ticker, name: nameMap[r.ticker] ?? r.ticker }))

      setRows(merged)
      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [sector])

  function handleSort(key) {
    if (sortKey === key) setSortAsc(v => !v)
    else { setSortKey(key); setSortAsc(false) }
  }

  const sorted = [...rows].sort((a, b) => {
    const av = a[sortKey], bv = b[sortKey]
    if (av == null && bv == null) return 0
    if (av == null) return 1
    if (bv == null) return -1
    const cmp = typeof av === 'string' ? av.localeCompare(bv) : av - bv
    return sortAsc ? cmp : -cmp
  })

  const sectorClass = SECTOR_STYLES[sector] ?? 'bg-gray-100 text-gray-600'

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-2">
          <span className="text-lg">🏢</span>
          <h3 className="font-semibold text-gray-900 text-sm">Sector Comparison</h3>
          {sector && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sectorClass}`}>
              {sector}
            </span>
          )}
        </div>
        <span className="text-xs text-gray-400">{rows.length} tickers · click to sort</span>
      </div>

      {loading ? (
        <div className="h-32 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <div className="h-24 flex items-center justify-center text-gray-400 text-sm">
          No sector data available
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100">
                {COLUMNS.map(col => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className={`px-3 py-2.5 text-left font-semibold text-gray-500 cursor-pointer select-none hover:text-gray-900 whitespace-nowrap transition-colors ${
                      sortKey === col.key ? 'text-gray-900' : ''
                    }`}
                  >
                    {col.label}
                    {sortKey === col.key && (
                      <span className="ml-1 text-gray-400">{sortAsc ? '↑' : '↓'}</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, idx) => {
                const isCurrent = row.symbol === symbol
                return (
                  <tr
                    key={row.symbol}
                    onClick={() => navigate(`/ticker/${row.symbol}`)}
                    className={`border-b border-gray-50 cursor-pointer transition-colors ${
                      isCurrent
                        ? 'bg-blue-50 hover:bg-blue-100'
                        : idx % 2 === 0 ? 'bg-white hover:bg-gray-50' : 'bg-gray-50/50 hover:bg-gray-50'
                    }`}
                  >
                    {COLUMNS.map(col => {
                      if (col.key === 'symbol') {
                        return (
                          <td key="symbol" className="px-3 py-2.5 whitespace-nowrap">
                            <span className={`font-bold ${isCurrent ? 'text-blue-700' : 'text-gray-900'}`}>
                              {row.symbol}
                            </span>
                            {isCurrent && (
                              <span className="ml-1.5 text-[10px] text-blue-500 font-medium">●</span>
                            )}
                          </td>
                        )
                      }
                      const val = row[col.key]
                      const fmted = formatValue(val, col.format, col.decimals)
                      return (
                        <td
                          key={col.key}
                          className={`px-3 py-2.5 tabular-nums whitespace-nowrap ${
                            fmted === '—' ? 'text-gray-300' : 'text-gray-700'
                          }`}
                        >
                          {fmted}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
