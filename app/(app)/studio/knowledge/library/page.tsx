'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import FileUploader from '@/components/knowledge/FileUploader'
import DocumentList from '@/components/knowledge/DocumentList'
import type { KnowledgeDocument } from '@/lib/knowledge-types'

export default function KnowledgeLibraryPage() {
  const [docs, setDocs] = useState<KnowledgeDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/knowledge/documents')
      .then((r) => r.json())
      .then((d) => { if (d.documents) setDocs(d.documents) })
      .finally(() => setLoading(false))
  }, [])

  function handleUploaded(docId: string) {
    fetch('/api/knowledge/documents')
      .then((r) => r.json())
      .then((d) => { if (d.documents) setDocs(d.documents) })
  }

  function handleProcessed(id: string) {
    setDocs((prev) => prev.map((d) => d.id === id ? { ...d, status: 'ready' } : d))
  }

  function handleDeleted(id: string) {
    setDocs((prev) => prev.filter((d) => d.id !== id))
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/studio/knowledge" className="p-2 text-stone-500 hover:text-stone-200 hover:bg-stone-800 rounded-lg transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="font-semibold text-stone-100">Thư viện tài liệu</h1>
          <p className="text-xs text-stone-500">Upload và lập chỉ mục tài liệu kỹ thuật</p>
        </div>
      </div>

      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-stone-300 mb-4">Upload tài liệu mới</h2>
        <FileUploader onUploaded={handleUploaded} onError={(msg) => setError(msg)} />
        {error && <p className="text-xs text-red-400 mt-3">{error}</p>}
      </div>

      <div>
        <h2 className="text-sm font-semibold text-stone-400 mb-3">
          Tài liệu ({docs.length})
        </h2>
        {loading ? (
          <div className="text-center py-8 text-stone-600 text-sm">Đang tải...</div>
        ) : (
          <DocumentList documents={docs} onDeleted={handleDeleted} onProcessed={handleProcessed} />
        )}
      </div>
    </div>
  )
}
