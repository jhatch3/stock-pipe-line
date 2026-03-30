import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { SECTOR_STYLES } from '../lib/constants.js'

export default function Header({ tickers = [], onSelectTicker }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)
  const navigate = useNavigate()

  const filtered = query.trim()
    ? tickers
        .filter(
          (t) =>
            t.symbol.toLowerCase().includes(query.toLowerCase()) ||
            (t.name && t.name.toLowerCase().includes(query.toLowerCase()))
        )
        .slice(0, 8)
    : []

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleSelect(symbol) {
    setQuery('')
    setOpen(false)
    if (onSelectTicker) {
      onSelectTicker(symbol)
    } else {
      navigate(`/ticker/${symbol}`)
    }
  }

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-screen-xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        {/* Logo */}
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-lg font-bold text-gray-900 hover:text-blue-600 transition-colors whitespace-nowrap"
        >
          <span className="text-xl">📈</span>
          <span>StockIQ</span>
        </button>

        {/* Nav links */}
        <div className="hidden sm:flex items-center gap-4">
          <button
            onClick={() => navigate('/compare')}
            className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-blue-600 transition-colors whitespace-nowrap"
          >
            ⇄ Compare
          </button>
          <button
            onClick={() => navigate('/indicators')}
            className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-blue-600 transition-colors whitespace-nowrap"
          >
            📖 Indicators
          </button>
        </div>

        {/* Search */}
        <div ref={containerRef} className="relative w-64">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">
              🔍
            </span>
            <input
              type="text"
              placeholder="Search tickers…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setOpen(true)
              }}
              onFocus={() => setOpen(true)}
              className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
          </div>

          {open && filtered.length > 0 && (
            <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden z-50">
              {filtered.map((t) => (
                <button
                  key={t.symbol}
                  onMouseDown={() => handleSelect(t.symbol)}
                  className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50 transition-colors"
                >
                  <span className="font-semibold text-sm text-gray-900 w-14 shrink-0">
                    {t.symbol}
                  </span>
                  <span className="text-xs text-gray-500 truncate flex-1">{t.name}</span>
                  {t.sector && (
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded-full font-medium shrink-0 ${
                        SECTOR_STYLES[t.sector] ?? 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {t.sector}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
