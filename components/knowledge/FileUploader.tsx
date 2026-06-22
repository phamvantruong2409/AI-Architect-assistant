'use client'

import { useRef, useState } from 'react'
import { Upload, Loader2 } from 'lucide-react'
import type { DocumentCategory } from '@/lib/knowledge-types'

const CATEGORIES: { value: DocumentCategory; label: string }[] = [
  { value: 'TCVN', label: 'TCVN — Tiêu chuẩn Việt Nam' },
  { value: 'QCVN', label: 'QCVN — Quy chuẩn Việt Nam' },
  { value: 'PCCC', label: 'PCCC — Phòng cháy chữa cháy' },
  { value: 'general', label: 'General — Tài liệu khác' },
]

interface Props {
  onUploaded: (docId: string) => void
  onError?: (msg: string) => void
}

export default function FileUploader({ onUploaded, onError }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [category, setCategory] = useState<DocumentCategory>('general')

  async function handleFile(file: File) {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('category', category)
      const res = await fetch('/api/knowledge/documents', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      onUploaded(json.document.id)
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Upload thất bại')
    } finally {
      setUploading(false)
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  return (
    <div className="space-y-3">
      <select value={category} onChange={(e) => setCategory(e.target.value as DocumentCategory)}
        className="w-full bg-stone-800 border border-stone-700 text-stone-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-stone-500"
      >
        {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
      </select>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !uploading && inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer transition-colors ${dragging ? 'border-stone-400 bg-stone-800' : 'border-stone-700 hover:border-stone-500'}`}
      >
        {uploading ? <Loader2 size={24} className="text-stone-400 animate-spin" /> : <Upload size={24} className="text-stone-500" />}
        <div className="text-center">
          <p className="text-sm text-stone-300">{uploading ? 'Đang upload...' : 'Kéo thả file hoặc click để chọn'}</p>
          <p className="text-xs text-stone-600 mt-1">PDF, DOCX, TXT — tối đa 20MB</p>
        </div>
      </div>
      <input ref={inputRef} type="file" accept=".pdf,.docx,.txt,.md" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
    </div>
  )
}
