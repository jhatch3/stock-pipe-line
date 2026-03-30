import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'

export default function AgentPanel({ ticker }) {
  const [analysis, setAnalysis] = useState(null)   // latest row from stock_ai_analysis

  // Load stored analysis from Supabase on mount / ticker change
  useEffect(() => {
    if (!ticker) return
    setAnalysis(null)
    supabase
      .from('stock_ai_analysis')
      .select('ticker,summary,sources,as_of_utc')
      .eq('ticker', ticker)
      .order('as_of_utc', { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => setAnalysis(data ?? null))
  }, [ticker])

  const fmtTime = ts =>
    ts
      ? new Date(ts).toLocaleString('en-US', {
          month: 'short', day: 'numeric', year: 'numeric',
          hour: 'numeric', minute: '2-digit',
        })
      : null

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-l-4 border-blue-500 bg-blue-50">
        <div className="flex items-center gap-2">
          <span className="text-lg">🤖</span>
          <h3 className="font-semibold text-gray-900 text-sm">AI Analysis</h3>
          <span className="text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full font-medium">GPT-4o mini</span>
        </div>
        {analysis?.as_of_utc && (
          <span className="text-xs text-gray-400">{fmtTime(analysis.as_of_utc)}</span>
        )}
      </div>

      <div className="p-5">
        {analysis?.summary ? (
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{analysis.summary}</p>
        ) : (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <p className="text-sm text-gray-400">No analysis available for <strong>{ticker}</strong> yet.</p>
          </div>
        )}
      </div>
    </div>
  )
}
