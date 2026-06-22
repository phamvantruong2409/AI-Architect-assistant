'use client'

interface QuizProgressProps {
  current: number
  total: number
  phase: 'images' | 'lifestyle'
}

export default function QuizProgress({ current, total, phase }: QuizProgressProps) {
  const pct = phase === 'images' ? Math.round((current / total) * 100) : 100

  return (
    <div className="mb-8">
      <div className="flex justify-between text-sm text-stone-500 mb-2">
        <span>
          {phase === 'images'
            ? `Hình ảnh ${current + 1} / ${total}`
            : 'Thông tin sinh hoạt'}
        </span>
        <span>{pct}%</span>
      </div>
      <div className="h-1.5 bg-stone-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-amber-500 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
