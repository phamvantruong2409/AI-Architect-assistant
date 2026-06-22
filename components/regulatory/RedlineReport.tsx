import type { Violation, ViolationCategory } from '@/lib/regulatory-types'
import { CATEGORY_LABELS } from '@/lib/regulatory-utils'
import ViolationCard from './ViolationCard'

const CATEGORY_ORDER: ViolationCategory[] = ['khoang_lui', 'mat_do', 'far', 'chieu_cao', 'pccc', 'thong_gio', 'khac']

export default function RedlineReport({ violations }: { violations: Violation[] }) {
  if (violations.length === 0) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center">
        <p className="text-5xl mb-3">✅</p>
        <p className="font-semibold text-green-800 text-lg">Không có vi phạm</p>
        <p className="text-sm text-green-600 mt-1">Công trình dự kiến đạt tiêu chuẩn tất cả hạng mục kiểm tra.</p>
      </div>
    )
  }

  const grouped: Partial<Record<ViolationCategory, Violation[]>> = {}
  for (const v of violations) {
    if (!grouped[v.category]) grouped[v.category] = []
    grouped[v.category]!.push(v)
  }

  const errorCount = violations.filter(v => v.severity === 'error').length
  const warningCount = violations.filter(v => v.severity === 'warning').length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-stone-800">Kết quả kiểm tra — {violations.length} vấn đề</h2>
        <div className="flex gap-2">
          {errorCount > 0 && <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded-full font-medium">{errorCount} vi phạm</span>}
          {warningCount > 0 && <span className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded-full font-medium">{warningCount} cảnh báo</span>}
        </div>
      </div>
      {CATEGORY_ORDER.filter((cat) => grouped[cat]).map((cat) => (
        <div key={cat}>
          <h3 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-3 flex items-center gap-2">
            <span className="w-5 h-px bg-stone-300 inline-block" />
            {CATEGORY_LABELS[cat]}
            <span className="text-stone-400 font-normal normal-case tracking-normal">({grouped[cat]!.length})</span>
          </h3>
          <div className="space-y-3">
            {grouped[cat]!.map((violation, i) => <ViolationCard key={i} violation={violation} />)}
          </div>
        </div>
      ))}
    </div>
  )
}
