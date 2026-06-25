'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import ParamForm from '@/components/regulatory/ParamForm'
import FileDropzone from '@/components/regulatory/FileDropzone'
import type { CheckFormData } from '@/lib/regulatory-types'
import { useFakeProgress } from '@/hooks/useFakeProgress'

const DEFAULT_FORM: CheckFormData = {
  project_name: '', project_address: '',
  building_type: 'nha_o_rieng_le', zoning_type: 'dan_cu_hien_huu',
  land_area: 0, land_width: 0, land_depth: 0,
  floors: 1, total_height: 0, building_area: 0, total_floor_area: 0,
  setback_front: 0, setback_rear: 0, setback_left: 0, setback_right: 0,
  corridor_width: 0, window_ratio: 0, extra_notes: '',
  floorplan_image: null,
}

const SECTIONS: { key: 'project' | 'land' | 'building'; title: string }[] = [
  { key: 'project', title: 'Thông tin dự án' },
  { key: 'land', title: 'Kích thước lô đất' },
  { key: 'building', title: 'Thông số công trình' },
]

export default function NewRegulatoryCheckPage() {
  const router = useRouter()
  const [form, setForm] = useState<CheckFormData>(DEFAULT_FORM)
  const [section, setSection] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pct = useFakeProgress(submitting)

  function update<K extends keyof CheckFormData>(key: K, value: CheckFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit() {
    if (!form.project_name.trim()) { setError('Vui lòng nhập tên dự án'); return }
    setSubmitting(true)
    setError(null)

    try {
      let floorplanBase64: string | undefined
      if (form.floorplan_image) {
        const bytes = await form.floorplan_image.arrayBuffer()
        floorplanBase64 = Buffer.from(bytes).toString('base64')
      }

      const { floorplan_image: _, ...formData } = form
      const res = await fetch('/api/regulatory/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, floorplan_image_base64: floorplanBase64 }),
      })
      // Đọc text trước rồi parse — tránh "Unexpected end of JSON input" khi body rỗng
      // (vd route 500/timeout). Hiện thông báo lỗi đúng nghĩa cho người dùng.
      const raw = await res.text()
      const json = raw ? JSON.parse(raw) : null
      if (!res.ok || !json) {
        throw new Error(json?.error || `Máy chủ trả lỗi (${res.status}). Vui lòng thử lại.`)
      }
      router.push(`/studio/regulatory/report/${json.check_id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Phân tích thất bại')
      setSubmitting(false)
    }
  }

  const currentSection = SECTIONS[section]

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/studio/regulatory" className="p-2 text-stone-500 hover:text-stone-200 hover:bg-stone-800 rounded-lg transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="font-semibold text-stone-100">Kiểm tra pháp lý mới</h1>
          <p className="text-xs text-stone-500">Nhập thông số — AI đối chiếu quy chuẩn tự động</p>
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        {SECTIONS.map((s, i) => (
          <button key={s.key} onClick={() => setSection(i)}
            className={`text-xs px-3 py-1.5 rounded-full transition-colors ${i === section ? 'bg-stone-200 text-stone-900' : i < section ? 'bg-stone-700 text-stone-300' : 'bg-stone-800 text-stone-500'}`}
          >
            {i + 1}. {s.title}
          </button>
        ))}
      </div>

      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-6 mb-5">
        <h2 className="text-sm font-semibold text-stone-300 mb-5">{currentSection.title}</h2>
        <ParamForm form={form} update={update} section={currentSection.key} />
      </div>

      {section === 2 && (
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 mb-5">
          <h3 className="text-sm font-semibold text-stone-300 mb-1">Bản vẽ mặt bằng (tuỳ chọn)</h3>
          <p className="text-xs text-stone-600 mb-4">Upload ảnh để AI phân tích bổ sung</p>
          <FileDropzone value={form.floorplan_image ?? null} onChange={(f) => update('floorplan_image', f)} />
        </div>
      )}

      {error && (
        <div className="bg-red-950/50 border border-red-900 text-red-400 text-sm rounded-xl px-4 py-3 mb-4">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        {section > 0 && (
          <button onClick={() => setSection(section - 1)}
            className="px-5 py-3 text-sm text-stone-400 bg-stone-800 hover:bg-stone-700 rounded-xl transition-colors"
          >
            Quay lại
          </button>
        )}
        {section < SECTIONS.length - 1 ? (
          <button onClick={() => setSection(section + 1)}
            className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium bg-stone-200 hover:bg-white text-stone-900 rounded-xl transition-colors"
          >
            Tiếp theo <ChevronRight size={15} />
          </button>
        ) : (
          <button onClick={handleSubmit} disabled={submitting}
            className="flex-1 py-3 text-sm font-medium bg-stone-200 hover:bg-white disabled:opacity-50 text-stone-900 rounded-xl transition-colors"
          >
            {submitting ? `Đang phân tích... ${pct}%` : '⚡ Kiểm tra pháp lý'}
          </button>
        )}
      </div>
    </div>
  )
}
