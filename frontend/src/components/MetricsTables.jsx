// Exact values for every stored feature: one Untitled UI table card, a tab per section.
// UI: Untitled UI table + tabs — https://www.untitledui.com/react/components/tables
import { useState } from 'react'
import { Table, TableCard } from '@/components/application/table/table'
import { Tabs, TabList } from '@/components/application/tabs/tabs'
import { FEATURE_SECTIONS, formatValue } from '../lib/constants.js'
import { median, percentile } from '../lib/peers.js'

// Price-level indicators (dollar amounts) aren't comparable across stocks
const comparable = field => field.format !== 'currency' && !field.key.startsWith('macd')

export default function MetricsTables({ features, peers, symbol }) {
  const [tab, setTab] = useState(FEATURE_SECTIONS[0].id)
  const section = FEATURE_SECTIONS.find(s => s.id === tab)

  return (
    <TableCard.Root size="sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-secondary px-4 py-4 md:px-6">
        <div>
          <h2 className="text-md font-semibold text-primary">All metrics</h2>
          <p className="text-sm text-tertiary">{section.description}</p>
        </div>
        <div className="max-w-full overflow-x-auto scrollbar-hide">
          <Tabs selectedKey={tab} onSelectionChange={setTab}>
            <TabList type="button-border" size="sm" className="w-max"
              items={FEATURE_SECTIONS.map(s => ({ id: s.id, label: s.title }))} />
          </Tabs>
        </div>
      </div>
      <Table aria-label={section.title}>
        <Table.Header>
          <Table.Head id="metric" label="Metric" isRowHeader className="w-full" />
          <Table.Head id="value" label="Value" />
          <Table.Head id="median" label="Sector median" />
          <Table.Head id="pct" label="Sector pctl." tooltip="Share of sector peers this stock beats on the metric (higher is better)" />
        </Table.Header>
        <Table.Body items={section.fields.map(f => ({ ...f, id: f.key }))} dependencies={[tab, peers, features]}>
          {field => {
            const pct = field.higherBetter == null ? null : percentile(peers, symbol, field.key, field.higherBetter)
            return (
              <Table.Row id={field.key}>
                <Table.Cell className="text-secondary">{field.label}</Table.Cell>
                <Table.Cell className="whitespace-nowrap font-medium text-primary tabular-nums">
                  {formatValue(features?.[field.key], field.format, field.decimals)}
                </Table.Cell>
                <Table.Cell className="whitespace-nowrap tabular-nums">
                  {comparable(field) ? formatValue(median(peers, field.key), field.format, field.decimals) : '—'}
                </Table.Cell>
                <Table.Cell className="whitespace-nowrap tabular-nums">
                  {pct == null ? '—' : Math.round(pct)}
                </Table.Cell>
              </Table.Row>
            )
          }}
        </Table.Body>
      </Table>
    </TableCard.Root>
  )
}
