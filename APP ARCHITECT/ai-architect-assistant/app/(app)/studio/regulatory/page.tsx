'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Loader2, ShieldCheck, ExternalLink } from 'lucide-react'
import type { RegCheck } from '@/lib/regulatory-types'
import { STATUS_CONFIG, formatDate } from '@/lib/regulatory-utils'
import { BUILDING_TYPE_LABELS } from '@/lib/regulatory-regulations'

function CheckCard({ check }: { check: RegCheck }) {
  const statusCfg = STATUS_CONFIG[check.status]

  return (
    <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 hover:border-stone-700 transition-colors">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-stone-100 truncate">{check.project_name}</h3>
          <p className="text-xs text-stone-500 mt-0.5">
            {BUILDING_TYPE_LABELS[check.building_type as keyof typeof BUILDING_TYPE_LABELS] ?? check.building_type} · {formatDate(check.created_at)}
          </p>
        </div>
        <span className={`text-xs px-2 py-1 rounded-full shrink-0 ${statusCfg.color}`}>{statusCfg.label}</span>
      </div>

      {check.status === 'completed' && (
        <Link href={`/studio/regulatory/report/${check.id}`}
          className="mt-3 flex items-center justify-center gap-1.5 text-xs bg-stone-200 hover:bg-white text-stone-900 py-2 rounded-xl font-medium transition-colors"
        >
          <ExternalLink size={13} />
          Xem báo cáo
        </Link>
      )}

      {check.status === 'analyzing' && (
        <div className="flex items-center gap-2 text-xs text-amber-400 mt-3">
          <Loader2 size={12} className="animate-spin" />
          Đang phân tích...
        </div>
      )}
    </div>
  )
}

export default function RegulatoryDashboard() {
  const [checks, setChecks] = useState<RegCheck[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/regulatory/checks')
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setChecks(d) })
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-display font-semibold text-stone-100">Kiểm tra Pháp lý</h1>
          <p className="text-sm text-stone-500 mt-1">Kiểm tra công trình với QCXDVN 01:2021, QCVN 06:2022, TCVN 4474</p>
        </div>
        <Link href="/studio/regulatory/new"
          className="flex items-center gap-2 bg-stone-200 hover:bg-white text-stone-900 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          Kiểm tra mới
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-stone-600" />
        </div>
      ) : checks.length === 0 ? (
        <div className="text-center py-24 border border-dashed border-stone-800 rounded-2xl">
          <ShieldCheck size={40} className="mx-auto text-stone-700 mb-3" />
          <p className="text-stone-500 text-sm mb-1">Chưa có kiểm tra nào</p>
          <p className="text-stone-600 text-xs">Nhập thông số công trình để AI kiểm tra pháp lý tự động</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {checks.map((c) => <CheckCard key={c.id} check={c} />)}
        </div>
      )}
    </div>
  )
}
