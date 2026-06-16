'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2 } from 'lucide-react'
import RedlineReport from '@/components/regulatory/RedlineReport'
import type { RegCheck, RegReport } from '@/lib/regulatory-types'
import { scoreColor, scoreBg, formatDate } from '@/lib/regulatory-utils'
import { BUILDING_TYPE_LABELS } from '@/lib/regulatory-regulations'

export default function RegulatoryReportPage() {
  const { id } = useParams<{ id: string }>()
  const [check, setCheck] = useState<RegCheck | null>(null)
  const [report, setReport] = useState<RegReport | null>(null)
  const [ktsNotes, setKtsNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/regulatory/reports/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error)
        setCheck(d.check)
        setReport(d.report)
        setKtsNotes(d.report?.kts_notes ?? '')
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [id])

  async function handleSaveNotes() {
    setSaving(true)
    try {
      await fetch(`/api/regulatory/reports/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kts_notes: ktsNotes }),
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 size={28} className="animate-spin text-stone-600" />
    </div>
  )

  if (error || !check || !report) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-3">
      <p className="text-stone-400">{error ?? 'Không tìm thấy báo cáo'}</p>
      <Link href="/studio/regulatory" className="text-sm text-stone-500 hover:text-stone-300 underline">Quay lại</Link>
    </div>
  )

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/studio/regulatory" className="p-2 text-stone-500 hover:text-stone-200 hover:bg-stone-800 rounded-lg transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="font-semibold text-stone-100">{check.project_name}</h1>
          <p className="text-xs text-stone-500">
            {BUILDING_TYPE_LABELS[check.building_type as keyof typeof BUILDING_TYPE_LABELS] ?? check.building_type} · {formatDate(check.created_at)}
          </p>
        </div>
      </div>

      {report.overall_score !== undefined && (
        <div className={`rounded-2xl p-6 mb-6 border ${scoreBg(report.overall_score)} border-stone-800`}>
          <div className="flex items-end gap-3">
            <span className={`text-5xl font-bold ${scoreColor(report.overall_score)}`}>{report.overall_score}</span>
            <span className="text-stone-500 mb-1">/100 — Điểm tuân thủ</span>
          </div>
          {report.compliance_summary && <p className="text-sm text-stone-400 mt-3 leading-relaxed">{report.compliance_summary}</p>}
        </div>
      )}

      <RedlineReport violations={report.violations} />

      {report.passed_checks && report.passed_checks.length > 0 && (
        <div className="mt-6 bg-emerald-950/30 border border-emerald-900/50 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-emerald-400 mb-3">✅ Đạt tiêu chuẩn ({report.passed_checks.length})</h3>
          <ul className="space-y-1">
            {report.passed_checks.map((item, i) => (
              <li key={i} className="text-sm text-emerald-300/70 flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-8 bg-stone-900 border border-stone-800 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-stone-300 mb-3">Ghi chú KTS</h3>
        <textarea value={ktsNotes} onChange={(e) => setKtsNotes(e.target.value)} rows={4}
          placeholder="Nhận xét của kiến trúc sư về báo cáo này..."
          className="w-full bg-stone-800 border border-stone-700 text-stone-200 placeholder-stone-600 text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-stone-500 resize-none"
        />
        <button onClick={handleSaveNotes} disabled={saving}
          className="mt-3 flex items-center gap-2 text-sm font-medium text-stone-900 bg-stone-200 hover:bg-white disabled:opacity-50 px-4 py-2 rounded-xl transition-colors"
        >
          {saving && <Loader2 size={13} className="animate-spin" />}
          Lưu ghi chú
        </button>
      </div>
    </div>
  )
}
