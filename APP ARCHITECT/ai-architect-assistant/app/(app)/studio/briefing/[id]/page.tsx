'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2 } from 'lucide-react'
import BriefPreview from '@/components/briefing/BriefPreview'
import type { DesignBrief, BriefingProject } from '@/lib/briefing-types'

export default function BriefingDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [brief, setBrief] = useState<DesignBrief | null>(null)
  const [project, setProject] = useState<BriefingProject | null>(null)
  const [budgetRange, setBudgetRange] = useState<string | undefined>()
  const [ktsNotes, setKtsNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/briefing/brief/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error)
        setBrief(d.brief)
        setProject(d.project)
        setBudgetRange(d.budget_range)
        setKtsNotes(d.brief?.kts_notes ?? '')
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [id])

  async function handleSaveNotes() {
    setSaving(true)
    try {
      await fetch(`/api/briefing/brief/${id}`, {
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

  if (error || !brief) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-3">
      <p className="text-stone-400">{error ?? 'Không tìm thấy brief'}</p>
      <Link href="/studio/briefing" className="text-sm text-stone-500 hover:text-stone-300 underline">Quay lại</Link>
    </div>
  )

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/studio/briefing" className="p-2 text-stone-500 hover:text-stone-200 hover:bg-stone-800 rounded-lg transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="font-semibold text-stone-100">{project?.project_name}</h1>
          <p className="text-xs text-stone-500">{project?.client_name}</p>
        </div>
      </div>

      <BriefPreview brief={brief} project={project!} budgetRange={budgetRange} />

      <div className="mt-8 bg-stone-900 border border-stone-800 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-stone-300 mb-3">Ghi chú KTS</h3>
        <textarea value={ktsNotes} onChange={(e) => setKtsNotes(e.target.value)} rows={4}
          placeholder="Nhận xét của kiến trúc sư về brief này..."
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
