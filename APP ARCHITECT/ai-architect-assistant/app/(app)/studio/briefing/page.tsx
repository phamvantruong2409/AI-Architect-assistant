'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, ArrowRight, Loader2, ClipboardList, Trash2 } from 'lucide-react'
import type { BriefingProject } from '@/lib/briefing-types'
import { formatDate } from '@/lib/briefing-utils'

const STATUS_CONFIG = {
  pending:   { label: 'Chờ làm', className: 'bg-stone-800 text-stone-400' },
  active:    { label: 'Đang làm', className: 'bg-amber-900/40 text-amber-400' },
  completed: { label: 'Đã có nhiệm vụ', className: 'bg-emerald-900/40 text-emerald-400' },
}

function ProjectCard({ project, onDelete }: { project: BriefingProject; onDelete: (id: string) => void }) {
  const status = STATUS_CONFIG[project.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending

  function handleDelete() {
    if (!window.confirm(`Xoá nhiệm vụ "${project.project_name}"? Không thể hoàn tác.`)) return
    onDelete(project.id)
  }

  return (
    <div className="group bg-stone-900 border border-stone-800 rounded-2xl p-5 hover:border-stone-700 transition-colors">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-stone-100 truncate">{project.project_name}</h3>
          <p className="text-xs text-stone-500 mt-0.5">{project.client_name} · {formatDate(project.created_at)}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`text-xs px-2 py-1 rounded-full ${status.className}`}>{status.label}</span>
          <button
            onClick={handleDelete}
            aria-label="Xoá nhiệm vụ"
            className="rounded-lg p-1.5 text-stone-600 opacity-0 transition-all hover:bg-stone-800 hover:text-red-400 group-hover:opacity-100"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-4">
        <Link href={`/studio/briefing/${project.id}`}
          className="flex-1 flex items-center justify-center gap-1.5 text-xs bg-stone-800 hover:bg-stone-700 text-stone-300 py-2 rounded-xl transition-colors"
        >
          <ArrowRight size={13} />
          Mở nhiệm vụ
        </Link>
      </div>
    </div>
  )
}

function CreateProjectModal({ onCreated, onClose }: { onCreated: (p: BriefingProject) => void; onClose: () => void }) {
  const [name, setName] = useState('')
  const [clientName, setClientName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !clientName.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/briefing/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_name: name.trim(), client_name: clientName.trim() }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      onCreated(json.project)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tạo thất bại')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-stone-950 border border-stone-800 rounded-2xl p-6">
        <h2 className="font-semibold text-stone-100 mb-1">Nhiệm vụ mới</h2>
        <p className="text-xs text-stone-500 mb-5">
          Tạo nhiệm vụ thiết kế cho một dự án. Sau khi tạo, bạn tự điền thông tin chi tiết &amp; để AI đề xuất nhiệm vụ thiết kế.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-stone-500 mb-1 block">Tên dự án</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Villa Đà Lạt..."
              className="w-full bg-stone-900 border border-stone-700 text-stone-200 placeholder-stone-600 text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-stone-500"
            />
          </div>
          <div>
            <label className="text-xs text-stone-500 mb-1 block">Tên khách hàng</label>
            <input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Nguyễn Văn A..."
              className="w-full bg-stone-900 border border-stone-700 text-stone-200 placeholder-stone-600 text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-stone-500"
            />
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-3 text-sm text-stone-400 bg-stone-800 hover:bg-stone-700 rounded-xl transition-colors">Hủy</button>
            <button type="submit" disabled={loading || !name.trim() || !clientName.trim()}
              className="flex-1 py-3 text-sm font-medium text-stone-900 bg-stone-200 hover:bg-white disabled:opacity-40 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              Tạo nhiệm vụ
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function BriefingDashboard() {
  const router = useRouter()
  const [projects, setProjects] = useState<BriefingProject[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  const loadProjects = useCallback(() => {
    return fetch('/api/briefing/projects')
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setProjects(d) })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  function handleCreated(project: BriefingProject) {
    setProjects((prev) => [project, ...prev])
    setShowModal(false)
    router.push(`/studio/briefing/${project.id}`)
  }

  async function handleDelete(id: string) {
    setProjects((prev) => prev.filter((p) => p.id !== id))
    await fetch(`/api/briefing/brief/${id}`, { method: 'DELETE' })
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-display font-semibold text-stone-100">Nhiệm vụ thiết kế</h1>
          <p className="text-sm text-stone-500 mt-1">
            Tự điền thông tin chi tiết của dự án — AI đề xuất bản nhiệm vụ thiết kế để bạn bắt tay vào concept.
          </p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-stone-200 hover:bg-white text-stone-900 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          Nhiệm vụ mới
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-stone-600" />
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-24 border border-dashed border-stone-800 rounded-2xl">
          <ClipboardList size={40} className="mx-auto text-stone-700 mb-3" />
          <p className="text-stone-500 text-sm mb-1">Chưa có nhiệm vụ nào</p>
          <p className="text-stone-600 text-xs">Tạo nhiệm vụ mới để điền thông tin &amp; để AI đề xuất nhiệm vụ thiết kế</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => <ProjectCard key={p.id} project={p} onDelete={handleDelete} />)}
        </div>
      )}

      {showModal && <CreateProjectModal onCreated={handleCreated} onClose={() => setShowModal(false)} />}
    </div>
  )
}
