'use client'

import { useState } from 'react'
import { Trash2, Loader2, CheckCircle, AlertCircle, Clock, Zap } from 'lucide-react'
import type { KnowledgeDocument } from '@/lib/knowledge-types'

interface Props {
  documents: KnowledgeDocument[]
  onDeleted: (id: string) => void
  onProcessed: (id: string) => void
}

const STATUS_CONFIG = {
  pending:    { icon: Clock,       color: 'text-stone-500',   label: 'Chưa xử lý' },
  processing: { icon: Loader2,     color: 'text-amber-400',   label: 'Đang xử lý...' },
  ready:      { icon: CheckCircle, color: 'text-emerald-400', label: 'Sẵn sàng' },
  error:      { icon: AlertCircle, color: 'text-red-400',     label: 'Lỗi' },
}

const CATEGORY_COLORS: Record<string, string> = {
  TCVN:    'bg-blue-900/40 text-blue-300',
  QCVN:    'bg-purple-900/40 text-purple-300',
  PCCC:    'bg-red-900/40 text-red-300',
  general: 'bg-stone-800 text-stone-400',
}

export default function DocumentList({ documents, onDeleted, onProcessed }: Props) {
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set())
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  async function handleProcess(doc: KnowledgeDocument) {
    setProcessingIds((s) => new Set(s).add(doc.id))
    setError(null)
    try {
      const res = await fetch(`/api/knowledge/process/${doc.id}`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      onProcessed(doc.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xử lý thất bại')
    } finally {
      setProcessingIds((s) => { const n = new Set(s); n.delete(doc.id); return n })
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Xóa tài liệu này?')) return
    setDeletingIds((s) => new Set(s).add(id))
    try {
      const res = await fetch(`/api/knowledge/documents/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Xóa thất bại')
      onDeleted(id)
    } catch {
      setError('Xóa thất bại')
    } finally {
      setDeletingIds((s) => { const n = new Set(s); n.delete(id); return n })
    }
  }

  if (documents.length === 0) {
    return <div className="text-center py-12 text-stone-600 text-sm">Chưa có tài liệu nào. Upload file để bắt đầu.</div>
  }

  return (
    <div className="space-y-2">
      {error && <div className="text-xs text-red-400 px-1">{error}</div>}
      {documents.map((doc) => {
        const statusCfg = STATUS_CONFIG[doc.status]
        const StatusIcon = statusCfg.icon
        const isProcessing = processingIds.has(doc.id)
        const isDeleting = deletingIds.has(doc.id)

        return (
          <div key={doc.id} className="flex items-center gap-3 bg-stone-900 border border-stone-800 rounded-lg px-4 py-3">
            <StatusIcon size={16} className={`shrink-0 ${statusCfg.color} ${doc.status === 'processing' || isProcessing ? 'animate-spin' : ''}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-stone-200 truncate">{doc.name}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-xs px-1.5 py-0.5 rounded ${CATEGORY_COLORS[doc.category] ?? CATEGORY_COLORS.general}`}>{doc.category}</span>
                {doc.status === 'ready' && <span className="text-xs text-stone-600">{doc.chunk_count} đoạn</span>}
                {doc.error_message && <span className="text-xs text-red-500 truncate">{doc.error_message}</span>}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {(doc.status === 'pending' || doc.status === 'error') && (
                <button onClick={() => handleProcess(doc)} disabled={isProcessing} title="Lập chỉ mục" className="p-1.5 text-stone-400 hover:text-amber-400 disabled:opacity-40 transition-colors">
                  {isProcessing ? <Loader2 size={15} className="animate-spin" /> : <Zap size={15} />}
                </button>
              )}
              <button onClick={() => handleDelete(doc.id)} disabled={isDeleting} title="Xóa" className="p-1.5 text-stone-600 hover:text-red-400 disabled:opacity-40 transition-colors">
                {isDeleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
