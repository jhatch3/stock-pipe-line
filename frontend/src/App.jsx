import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home.jsx'
import TickerDetail from './pages/TickerDetail.jsx'
import Compare from './pages/Compare.jsx'
import Indicators from './pages/Indicators.jsx'
import AppShell from './components/AppShell.jsx'

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/ticker/:symbol" element={<TickerDetail />} />
        <Route path="/compare" element={<Compare />} />
        <Route path="/indicators" element={<Indicators />} />
      </Routes>
    </AppShell>
  )
}
