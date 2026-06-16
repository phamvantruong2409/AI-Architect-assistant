import Link from 'next/link'
import { BookOpen, MessageSquare, Upload } from 'lucide-react'

export default function KnowledgeLandingPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-stone-800 flex items-center justify-center text-2xl mx-auto mb-6">📚</div>
      <h1 className="text-2xl font-display font-semibold text-stone-100 mb-3">Knowledge Base AI</h1>
      <p className="text-stone-400 leading-relaxed max-w-lg mx-auto mb-12">
        Upload tài liệu TCVN, QCVN, PCCC — AI lập chỉ mục và trả lời câu hỏi dựa trên nội dung tài liệu của bạn.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link href="/studio/knowledge/library"
          className="group bg-stone-900 border border-stone-800 hover:border-stone-600 rounded-2xl p-6 text-left transition-all"
        >
          <div className="w-10 h-10 bg-stone-800 group-hover:bg-stone-700 rounded-xl flex items-center justify-center mb-4 transition-colors">
            <BookOpen size={20} className="text-stone-400" />
          </div>
          <h2 className="font-semibold text-stone-100 mb-1">Thư viện tài liệu</h2>
          <p className="text-sm text-stone-500">Upload và quản lý tài liệu PDF, DOCX, TXT</p>
        </Link>

        <Link href="/studio/knowledge/chat"
          className="group bg-stone-900 border border-stone-800 hover:border-stone-600 rounded-2xl p-6 text-left transition-all"
        >
          <div className="w-10 h-10 bg-stone-800 group-hover:bg-stone-700 rounded-xl flex items-center justify-center mb-4 transition-colors">
            <MessageSquare size={20} className="text-stone-400" />
          </div>
          <h2 className="font-semibold text-stone-100 mb-1">Chat với tài liệu</h2>
          <p className="text-sm text-stone-500">Hỏi đáp dựa trên nội dung tài liệu đã upload</p>
        </Link>
      </div>

      <div className="mt-8 bg-stone-900/50 border border-stone-800 rounded-2xl p-4 text-left">
        <p className="text-xs text-stone-600 font-medium uppercase tracking-wide mb-2">Luồng sử dụng</p>
        <div className="space-y-2 text-sm text-stone-400">
          <div className="flex items-center gap-3"><Upload size={13} className="text-stone-600 shrink-0" /><span>Upload PDF/DOCX từ Thư viện</span></div>
          <div className="flex items-center gap-3"><span className="text-stone-600 text-xs shrink-0">⚡</span><span>Bấm nút lập chỉ mục (AI chia đoạn + embedding)</span></div>
          <div className="flex items-center gap-3"><MessageSquare size={13} className="text-stone-600 shrink-0" /><span>Đặt câu hỏi trong Chat — AI trích dẫn nguồn tài liệu</span></div>
        </div>
      </div>
    </div>
  )
}
