'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Copy, Check, ExternalLink, Loader2, ClipboardList, Trash2 } from 'lucide-react'
import type { BriefingProject } from '@/lib/briefing-types'
import { formatDate } from '@/lib/briefing-utils'

// Trang khảo sát công khai (đã deploy lên Vercel) để khách điền từ điện thoại
const PUBLIC_BRIEF_BASE = 'https://ai-architect-assistant.vercel.app'

const STATUS_CONFIG = {
  pending:   { label: 'Chờ KH', className: 'bg-stone-800 text-stone-400' },
  active:    { label: 'Đang làm', className: 'bg-amber-900/40 text-amber-400' },
  completed: { label: 'Hoàn thành', className: 'bg-emerald-900/40 text-emerald-400' },
}

function ProjectCard({ project, onDelete }: { project: BriefingProject; onDelete: (id: string) => void }) {
  const [copied, setCopied] = useState(false)
  const status = STATUS_CONFIG[project.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending

  async function copyLink() {
    const url = `${PUBLIC_BRIEF_BASE}/brief/${project.client_token}`
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleDelete() {
    if (!window.confirm(`Xoá khảo sát "${project.project_name}"? Không thể hoàn tác.`)) return
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
            aria-label="Xoá khảo sát"
            className="rounded-lg p-1.5 text-stone-600 opacity-0 transition-all hover:bg-stone-800 hover:text-red-400 group-hover:opacity-100"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-4">
        {project.status === 'completed' ? (
          <Link href={`/studio/briefing/${project.id}`}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs bg-stone-200 hover:bg-white text-stone-900 py-2 rounded-xl font-medium transition-colors"
          >
            <ExternalLink size={13} />
            Xem brief
          </Link>
        ) : (
          <button onClick={copyLink}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs bg-stone-800 hover:bg-stone-700 text-stone-300 py-2 rounded-xl transition-colors"
          >
            {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            {copied ? 'Đã copy link!' : 'Copy link KH'}
          </button>
        )}
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
        <h2 className="font-semibold text-stone-100 mb-1">Dự án mới</h2>
        <p className="text-xs text-stone-500 mb-5">
          Sau khi tạo, bạn nhận một đường link khảo sát để gửi khách hàng — họ tự điền nhu cầu, mong muốn thiết kế &amp; xây dựng.
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
              Tạo & lấy link
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function BriefingDashboard() {
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
  }

  async function handleDelete(id: string) {
    setProjects((prev) => prev.filter((p) => p.id !== id))
    await fetch(`/api/briefing/brief/${id}`, { method: 'DELETE' })
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-display font-semibold text-stone-100">Khảo sát AI</h1>
          <p className="text-sm text-stone-500 mt-1">
            Tạo đường link khảo sát gửi khách hàng — khách tự điền nhu cầu, mong muốn khi thiết kế &amp; xây dựng; AI tự tổng hợp thành brief.
          </p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-stone-200 hover:bg-white text-stone-900 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          Dự án mới
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-stone-600" />
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-24 border border-dashed border-stone-800 rounded-2xl">
          <ClipboardList size={40} className="mx-auto text-stone-700 mb-3" />
          <p className="text-stone-500 text-sm mb-1">Chưa có dự án nào</p>
          <p className="text-stone-600 text-xs">Tạo dự án mới để lấy link khảo sát gửi cho khách hàng</p>
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
