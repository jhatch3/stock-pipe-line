// UI: Untitled UI table + badges — https://www.untitledui.com/react/components/tables
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Table, TableCard } from '@/components/application/table/table'
import { Badge } from '@/components/base/badges/badges'
import { formatValue } from '../lib/constants.js'
import SectorBadge from './SectorBadge.jsx'

const COLUMNS = [
  { key: 'rsi',               label: 'RSI',        format: 'number',  decimals: 1 },
  { key: 'volatility',        label: 'Volatility', format: 'percent', decimals: 2 },
  { key: 'sharpe_ratio',      label: 'Sharpe',     format: 'number',  decimals: 2 },
  { key: 'sortino_ratio',     label: 'Sortino',    format: 'number',  decimals: 2 },
  { key: 'beta',              label: 'Beta',       format: 'number',  decimals: 2 },
  { key: 'alpha',             label: 'Alpha',      format: 'percent', decimals: 2 },
  { key: 'max_drawdown',      label: 'Max DD',     format: 'percent', decimals: 2 },
  { key: 'pe_ratio',          label: 'P/E',        format: 'number',  decimals: 1 },
  { key: 'pb_ratio',          label: 'P/B',        format: 'number',  decimals: 2 },
  { key: 'roe',               label: 'ROE',        format: 'percent', decimals: 2 },
  { key: 'net_profit_margin', label: 'Net margin', format: 'percent', decimals: 2 },
  { key: 'debt_to_equity',    label: 'D/E',        format: 'number',  decimals: 2 },
]

// peers: latest feature row per ticker in the sector (from TickerDetail), each with `ticker`
export default function SectorCompareTable({ symbol, sector, peers }) {
  const navigate = useNavigate()
  const [sort, setSort] = useState({ column: 'sharpe_ratio', direction: 'descending' })

  const rows = useMemo(() => [...peers].sort((a, b) => {
    const av = a[sort.column], bv = b[sort.column]
    if (av == null) return 1
    if (bv == null) return -1
    const cmp = typeof av === 'string' ? av.localeCompare(bv) : av - bv
    return sort.direction === 'ascending' ? cmp : -cmp
  }), [peers, sort])

  return (
    <TableCard.Root size="sm">
      <TableCard.Header
        title="Sector comparison"
        badge={<SectorBadge sector={sector} />}
        description={`${peers.length} stocks · latest hourly features · click a row to open it`}
      />
      {peers.length === 0 ? (
        <p className="px-6 py-10 text-center text-sm text-tertiary">No sector data available</p>
      ) : (
        <div className="overflow-x-auto">
          <Table aria-label={`${sector} sector comparison`} sortDescriptor={sort} onSortChange={setSort}
            onRowAction={key => navigate(`/ticker/${key}`)}>
            <Table.Header>
              <Table.Head id="ticker" label="Ticker" isRowHeader allowsSorting />
              {COLUMNS.map(c => <Table.Head key={c.key} id={c.key} label={c.label} allowsSorting />)}
            </Table.Header>
            <Table.Body items={rows}>
              {row => (
                <Table.Row id={row.ticker} className={row.ticker === symbol ? 'bg-brand-primary_alt' : 'cursor-pointer'}>
                  <Table.Cell className="whitespace-nowrap">
                    <span className="font-semibold text-primary">{row.ticker}</span>
                    {row.ticker === symbol && <Badge type="color" size="sm" color="brand" className="ml-2">This stock</Badge>}
                  </Table.Cell>
                  {COLUMNS.map(c => (
                    <Table.Cell key={c.key} className="whitespace-nowrap tabular-nums">
                      {formatValue(row[c.key], c.format, c.decimals)}
                    </Table.Cell>
                  ))}
                </Table.Row>
              )}
            </Table.Body>
          </Table>
        </div>
      )}
    </TableCard.Root>
  )
}
