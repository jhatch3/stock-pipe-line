// UI: Untitled UI sidebar navigation, combobox, toggle —
//   https://www.untitledui.com/react/components/sidebar-navigations
//   https://www.untitledui.com/react/components/select
//   https://www.untitledui.com/react/components/toggles
import { createContext, useContext, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { BarChartSquare02, BookOpen01, SwitchHorizontal01, LineChartUp03 } from '@untitledui/icons'
import { SidebarNavigationSimple } from '@/components/application/app-navigation/sidebar-navigation/sidebar-simple'
import { Select } from '@/components/base/select/select'
import { Toggle } from '@/components/base/toggle/toggle'
import { supabase } from '../lib/supabase.js'
import { getInitialTheme, applyTheme, saveTheme } from '../lib/theme.js'

// Ticker universe (symbol, name, sector), fetched once and shared by every page
const TickersContext = createContext([])
export const useTickers = () => useContext(TickersContext)

const NAV_ITEMS = [
  { label: 'Dashboard',  href: '/',           icon: BarChartSquare02 },
  { label: 'Compare',    href: '/compare',    icon: SwitchHorizontal01 },
  { label: 'Indicators', href: '/indicators', icon: BookOpen01 },
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
  return (
    <Toggle
      size="sm"
      label="Dark mode"
      isSelected={theme === 'dark'}
      onChange={on => setTheme(on ? 'dark' : 'light')}
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

  const activeUrl = NAV_ITEMS.find(i => i.href !== '/' && pathname.startsWith(i.href))?.href ?? '/'

  return (
    <TickersContext.Provider value={tickers}>
      <div className="flex min-h-dvh flex-col bg-primary lg:flex-row">
        <SidebarNavigationSimple
          activeUrl={activeUrl}
          items={NAV_ITEMS}
          logo={<Logo />}
          search={<TickerSearch tickers={tickers} />}
          featureCard={<ThemeToggle />}
          showAccountCard={false}
        />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </TickersContext.Provider>
  )
}
