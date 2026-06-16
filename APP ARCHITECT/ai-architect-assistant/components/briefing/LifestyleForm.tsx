'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import type { FamilyMember, LifestyleHabits, BudgetRange } from '@/lib/briefing-types'

interface LifestyleFormData {
  family_size: number
  family_members: FamilyMember[]
  lifestyle_habits: LifestyleHabits
  budget_range: BudgetRange
  free_text_notes: string
}

interface LifestyleFormProps {
  onSubmit: (data: LifestyleFormData) => void
  isLoading?: boolean
}

const HABITS: { key: keyof LifestyleHabits; label: string; emoji: string }[] = [
  { key: 'cooking', label: 'Thích nấu ăn', emoji: '🍳' },
  { key: 'wfh', label: 'Làm việc tại nhà', emoji: '💻' },
  { key: 'pets', label: 'Nuôi thú cưng', emoji: '🐾' },
  { key: 'exercise', label: 'Tập thể dục ở nhà', emoji: '🏋️' },
  { key: 'guests_frequent', label: 'Thường xuyên có khách', emoji: '👥' },
  { key: 'gardening', label: 'Trồng cây / làm vườn', emoji: '🌿' },
]

const BUDGET_OPTIONS: { value: BudgetRange; label: string; sub: string }[] = [
  { value: 'under_500m', label: 'Dưới 500 triệu', sub: 'Tối ưu vật liệu, thiết kế thông minh' },
  { value: '500m_1b', label: '500 triệu – 1 tỷ', sub: 'Cân bằng thẩm mỹ và chất lượng' },
  { value: '1b_2b', label: '1 tỷ – 2 tỷ', sub: 'Vật liệu cao cấp, nội thất chọn lọc' },
  { value: 'over_2b', label: 'Trên 2 tỷ', sub: 'Không giới hạn, hoàn thiện premium' },
]

export default function LifestyleForm({ onSubmit, isLoading }: LifestyleFormProps) {
  const [familySize, setFamilySize] = useState(2)
  const [members, setMembers] = useState<FamilyMember[]>([
    { role: 'adult', age_range: '25–45' },
    { role: 'adult', age_range: '25–45' },
  ])
  const [habits, setHabits] = useState<LifestyleHabits>({
    cooking: false, wfh: false, pets: false,
    exercise: false, guests_frequent: false, gardening: false,
  })
  const [budget, setBudget] = useState<BudgetRange>('500m_1b')
  const [notes, setNotes] = useState('')

  function updateMemberCount(count: number) {
    setFamilySize(count)
    const current = [...members]
    if (count > current.length) {
      while (current.length < count) current.push({ role: 'adult', age_range: '25–45' })
    } else {
      current.splice(count)
    }
    setMembers(current)
  }

  function updateMember(index: number, field: keyof FamilyMember, value: string) {
    const updated = [...members]
    updated[index] = { ...updated[index], [field]: value }
    setMembers(updated)
  }

  function toggleHabit(key: keyof LifestyleHabits) {
    setHabits((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSubmit({ family_size: familySize, family_members: members, lifestyle_habits: habits, budget_range: budget, free_text_notes: notes })
  }

  return (
    <motion.form initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} onSubmit={handleSubmit} className="space-y-8 max-w-2xl mx-auto">
      <section>
        <h3 className="font-semibold text-stone-700 mb-4 flex items-center gap-2">
          <span className="text-xl">👨‍👩‍👧‍👦</span> Thành phần gia đình
        </h3>
        <div className="flex items-center gap-4 mb-4">
          <label className="text-sm text-stone-600">Số người:</label>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => updateMemberCount(Math.max(1, familySize - 1))} className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 font-bold text-stone-700 transition-colors">−</button>
            <span className="w-8 text-center font-bold text-stone-800 text-lg">{familySize}</span>
            <button type="button" onClick={() => updateMemberCount(Math.min(10, familySize + 1))} className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 font-bold text-stone-700 transition-colors">+</button>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {members.map((m, i) => (
            <div key={i} className="flex gap-2 bg-stone-50 rounded-xl p-3">
              <select value={m.role} onChange={(e) => updateMember(i, 'role', e.target.value)} className="flex-1 text-sm bg-white border border-stone-200 rounded-lg px-2 py-1.5 text-stone-700">
                <option value="adult">Người lớn</option>
                <option value="elder">Người cao tuổi</option>
                <option value="child">Trẻ em</option>
              </select>
              <select value={m.age_range} onChange={(e) => updateMember(i, 'age_range', e.target.value)} className="flex-1 text-sm bg-white border border-stone-200 rounded-lg px-2 py-1.5 text-stone-700">
                <option value="0–6">0 – 6 tuổi</option>
                <option value="7–17">7 – 17 tuổi</option>
                <option value="18–24">18 – 24 tuổi</option>
                <option value="25–45">25 – 45 tuổi</option>
                <option value="46–60">46 – 60 tuổi</option>
                <option value="60+">Trên 60 tuổi</option>
              </select>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="font-semibold text-stone-700 mb-4 flex items-center gap-2">
          <span className="text-xl">🏠</span> Thói quen sinh hoạt
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {HABITS.map(({ key, label, emoji }) => (
            <button key={key} type="button" onClick={() => toggleHabit(key)}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-sm font-medium transition-all ${habits[key] ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300'}`}
            >
              <span className="text-2xl">{emoji}</span>
              <span className="text-center leading-tight">{label}</span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3 className="font-semibold text-stone-700 mb-4 flex items-center gap-2">
          <span className="text-xl">💰</span> Ngân sách dự kiến
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {BUDGET_OPTIONS.map((opt) => (
            <button key={opt.value} type="button" onClick={() => setBudget(opt.value)}
              className={`text-left p-4 rounded-xl border-2 transition-all ${budget === opt.value ? 'border-amber-500 bg-amber-50' : 'border-stone-200 bg-white hover:border-stone-300'}`}
            >
              <div className={`font-semibold ${budget === opt.value ? 'text-amber-700' : 'text-stone-800'}`}>{opt.label}</div>
              <div className="text-xs text-stone-500 mt-0.5">{opt.sub}</div>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3 className="font-semibold text-stone-700 mb-3 flex items-center gap-2">
          <span className="text-xl">💬</span> Điều bạn muốn nói thêm
        </h3>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ví dụ: Nhà có bà nội đi lại khó khăn. Cần phòng riêng để thờ cúng..." rows={4} className="w-full border border-stone-200 rounded-xl px-4 py-3 text-stone-700 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none text-sm" />
      </section>

      <button type="submit" disabled={isLoading} className="w-full py-4 bg-amber-500 hover:bg-amber-600 disabled:bg-stone-300 text-white font-semibold rounded-xl text-lg transition-colors shadow-sm">
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            AI đang phân tích...
          </span>
        ) : '✨ Hoàn thành & Tạo Design Brief'}
      </button>
    </motion.form>
  )
}
