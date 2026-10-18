// UI: Untitled UI header navigation, combobox, button —
//   https://www.untitledui.com/react/components/header-navigations
//   https://www.untitledui.com/react/components/select
//   https://www.untitledui.com/react/components/buttons
import { createContext, useContext, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { LineChartUp03, Moon01, Sun } from '@untitledui/icons'
import { HeaderNavigationBase } from '@/components/application/app-navigation/header-navigation'
import { Button } from '@/components/base/buttons/button'
import { Select } from '@/components/base/select/select'
import { supabase } from '../lib/supabase.js'
import { getInitialTheme, applyTheme, saveTheme } from '../lib/theme.js'

// Ticker universe (symbol, name, sector), fetched once and shared by every page
const TickersContext = createContext([])
export const useTickers = () => useContext(TickersContext)

const NAV_ITEMS = [
  { label: 'Dashboard',  href: '/' },
  { label: 'Compare',    href: '/compare' },
  { label: 'Indicators', href: '/indicators' },
]

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2 text-lg font-semibold text-primary">
      <span className="flex size-8 items-center justify-center rounded-lg bg-brand-solid text-white">
        <LineChartUp03 className="size-5" />
      </span>
      StockIQ
    </Link>
  )
}

function TickerSearch({ tickers }) {
  const navigate = useNavigate()
  const items = tickers.map(t => ({ id: t.symbol, label: t.symbol, supportingText: t.name ?? '' }))
  return (
    <Select.ComboBox
      aria-label="Search tickers"
      placeholder="Search tickers"
      size="sm"
      shortcut={false}
      items={items}
      selectedKey={null}
      onSelectionChange={key => { if (key) navigate(`/ticker/${key}`) }}
    >
      {item => <Select.Item id={item.id} label={item.label} supportingText={item.supportingText} />}
    </Select.ComboBox>
  )
}

function ThemeToggle() {
  const [theme, setTheme] = useState(getInitialTheme)
  useEffect(() => { applyTheme(theme); saveTheme(theme) }, [theme])
  const dark = theme === 'dark'
  return (
    <Button
      size="sm"
      color="tertiary"
      iconLeading={dark ? Sun : Moon01}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      onPress={() => setTheme(dark ? 'light' : 'dark')}
    />
  )
}

export default function AppShell({ children }) {
  const { pathname } = useLocation()
  const [tickers, setTickers] = useState([])

  useEffect(() => {
    supabase.from('tickers').select('symbol,name,sector').order('symbol')
      .then(({ data }) => { if (data) setTickers(data) })
  }, [])

  return (
    <TickersContext.Provider value={tickers}>
      <div className="flex min-h-dvh flex-col bg-primary">
        <div className="sticky top-0 z-50">
          <HeaderNavigationBase
            activeUrl={pathname}
            items={NAV_ITEMS}
            logo={<Logo />}
            actions={
              <>
                <div className="w-72"><TickerSearch tickers={tickers} /></div>
                <ThemeToggle />
              </>
            }
            mobileContent={
              <>
                <TickerSearch tickers={tickers} />
                <ThemeToggle />
              </>
            }
          />
        </div>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </TickersContext.Provider>
  )
}
