import { SECTION_COLORS, formatValue } from '../lib/constants.js'

export default function FeatureSection({ section, data, ranks }) {
  const colors = SECTION_COLORS[section.color] ?? SECTION_COLORS['blue']

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className={`flex items-center justify-between px-5 py-4 border-l-4 ${colors.borderColor} ${colors.headerBg}`}>
        <div className="flex items-center gap-2">
          <span className="text-lg">{section.icon}</span>
          <h3 className="font-semibold text-gray-900 text-sm">{section.title}</h3>
        </div>
        {section.description && (
          <span className="text-xs text-gray-400 hidden sm:block">{section.description}</span>
        )}
      </div>

      {/* Metrics grid */}
      <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {section.fields.map((field) => {
          const raw       = data ? data[field.key] : undefined
          const formatted = formatValue(raw, field.format, field.decimals)
          const isMissing = formatted === '—'
          const rank      = ranks?.[field.key]

          return (
            <div
              key={field.key}
              className="bg-gray-50 rounded-xl p-3 hover:bg-gray-100 transition-colors"
            >
              <p className="text-[11px] text-gray-500 leading-tight mb-1">{field.label}</p>
              <p className={`text-sm font-semibold tabular-nums ${isMissing ? 'text-gray-300' : colors.accentText}`}>
                {formatted}
              </p>
              {rank && (
                <p className="text-[10px] text-gray-400 mt-0.5 tabular-nums">
                  #{rank.rank}<span className="text-gray-300">/{rank.total}</span>
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
