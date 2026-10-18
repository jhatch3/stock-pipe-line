// Latest headlines for a ticker from clean_stock_news_data.
import { useEffect, useState } from 'react'
import { LinkExternal01, Inbox01 } from '@untitledui/icons'
import { supabase } from '../lib/supabase.js'
import { CARD } from '../lib/ui.js'

// Alpaca headlines/summaries can contain HTML entities (&#39;, &amp;); decode as plain text
function decode(text) {
  if (!text) return text
  const el = document.createElement('textarea')
  el.innerHTML = text
  return el.value
}

function timeAgo(ts) {
  const mins = Math.round((Date.now() - new Date(ts).getTime()) / 60000)
  if (mins < 60) return `${Math.max(mins, 1)}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.round(hrs / 24)
  return days < 30 ? `${days}d ago` : new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function NewsFeed({ ticker }) {
  const [items, setItems] = useState(null)

  useEffect(() => {
    if (!ticker) return
    setItems(null)
    supabase.from('clean_stock_news_data')
      .select('id,headline,source,author,url,created_at,summary')
      .eq('ticker', ticker).order('created_at', { ascending: false }).limit(10)
      .then(({ data }) => setItems(data ?? []))
  }, [ticker])

  return (
    <section className={`${CARD} flex min-h-0 flex-1 flex-col p-5`}>
      <h2 className="text-md font-semibold text-primary">Latest news</h2>
      <p className="mb-2 text-xs text-tertiary">From Alpaca news, newest first</p>

      {items === null ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map(i => <div key={i} className="h-12 animate-pulse rounded-md bg-secondary" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-tertiary">
          <Inbox01 className="mb-2 size-8 text-quaternary" aria-hidden="true" />
          <p className="text-sm">No news for {ticker} yet</p>
        </div>
      ) : (
        <ul className="-mx-2 flex min-h-0 flex-col divide-y divide-secondary xl:flex-1 xl:overflow-y-auto">
          {items.map(n => (
            <li key={n.id}>
              <a href={n.url} target="_blank" rel="noreferrer"
                className="group flex flex-col gap-1 rounded-md px-2 py-3 hover:bg-primary_hover">
                <span className="flex items-start gap-2 text-sm font-medium text-primary">
                  <span className="flex-1">{decode(n.headline)}</span>
                  <LinkExternal01 className="mt-0.5 size-4 shrink-0 text-fg-quaternary group-hover:text-fg-quaternary_hover" aria-hidden="true" />
                </span>
                {n.summary && <span className="line-clamp-2 text-xs text-tertiary">{decode(n.summary)}</span>}
                <span className="text-xs text-quaternary">
                  {[n.source, n.created_at && timeAgo(n.created_at)].filter(Boolean).join(' · ')}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
