'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import type { QuizPair, SelectedImage } from '@/lib/briefing-types'

interface ImageSelectorProps {
  pair: QuizPair
  pairIndex: number
  onSelect: (selected: SelectedImage) => void
}

export default function ImageSelector({ pair, pairIndex, onSelect }: ImageSelectorProps) {
  const [chosen, setChosen] = useState<'A' | 'B' | null>(null)
  const [hovering, setHovering] = useState<'A' | 'B' | null>(null)
  const dwellRef = useRef<Record<'A' | 'B', number>>({ A: 0, B: 0 })
  const hoverStartRef = useRef<number | null>(null)

  useEffect(() => {
    dwellRef.current = { A: 0, B: 0 }
    setChosen(null)
  }, [pairIndex])

  function handleHoverStart(side: 'A' | 'B') {
    setHovering(side)
    hoverStartRef.current = Date.now()
  }

  function handleHoverEnd() {
    if (hovering && hoverStartRef.current) {
      dwellRef.current[hovering] += Date.now() - hoverStartRef.current
    }
    setHovering(null)
    hoverStartRef.current = null
  }

  function handleChoose(side: 'A' | 'B') {
    if (chosen) return
    setChosen(side)
    const img = side === 'A' ? pair.imageA : pair.imageB
    const dwell = dwellRef.current[side]
    setTimeout(() => {
      onSelect({ id: img.id, url: img.url, tags: img.tags, style: img.style, dwell_time_ms: dwell })
    }, 600)
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pairIndex}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.35 }}
        className="w-full"
      >
        <h2 className="text-center text-xl font-semibold text-stone-800 mb-6">{pair.question}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(['A', 'B'] as const).map((side) => {
            const img = side === 'A' ? pair.imageA : pair.imageB
            const isChosen = chosen === side
            const isRejected = chosen !== null && chosen !== side
            return (
              <motion.button
                key={side}
                onClick={() => handleChoose(side)}
                onMouseEnter={() => handleHoverStart(side)}
                onMouseLeave={handleHoverEnd}
                disabled={!!chosen}
                whileHover={!chosen ? { scale: 1.02 } : {}}
                whileTap={!chosen ? { scale: 0.98 } : {}}
                className={`relative rounded-2xl overflow-hidden aspect-[4/3] cursor-pointer border-4 transition-all duration-300 ${
                  isChosen
                    ? 'border-amber-500 ring-4 ring-amber-200'
                    : isRejected
                    ? 'border-transparent opacity-40'
                    : 'border-transparent hover:border-amber-300'
                }`}
              >
                <Image src={img.url} alt={img.alt} fill className="object-cover" sizes="(max-width: 768px) 100vw, 50vw" />
                {hovering === side && !chosen && (
                  <div className="absolute inset-0 bg-amber-500/10 transition-opacity" />
                )}
                <div className="absolute bottom-3 left-3 right-3 flex flex-wrap gap-1">
                  {img.tags.slice(0, 3).map((tag) => (
                    <span key={tag} className="text-xs bg-black/50 text-white px-2 py-0.5 rounded-full backdrop-blur-sm">
                      {tag}
                    </span>
                  ))}
                </div>
                {isChosen && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute top-3 right-3 w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center shadow-lg"
                  >
                    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </motion.div>
                )}
              </motion.button>
            )
          })}
        </div>
        <p className="text-center text-sm text-stone-400 mt-4">Chọn hình ảnh khiến bạn cảm thấy muốn ở trong đó hơn</p>
      </motion.div>
    </AnimatePresence>
  )
}
