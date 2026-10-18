// UI: Untitled UI badge — https://www.untitledui.com/react/components/badges
import { useState, useEffect } from 'react'
import { Stars02 } from '@untitledui/icons'
import { Badge } from '@/components/base/badges/badges'
import { supabase } from '../lib/supabase.js'
import { CARD } from '../lib/ui.js'

export default function AgentPanel({ ticker }) {
  const [analysis, setAnalysis] = useState(undefined)   // undefined = loading, null = none

  // Latest stored analysis for this ticker
  useEffect(() => {
    if (!ticker) return
    setAnalysis(undefined)
    supabase
      .from('stock_ai_analysis')
      .select('ticker,summary,sources,as_of_utc')
      .eq('ticker', ticker)
      .order('as_of_utc', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setAnalysis(data ?? null))
  }, [ticker])

  const asOf = analysis?.as_of_utc
    ? new Date(analysis.as_of_utc).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
    : null

  return (
    <section className={`${CARD} flex h-full flex-col p-5`}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-lg bg-brand-secondary">
          <Stars02 className="size-4 text-fg-brand-primary" aria-hidden="true" />
        </span>
        <h2 className="text-lg font-semibold text-primary">AI analysis</h2>
        <Badge type="color" size="sm" color="brand">GPT-4o mini</Badge>
        {asOf && <span className="ml-auto text-xs text-quaternary">{asOf}</span>}
      </div>

      {analysis === undefined ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map(i => <div key={i} className="h-4 animate-pulse rounded bg-secondary" />)}
        </div>
      ) : analysis?.summary ? (
        <p className="text-md leading-relaxed whitespace-pre-wrap text-secondary">{analysis.summary}</p>
      ) : (
        <p className="py-6 text-center text-sm text-tertiary">No analysis available for {ticker} yet.</p>
      )}
    </section>
  )
}
