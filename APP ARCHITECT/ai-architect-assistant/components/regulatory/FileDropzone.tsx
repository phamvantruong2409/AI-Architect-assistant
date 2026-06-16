'use client'

import { useRef, useState } from 'react'

interface Props {
  value: File | null
  onChange: (file: File | null) => void
}

export default function FileDropzone({ value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) onChange(file)
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
      className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer transition-colors ${dragging ? 'border-red-400 bg-red-50' : 'border-stone-200 hover:border-stone-300'}`}
    >
      {value ? (
        <div className="text-center">
          <p className="text-2xl mb-2">📄</p>
          <p className="text-sm font-medium text-stone-700">{value.name}</p>
          <p className="text-xs text-stone-400 mt-0.5">{(value.size / 1024).toFixed(0)} KB</p>
          <button type="button" onClick={(e) => { e.stopPropagation(); onChange(null) }} className="mt-2 text-xs text-red-500 hover:underline">Xóa file</button>
        </div>
      ) : (
        <>
          <span className="text-3xl">🖼️</span>
          <div className="text-center">
            <p className="text-sm text-stone-600">Kéo thả ảnh mặt bằng hoặc click để chọn</p>
            <p className="text-xs text-stone-400 mt-1">PNG, JPG, WEBP — tối đa 10MB</p>
          </div>
        </>
      )}
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => onChange(e.target.files?.[0] ?? null)} />
    </div>
  )
}
