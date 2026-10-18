// UI: Untitled UI header navigation, combobox —
//   https://www.untitledui.com/react/components/header-navigations
//   https://www.untitledui.com/react/components/select
import { createContext, useContext, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { HeaderNavigationBase } from '@/components/application/app-navigation/header-navigation'
import { Select } from '@/components/base/select/select'
import { supabase } from '../lib/supabase.js'

// Ticker universe (symbol, name, sector), fetched once and shared by every page
const TickersContext = createContext([])
export const useTickers = () => useContext(TickersContext)

const NAV_ITEMS = [
  { label: 'Dashboard',  href: '/' },
  { label: 'Compare',    href: '/compare' },
  { label: 'Indicators', href: '/indicators' },
]

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
            logo={false}
            actions={<div className="w-72"><TickerSearch tickers={tickers} /></div>}
            mobileContent={<TickerSearch tickers={tickers} />}
          />
        </div>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </TickersContext.Provider>
  )
}
