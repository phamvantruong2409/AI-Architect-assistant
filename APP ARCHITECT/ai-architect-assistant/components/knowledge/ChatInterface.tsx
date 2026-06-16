'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import type { KnowledgeChatMessage, MatchedChunk, DocumentCategory } from '@/lib/knowledge-types'

const CATEGORIES: { value: DocumentCategory | ''; label: string }[] = [
  { value: '', label: 'Tất cả tài liệu' },
  { value: 'TCVN', label: 'TCVN' },
  { value: 'QCVN', label: 'QCVN' },
  { value: 'PCCC', label: 'PCCC' },
  { value: 'general', label: 'General' },
]

function SourceCard({ sources }: { sources: MatchedChunk[] }) {
  const [open, setOpen] = useState(false)
  if (!sources.length) return null
  return (
    <div className="mt-2 border border-stone-800 rounded-lg overflow-hidden text-xs">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between px-3 py-2 bg-stone-900 text-stone-500 hover:text-stone-300 transition-colors">
        <span>{sources.length} nguồn tham khảo</span>
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
      {open && (
        <div className="divide-y divide-stone-800">
          {sources.map((s, i) => (
            <div key={s.id} className="px-3 py-2 bg-stone-950">
              <p className="text-stone-400 font-medium mb-1">[{i + 1}] {s.document_name}</p>
              <p className="text-stone-600 leading-relaxed line-clamp-3">{s.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function MessageBubble({ msg }: { msg: KnowledgeChatMessage }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[80%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${isUser ? 'bg-stone-700 text-stone-100 rounded-br-sm' : 'bg-stone-900 text-stone-200 rounded-bl-sm border border-stone-800'}`}>
          {msg.content}
        </div>
        {msg.sources && <SourceCard sources={msg.sources} />}
      </div>
    </div>
  )
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<KnowledgeChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [category, setCategory] = useState<DocumentCategory | ''>('')
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage() {
    const text = input.trim()
    if (!text || loading) return

    const userMsg: KnowledgeChatMessage = { role: 'user', content: text }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/knowledge/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history: messages.slice(-10), category: category || null }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setMessages((prev) => [...prev, { role: 'assistant', content: json.answer, sources: json.sources }])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi khi gửi tin nhắn')
      setMessages((prev) => prev.slice(0, -1))
      setInput(text)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2 border-b border-stone-800 flex items-center gap-2">
        <span className="text-xs text-stone-500">Lọc theo:</span>
        <div className="flex gap-1">
          {CATEGORIES.map((c) => (
            <button key={c.value} onClick={() => setCategory(c.value as DocumentCategory | '')}
              className={`text-xs px-2.5 py-1 rounded-full transition-colors ${category === c.value ? 'bg-stone-200 text-stone-900' : 'bg-stone-800 text-stone-400 hover:bg-stone-700'}`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center gap-3">
            <p className="text-stone-500 text-sm">Đặt câu hỏi về luật xây dựng, tiêu chuẩn, quy chuẩn...</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {['Nhà 5 tầng cần khoảng lùi bao nhiêu?', 'Yêu cầu PCCC cho chung cư cao tầng?', 'Diện tích tối thiểu phòng ngủ theo TCVN?'].map((q) => (
                <button key={q} onClick={() => setInput(q)} className="text-xs bg-stone-800 hover:bg-stone-700 text-stone-400 px-3 py-1.5 rounded-full transition-colors">{q}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-stone-900 border border-stone-800 rounded-2xl rounded-bl-sm px-4 py-3">
              <Loader2 size={16} className="text-stone-500 animate-spin" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {error && <div className="px-4 py-2 text-xs text-red-400 border-t border-stone-800">{error}</div>}

      <div className="border-t border-stone-800 px-4 py-4">
        <div className="flex gap-2">
          <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder="Đặt câu hỏi về tài liệu..." disabled={loading}
            className="flex-1 bg-stone-900 border border-stone-700 text-stone-200 placeholder-stone-600 text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-stone-500 disabled:opacity-50"
          />
          <button onClick={sendMessage} disabled={loading || !input.trim()} className="bg-stone-200 hover:bg-white disabled:opacity-40 text-stone-900 p-3 rounded-xl transition-colors">
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
