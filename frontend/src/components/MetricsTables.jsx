// Exact values for every stored feature, one Untitled UI table per section.
// UI: Untitled UI table — https://www.untitledui.com/react/components/tables
import { Table, TableCard } from '@/components/application/table/table'
import { FEATURE_SECTIONS, formatValue } from '../lib/constants.js'
import { median, percentile } from '../lib/peers.js'

// Price-level indicators (dollar amounts) aren't comparable across stocks
const comparable = field => field.format !== 'currency' && !field.key.startsWith('macd')

export default function MetricsTables({ features, peers, symbol }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {FEATURE_SECTIONS.map(section => (
        <TableCard.Root key={section.id} size="sm">
          <TableCard.Header
            title={
              <span className="flex items-center gap-2">
                <section.icon className="size-5 text-fg-quaternary" aria-hidden="true" />
                {section.title}
              </span>
            }
            description={section.description}
          />
          <Table aria-label={section.title}>
            <Table.Header>
              <Table.Head id="metric" label="Metric" isRowHeader className="w-full" />
              <Table.Head id="value" label="Value" />
              <Table.Head id="median" label="Sector median" />
              <Table.Head id="pct" label="Sector pctl." tooltip="Share of sector peers this stock beats on the metric (higher is better)" />
            </Table.Header>
            <Table.Body items={section.fields.map(f => ({ ...f, id: f.key }))}>
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
                      {pct == null ? '—' : `${Math.round(pct)}`}
                    </Table.Cell>
                  </Table.Row>
                )
              }}
            </Table.Body>
          </Table>
        </TableCard.Root>
      ))}
    </div>
  )
}
