'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Calculator } from 'lucide-react'
import type { BuildingType } from '@/lib/regulatory-types'
import { BUILDING_TYPE_LABELS } from '@/lib/regulatory-regulations'
import { computeCapacity } from '@/lib/regulatory-capacity'

const BUILDING_TYPES = Object.keys(BUILDING_TYPE_LABELS) as BuildingType[]

const inputClass =
  'w-full rounded-xl border border-stone-700 bg-stone-800 px-3 py-2.5 text-sm text-stone-100 placeholder-stone-500 focus:border-stone-500 focus:outline-none'
const labelClass = 'mb-1.5 block text-xs font-medium text-stone-400'

function fmt(n: number): string {
  return n.toLocaleString('vi-VN')
}

export default function CapacityCalculatorPage() {
  const [landArea, setLandArea] = useState('')
  const [buildingType, setBuildingType] = useState<BuildingType>('nha_o_rieng_le')
  const [plannedFloors, setPlannedFloors] = useState('')

  const land = parseFloat(landArea) || 0
  const floors = parseInt(plannedFloors, 10) || 0

  const result = useMemo(() => {
    if (land <= 0) return null
    return computeCapacity({
      landArea: land,
      buildingType,
      plannedFloors: floors || undefined,
    })
  }, [land, buildingType, floors])

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-8 flex items-center gap-3">
        <Link
          href="/studio/regulatory"
          className="rounded-lg p-2 text-stone-500 transition-colors hover:bg-stone-800 hover:text-stone-200"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="font-semibold text-stone-100">Máy tính chỉ tiêu quy hoạch</h1>
          <p className="text-xs text-stone-500">
            Từ diện tích lô → quy mô xây dựng tối đa theo QCVN 01:2021
          </p>
        </div>
      </div>

      <div className="mb-5 rounded-2xl border border-stone-800 bg-stone-900 p-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className={labelClass}>Diện tích lô đất (m²) *</label>
            <input
              className={inputClass}
              value={landArea}
              onChange={(e) => setLandArea(e.target.value)}
              inputMode="decimal"
              placeholder="100"
            />
          </div>
          <div>
            <label className={labelClass}>Loại công trình</label>
            <select
              className={inputClass}
              value={buildingType}
              onChange={(e) => setBuildingType(e.target.value as BuildingType)}
            >
              {BUILDING_TYPES.map((t) => (
                <option key={t} value={t}>
                  {BUILDING_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Số tầng dự kiến (tuỳ chọn)</label>
            <input
              className={inputClass}
              value={plannedFloors}
              onChange={(e) => setPlannedFloors(e.target.value)}
              inputMode="numeric"
              placeholder="tự suy"
            />
          </div>
        </div>
      </div>

      {!result ? (
        <div className="rounded-2xl border border-dashed border-stone-800 py-16 text-center">
          <Calculator size={36} className="mx-auto mb-3 text-stone-700" />
          <p className="text-sm text-stone-500">Nhập diện tích lô đất để xem quy mô xây dựng tối đa</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <ResultCard
              label="Diện tích xây dựng tối đa"
              value={`${fmt(result.maxBuildingArea)} m²`}
              hint={`Mật độ xây dựng tối đa ${result.maxDensityPct}%`}
            />
            <ResultCard
              label="Tổng diện tích sàn tối đa"
              value={`${fmt(result.maxFloorArea)} m²`}
              hint={`Hệ số sử dụng đất (FAR) tối đa ${result.maxFar}`}
            />
            <ResultCard
              label="Số tầng tối đa (ước tính)"
              value={`${result.maxFloorsEstimate} tầng`}
              hint="Khi xây kín tới mật độ cho phép"
            />
            <ResultCard
              label="Chiều cao tối đa tham khảo"
              value={`${fmt(result.maxHeight)} m`}
              hint={floors ? `Ứng với ${floors} tầng` : `Ứng với ${result.maxFloorsEstimate} tầng`}
            />
          </div>

          <div className="rounded-2xl border border-stone-800 bg-stone-900 p-5">
            <h3 className="mb-3 text-sm font-semibold text-stone-300">
              Khoảng lùi tối thiểu (m){' '}
              <span className="font-normal text-stone-500">
                — theo {floors || result.maxFloorsEstimate} tầng
              </span>
            </h3>
            <div className="grid grid-cols-3 gap-3 text-center">
              <SetbackCell label="Mặt tiền" value={result.setback.front} />
              <SetbackCell label="Hông" value={result.setback.side} />
              <SetbackCell label="Phía sau" value={result.setback.rear} />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-800 bg-stone-900/50 px-5 py-4">
            <p className="text-xs leading-relaxed text-stone-500">
              Con số là ước tính định hướng theo quy chuẩn chung. Chỉ tiêu chính thức tra theo
              quy hoạch chi tiết 1/500 của khu vực.
            </p>
            <Link
              href="/studio/regulatory/new"
              className="shrink-0 rounded-xl bg-stone-200 px-4 py-2 text-xs font-medium text-stone-900 transition-colors hover:bg-white"
            >
              Kiểm tra phương án cụ thể →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

function ResultCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-stone-800 bg-stone-900 p-5">
      <p className="text-xs text-stone-500">{label}</p>
      <p className="mt-1 font-display text-2xl text-stone-100">{value}</p>
      <p className="mt-1 text-xs text-stone-600">{hint}</p>
    </div>
  )
}

function SetbackCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-stone-800 bg-stone-800/50 py-3">
      <p className="text-xs text-stone-500">{label}</p>
      <p className="mt-0.5 font-semibold text-stone-100">≥ {value} m</p>
    </div>
  )
}
