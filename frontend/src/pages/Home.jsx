import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { SECTOR_STYLES } from '../lib/constants.js'
import Header from '../components/Header.jsx'

// ─── Skeleton Card ────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 animate-pulse">
      <div className="h-5 bg-gray-200 rounded w-16 mb-2" />
      <div className="h-3 bg-gray-100 rounded w-full mb-3" />
      <div className="h-4 bg-gray-100 rounded w-20" />
    </div>
  )
}

// ─── Hero Search ──────────────────────────────────────────────────────────────
function HeroSearch({ tickers, onSelect }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)

  const filtered = query.trim()
    ? tickers
        .filter(
          (t) =>
            t.symbol.toLowerCase().includes(query.toLowerCase()) ||
            (t.name && t.name.toLowerCase().includes(query.toLowerCase()))
        )
        .slice(0, 10)
    : []

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
    onSelect(symbol)
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-2xl">
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg pointer-events-none">
          🔍
        </span>
        <input
          type="text"
          placeholder="Search by ticker symbol or company name…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          className="w-full pl-12 pr-4 py-4 text-base border border-gray-300 rounded-2xl bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
        />
      </div>

      {open && filtered.length > 0 && (
        <div className="absolute top-full mt-2 left-0 right-0 bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden z-50">
          {filtered.map((t, i) => (
            <button
              key={t.symbol}
              onMouseDown={() => handleSelect(t.symbol)}
              className={`w-full flex items-center gap-4 px-5 py-3 text-left hover:bg-blue-50 transition-colors ${
                i !== 0 ? 'border-t border-gray-100' : ''
              }`}
            >
              <span className="font-bold text-gray-900 w-16 shrink-0 text-sm">{t.symbol}</span>
              <span className="text-sm text-gray-600 truncate flex-1">{t.name}</span>
              {t.sector && (
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
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
  )
}

// ─── Ticker Card ──────────────────────────────────────────────────────────────
function TickerCard({ ticker, onClick }) {
  return (
    <button
      onClick={() => onClick(ticker.symbol)}
      className="bg-white border border-gray-200 rounded-xl p-4 text-left hover:shadow-md hover:border-gray-300 transition-all duration-150 group"
    >
      <p className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
        {ticker.symbol}
      </p>
      <p className="text-xs text-gray-500 truncate mt-0.5 mb-3">{ticker.name || '—'}</p>
      {ticker.sector && (
        <span
          className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${
            SECTOR_STYLES[ticker.sector] ?? 'bg-gray-100 text-gray-600'
          }`}
        >
          {ticker.sector}
        </span>
      )}
    </button>
  )
}

// ─── Home Page ────────────────────────────────────────────────────────────────
export default function Home() {
  const [tickers, setTickers] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedSector, setSelectedSector] = useState('All')
  const navigate = useNavigate()

  useEffect(() => {
    async function fetchTickers() {
      setLoading(true)
      const { data, error } = await supabase
        .from('tickers')
        .select('symbol, name, sector')
        .order('symbol', { ascending: true })

      if (!error && data) {
        setTickers(data)
      }
      setLoading(false)
    }
    fetchTickers()
  }, [])

  function handleSelectTicker(symbol) {
    navigate(`/ticker/${symbol}`)
  }

  // Build sorted unique sector list
  const sectors = ['All', ...Array.from(new Set(tickers.map((t) => t.sector).filter(Boolean))).sort()]

  const filteredTickers =
    selectedSector === 'All'
      ? tickers
      : tickers.filter((t) => t.sector === selectedSector)

  return (
    <div className="min-h-screen bg-white">
      <Header tickers={tickers} onSelectTicker={handleSelectTicker} />

      {/* Hero */}
      <section className="bg-gradient-to-b from-gray-50 to-white pt-16 pb-12 px-4">
        <div className="max-w-screen-xl mx-auto flex flex-col items-center text-center gap-6">
          <div>
            <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 tracking-tight">
              Stock Analytics Dashboard
            </h1>
            <p className="mt-3 text-lg text-gray-500 max-w-xl mx-auto">
              Explore technical indicators, risk metrics, and fundamentals for 200+ tickers.
            </p>
          </div>
          <HeroSearch tickers={tickers} onSelect={handleSelectTicker} />
        </div>
      </section>

      {/* Sector Filter */}
      <section className="sticky top-14 z-40 bg-white border-b border-gray-100 px-4">
        <div className="max-w-screen-xl mx-auto">
          <div className="flex items-center gap-2 py-3 overflow-x-auto">
            {sectors.map((sector) => (
              <button
                key={sector}
                onClick={() => setSelectedSector(sector)}
                className={`whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium border transition-all shrink-0 ${
                  selectedSector === sector
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-gray-500 hover:text-gray-900'
                }`}
              >
                {sector}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Ticker Grid */}
      <main className="max-w-screen-xl mx-auto px-4 py-8">
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {Array.from({ length: 30 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : filteredTickers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-400">
            <span className="text-5xl mb-4">📭</span>
            <p className="text-lg font-medium">No tickers found</p>
            <p className="text-sm mt-1">Try selecting a different sector</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-400 mb-4">
              {filteredTickers.length} ticker{filteredTickers.length !== 1 ? 's' : ''}
              {selectedSector !== 'All' ? ` in ${selectedSector}` : ''}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {filteredTickers.map((ticker) => (
                <TickerCard key={ticker.symbol} ticker={ticker} onClick={handleSelectTicker} />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
