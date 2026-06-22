import type { Violation } from '@/lib/regulatory-types'
import { SEVERITY_CONFIG, CATEGORY_LABELS } from '@/lib/regulatory-utils'

interface Props { violation: Violation }

export default function ViolationCard({ violation }: Props) {
  const cfg = SEVERITY_CONFIG[violation.severity]

  return (
    <div className={`border rounded-2xl p-5 space-y-3 ${cfg.bg} ${cfg.border}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
          <div>
            <h4 className={`font-semibold ${cfg.text}`}>{violation.title}</h4>
            <p className="text-xs text-stone-500 mt-0.5">{CATEGORY_LABELS[violation.category]}</p>
          </div>
        </div>
        <span className={`text-xs px-2.5 py-1 rounded-full font-semibold shrink-0 ${cfg.bg} ${cfg.text} border ${cfg.border}`}>{cfg.label}</span>
      </div>
      <p className="text-sm text-stone-700 leading-relaxed">{violation.description}</p>
      {(violation.current_value || violation.required_value) && (
        <div className="flex gap-3 flex-wrap">
          {violation.current_value && (
            <div className="bg-white/70 border border-stone-200 rounded-xl px-3 py-2">
              <p className="text-xs text-stone-400 mb-0.5">Hiện tại</p>
              <p className="text-sm font-semibold text-stone-800">{violation.current_value}</p>
            </div>
          )}
          {violation.required_value && (
            <div className="bg-white/70 border border-stone-200 rounded-xl px-3 py-2">
              <p className="text-xs text-stone-400 mb-0.5">Yêu cầu</p>
              <p className="text-sm font-semibold text-stone-800">{violation.required_value}</p>
            </div>
          )}
        </div>
      )}
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono bg-white/80 border border-stone-200 text-stone-600 px-2 py-0.5 rounded">
          📋 {violation.standard_ref}
        </span>
      </div>
      <div className="bg-white/60 rounded-xl p-3">
        <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1">Khuyến nghị</p>
        <p className="text-sm text-stone-700">{violation.recommendation}</p>
      </div>
    </div>
  )
}
