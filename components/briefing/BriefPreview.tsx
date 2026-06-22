'use client'

import { motion } from 'framer-motion'
import type { DesignBrief, BriefingProject } from '@/lib/briefing-types'
import { BUDGET_LABELS, CONSTRAINT_TYPE_LABELS, CONSTRAINT_TYPE_COLORS, formatDate } from '@/lib/briefing-utils'

interface BriefPreviewProps {
  brief: DesignBrief
  project: BriefingProject
  budgetRange?: string
}

export default function BriefPreview({ brief, project, budgetRange }: BriefPreviewProps) {
  return (
    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl mx-auto space-y-6">
      <div className="bg-stone-900 text-white rounded-2xl p-6">
        <p className="text-stone-400 text-sm mb-1">DESIGN BRIEF</p>
        <h1 className="text-2xl font-bold mb-0.5">{project.project_name}</h1>
        <p className="text-stone-300 text-sm">Khách hàng: {project.client_name} · {formatDate(brief.generated_at)}</p>
        <div className="mt-4 flex items-center gap-3">
          <span className="px-3 py-1 bg-amber-500 text-white text-sm font-semibold rounded-full">{brief.dominant_style}</span>
          {budgetRange && (
            <span className="px-3 py-1 bg-stone-700 text-stone-200 text-sm rounded-full">{BUDGET_LABELS[budgetRange] || budgetRange}</span>
          )}
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
        <h2 className="font-semibold text-amber-800 mb-2 flex items-center gap-2"><span>🤖</span> Nhận định của AI</h2>
        <p className="text-stone-700 leading-relaxed">{brief.ai_summary}</p>
      </div>

      <div className="bg-white border border-stone-200 rounded-2xl p-5">
        <h2 className="font-semibold text-stone-800 mb-4 flex items-center gap-2"><span>🎨</span> Phân tích phong cách</h2>
        <div className="space-y-3">
          {Object.entries(brief.style_breakdown).sort(([, a], [, b]) => b - a).map(([style, pct]) => (
            <div key={style}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-stone-700 font-medium">{style}</span>
                <span className="text-stone-500">{pct}%</span>
              </div>
              <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, delay: 0.2 }} className="h-full bg-amber-500 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border border-stone-200 rounded-2xl p-5">
        <h2 className="font-semibold text-stone-800 mb-4 flex items-center gap-2"><span>🎭</span> Bảng màu gợi ý</h2>
        <div className="flex gap-3 flex-wrap">
          {brief.color_palette.map((color, i) => (
            <div key={i} className="flex flex-col items-center gap-1.5">
              <div className="w-14 h-14 rounded-xl shadow-sm border border-stone-100" style={{ backgroundColor: color }} />
              <span className="text-xs text-stone-500 font-mono">{color}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border border-stone-200 rounded-2xl p-5">
        <h2 className="font-semibold text-stone-800 mb-3 flex items-center gap-2"><span>🪵</span> Vật liệu ưu tiên</h2>
        <div className="flex flex-wrap gap-2">
          {brief.material_preferences.map((mat, i) => (
            <span key={i} className="px-3 py-1.5 bg-stone-100 text-stone-700 rounded-full text-sm font-medium">{mat}</span>
          ))}
        </div>
      </div>

      <div className="bg-white border border-stone-200 rounded-2xl p-5">
        <h2 className="font-semibold text-stone-800 mb-2 flex items-center gap-2"><span>💡</span> Ánh sáng</h2>
        <p className="text-stone-700">{brief.lighting_preference}</p>
      </div>

      {brief.design_constraints.length > 0 && (
        <div className="bg-white border border-stone-200 rounded-2xl p-5">
          <h2 className="font-semibold text-stone-800 mb-4 flex items-center gap-2"><span>⚠️</span> Ràng buộc thiết kế (bóc tách tự động)</h2>
          <div className="space-y-3">
            {brief.design_constraints.map((c, i) => (
              <div key={i} className="flex gap-3 p-3 bg-stone-50 rounded-xl">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap h-fit ${CONSTRAINT_TYPE_COLORS[c.type] || 'bg-stone-200 text-stone-700'}`}>
                  {CONSTRAINT_TYPE_LABELS[c.type] || c.type}
                </span>
                <div>
                  <p className="text-stone-800 text-sm font-medium">{c.note}</p>
                  <p className="text-stone-500 text-xs mt-0.5">Lý do: {c.triggered_by}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {brief.space_requirements.length > 0 && (
        <div className="bg-white border border-stone-200 rounded-2xl p-5">
          <h2 className="font-semibold text-stone-800 mb-4 flex items-center gap-2"><span>🏠</span> Yêu cầu không gian</h2>
          <div className="space-y-2">
            {brief.space_requirements.map((s, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap font-medium mt-0.5 ${s.priority === 'must_have' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                  {s.priority === 'must_have' ? 'Bắt buộc' : 'Nên có'}
                </span>
                <div>
                  <span className="font-medium text-stone-700 text-sm">{s.room}: </span>
                  <span className="text-stone-600 text-sm">{s.note}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="text-center text-xs text-stone-400 pb-4">
        Được tạo bởi AI Briefing System · Model: {brief.gemini_model}
      </div>
    </motion.div>
  )
}
