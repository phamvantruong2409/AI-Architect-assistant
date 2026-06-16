import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import ChatInterface from '@/components/knowledge/ChatInterface'

export default function KnowledgeChatPage() {
  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      <div className="flex items-center gap-3 px-4 py-4 border-b border-stone-800 shrink-0">
        <Link href="/studio/knowledge" className="p-2 text-stone-500 hover:text-stone-200 hover:bg-stone-800 rounded-lg transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="font-semibold text-stone-100 text-sm">Chat với tài liệu</h1>
          <p className="text-xs text-stone-500">AI trả lời dựa trên tài liệu đã lập chỉ mục</p>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <ChatInterface />
      </div>
    </div>
  )
}
