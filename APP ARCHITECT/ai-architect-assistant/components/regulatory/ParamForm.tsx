'use client'

import type { CheckFormData, BuildingType, ZoningType } from '@/lib/regulatory-types'
import { BUILDING_TYPE_LABELS, ZONING_TYPE_LABELS } from '@/lib/regulatory-regulations'

interface Props {
  form: CheckFormData
  update: <K extends keyof CheckFormData>(key: K, value: CheckFormData[K]) => void
  section: 'project' | 'land' | 'building'
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-sm font-medium text-stone-600 block mb-1">
        {label}
        {hint && <span className="text-stone-400 font-normal ml-1">({hint})</span>}
      </label>
      {children}
    </div>
  )
}

const inputClass = 'w-full border border-stone-200 rounded-xl px-4 py-2.5 text-stone-800 focus:outline-none focus:ring-2 focus:ring-red-400 text-sm bg-white'
const selectClass = 'w-full border border-stone-200 rounded-xl px-4 py-2.5 text-stone-800 focus:outline-none focus:ring-2 focus:ring-red-400 text-sm bg-white'

function NumInput({ value, onChange, placeholder, min = 0, step = 0.1 }: { value: number; onChange: (v: number) => void; placeholder?: string; min?: number; step?: number }) {
  return (
    <input type="number" min={min} step={step} value={value === 0 ? '' : value}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      placeholder={placeholder} className={inputClass} />
  )
}

export default function ParamForm({ form, update, section }: Props) {
  if (section === 'project') {
    return (
      <div className="space-y-4">
        <Field label="Tên dự án *">
          <input type="text" value={form.project_name} onChange={(e) => update('project_name', e.target.value)} placeholder="Biệt thự 3 tầng Q.2 – Ông Minh" className={inputClass} />
        </Field>
        <Field label="Địa chỉ *">
          <input type="text" value={form.project_address} onChange={(e) => update('project_address', e.target.value)} placeholder="123 Nguyễn Văn A, P. Thảo Điền, TP.HCM" className={inputClass} />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Loại công trình *">
            <select value={form.building_type} onChange={(e) => update('building_type', e.target.value as BuildingType)} className={selectClass}>
              {(Object.keys(BUILDING_TYPE_LABELS) as BuildingType[]).map((k) => (
                <option key={k} value={k}>{BUILDING_TYPE_LABELS[k]}</option>
              ))}
            </select>
          </Field>
          <Field label="Loại quy hoạch *">
            <select value={form.zoning_type} onChange={(e) => update('zoning_type', e.target.value as ZoningType)} className={selectClass}>
              {(Object.keys(ZONING_TYPE_LABELS) as ZoningType[]).map((k) => (
                <option key={k} value={k}>{ZONING_TYPE_LABELS[k]}</option>
              ))}
            </select>
          </Field>
        </div>
      </div>
    )
  }

  if (section === 'land') {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Diện tích lô đất *" hint="m²"><NumInput value={form.land_area} onChange={(v) => update('land_area', v)} placeholder="120" step={1} /></Field>
          <Field label="Chiều rộng mặt tiền *" hint="m"><NumInput value={form.land_width} onChange={(v) => update('land_width', v)} placeholder="6" /></Field>
          <Field label="Chiều sâu lô đất *" hint="m"><NumInput value={form.land_depth} onChange={(v) => update('land_depth', v)} placeholder="20" /></Field>
        </div>
        {form.land_area > 0 && (
          <div className="bg-stone-50 rounded-xl p-3 text-sm text-stone-500">
            💡 Tỷ lệ mặt tiền/chiều sâu: <span className="font-semibold text-stone-700">{form.land_depth > 0 ? (form.land_width / form.land_depth).toFixed(2) : '—'}</span>
          </div>
        )}
      </div>
    )
  }

  if (section === 'building') {
    const density = form.land_area > 0 ? Math.round((form.building_area / form.land_area) * 100) : 0
    const far = form.land_area > 0 ? (form.total_floor_area / form.land_area).toFixed(2) : '0'

    return (
      <div className="space-y-5">
        <div>
          <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-3">Khối lượng</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Field label="Số tầng *"><NumInput value={form.floors} onChange={(v) => update('floors', Math.round(v))} placeholder="3" step={1} min={1} /></Field>
            <Field label="Chiều cao *" hint="m"><NumInput value={form.total_height} onChange={(v) => update('total_height', v)} placeholder="12" /></Field>
            <Field label="DT xây dựng *" hint="m²"><NumInput value={form.building_area} onChange={(v) => update('building_area', v)} placeholder="80" step={1} /></Field>
            <Field label="Tổng DT sàn *" hint="m²"><NumInput value={form.total_floor_area} onChange={(v) => update('total_floor_area', v)} placeholder="240" step={1} /></Field>
          </div>
        </div>
        {form.building_area > 0 && form.land_area > 0 && (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-stone-50 rounded-xl p-3 text-center">
              <p className={`text-2xl font-bold ${density > 80 ? 'text-red-600' : 'text-stone-800'}`}>{density}%</p>
              <p className="text-xs text-stone-500">Mật độ xây dựng</p>
            </div>
            <div className="bg-stone-50 rounded-xl p-3 text-center">
              <p className={`text-2xl font-bold ${parseFloat(far) > 5 ? 'text-red-600' : 'text-stone-800'}`}>{far}</p>
              <p className="text-xs text-stone-500">Hệ số FAR</p>
            </div>
          </div>
        )}
        <div>
          <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-3">Khoảng lùi</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {(['setback_front', 'setback_rear', 'setback_left', 'setback_right'] as const).map((key, i) => (
              <Field key={key} label={['Mặt tiền', 'Phía sau', 'Hông trái', 'Hông phải'][i]} hint="m">
                <NumInput value={form[key] as number} onChange={(v) => update(key, v)} placeholder="0" />
              </Field>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-3">PCCC & Thông gió</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Chiều rộng hành lang" hint="m"><NumInput value={form.corridor_width} onChange={(v) => update('corridor_width', v)} placeholder="1.2" /></Field>
            <Field label="Tỷ lệ cửa sổ / diện tích sàn" hint="%"><NumInput value={form.window_ratio} onChange={(v) => update('window_ratio', v)} placeholder="15" step={1} /></Field>
          </div>
        </div>
      </div>
    )
  }

  return null
}
