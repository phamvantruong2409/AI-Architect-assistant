'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, CheckCircle } from 'lucide-react'
import QuizProgress from '@/components/briefing/QuizProgress'
import ImageSelector from '@/components/briefing/ImageSelector'
import LifestyleForm from '@/components/briefing/LifestyleForm'
import type { BriefingProject, SelectedImage, LifestyleHabits, BudgetRange } from '@/lib/briefing-types'
import { QUIZ_PAIRS } from '@/lib/briefing-quiz-data'

type Step = 'loading' | 'error' | 'welcome' | 'quiz' | 'lifestyle' | 'analyzing' | 'done'

const TOTAL_QUIZ_STEPS = QUIZ_PAIRS.length

export default function ClientBriefPage() {
  const { token } = useParams<{ token: string }>()
  const [step, setStep] = useState<Step>('loading')
  const [project, setProject] = useState<BriefingProject | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [quizStep, setQuizStep] = useState(0)
  const [selections, setSelections] = useState<SelectedImage[]>([])

  useEffect(() => {
    fetch(`/api/briefing/projects/${token}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); setStep('error'); return }
        if (d.existing_brief) { setStep('done'); return }
        setProject(d.project)
        setStep('welcome')
      })
      .catch(() => { setError('Không thể tải dữ liệu'); setStep('error') })
  }, [token])

  function handleImageSelect(selected: SelectedImage) {
    const newSelections = [...selections, selected]
    setSelections(newSelections)
    if (quizStep < TOTAL_QUIZ_STEPS - 1) {
      setQuizStep(quizStep + 1)
    } else {
      setStep('lifestyle')
    }
  }

  async function handleLifestyleSubmit(data: {
    family_size: number
    family_members: { role: string; age_range: string }[]
    lifestyle_habits: LifestyleHabits
    budget_range: BudgetRange
    free_text_notes: string
  }) {
    setStep('analyzing')

    try {
      const res = await fetch('/api/briefing/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: project!.id,
          selected_images: selections,
          family_size: data.family_size,
          family_members: data.family_members,
          lifestyle_habits: data.lifestyle_habits,
          budget_range: data.budget_range,
          free_text_notes: data.free_text_notes,
        }),
      })
      if (!res.ok) throw new Error('Phân tích thất bại')
      setStep('done')
    } catch {
      setError('Không thể phân tích dữ liệu. Vui lòng thử lại.')
      setStep('lifestyle')
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <AnimatePresence mode="wait">
        {step === 'loading' && (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex-1 flex items-center justify-center"
          >
            <Loader2 size={32} className="animate-spin text-stone-600" />
          </motion.div>
        )}

        {step === 'error' && (
          <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center"
          >
            <p className="text-stone-400 text-lg">{error ?? 'Đường link không hợp lệ'}</p>
            <p className="text-stone-600 text-sm">Vui lòng liên hệ kiến trúc sư của bạn để nhận link mới.</p>
          </motion.div>
        )}

        {step === 'welcome' && (
          <motion.div key="welcome" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="flex-1 flex flex-col items-center justify-center gap-8 p-8 text-center max-w-lg mx-auto"
          >
            <div className="w-16 h-16 rounded-2xl bg-stone-800 flex items-center justify-center text-2xl">🏡</div>
            <div>
              <h1 className="text-2xl font-display font-semibold mb-2">Chào {project?.client_name}!</h1>
              <p className="text-stone-400 leading-relaxed">
                Bài khảo sát này giúp kiến trúc sư hiểu rõ phong cách và nhu cầu của bạn hơn.
                Chỉ mất khoảng <strong className="text-stone-200">3–5 phút</strong> để hoàn thành.
              </p>
            </div>
            <div className="w-full bg-stone-900 border border-stone-800 rounded-2xl p-4 text-left space-y-2">
              <p className="text-xs text-stone-500 font-medium uppercase tracking-wide">Gồm 2 bước</p>
              <div className="flex items-center gap-3 text-sm text-stone-300"><span>🖼</span><span>Chọn ảnh phong cách yêu thích ({TOTAL_QUIZ_STEPS} cặp)</span></div>
              <div className="flex items-center gap-3 text-sm text-stone-300"><span>📝</span><span>Điền thông tin gia đình và lối sống</span></div>
            </div>
            <button onClick={() => setStep('quiz')}
              className="w-full py-4 bg-stone-200 hover:bg-white text-stone-900 font-semibold rounded-2xl text-base transition-colors"
            >
              Bắt đầu khảo sát →
            </button>
          </motion.div>
        )}

        {step === 'quiz' && (
          <motion.div key="quiz" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col">
            <div className="px-4 pt-6 pb-4 max-w-2xl mx-auto w-full">
              <QuizProgress current={quizStep + 1} total={TOTAL_QUIZ_STEPS} phase="images" />
            </div>
            <div className="flex-1 max-w-2xl mx-auto w-full px-4 pb-8">
              <ImageSelector pair={QUIZ_PAIRS[quizStep]} pairIndex={quizStep} onSelect={handleImageSelect} />
            </div>
          </motion.div>
        )}

        {step === 'lifestyle' && (
          <motion.div key="lifestyle" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
            className="flex-1 max-w-lg mx-auto w-full px-4 py-8"
          >
            <h2 className="text-xl font-semibold mb-6 text-stone-100">Thông tin thêm</h2>
            <LifestyleForm onSubmit={handleLifestyleSubmit} />
            {error && <p className="text-sm text-red-400 mt-3">{error}</p>}
          </motion.div>
        )}

        {step === 'analyzing' && (
          <motion.div key="analyzing" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex-1 flex flex-col items-center justify-center gap-6 text-center p-8"
          >
            <Loader2 size={40} className="animate-spin text-stone-400" />
            <div>
              <p className="text-lg font-semibold text-stone-200">AI đang phân tích phong cách của bạn...</p>
              <p className="text-stone-500 text-sm mt-2">Quá trình này mất khoảng 30 giây</p>
            </div>
          </motion.div>
        )}

        {step === 'done' && (
          <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="flex-1 flex flex-col items-center justify-center gap-6 text-center p-8 max-w-md mx-auto"
          >
            <CheckCircle size={56} className="text-emerald-400" />
            <div>
              <h2 className="text-2xl font-semibold mb-2">Cảm ơn bạn!</h2>
              <p className="text-stone-400 leading-relaxed">
                Chúng tôi đã nhận được thông tin của bạn. Kiến trúc sư sẽ liên hệ lại sớm với bản thiết kế brief được cá nhân hóa.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
