import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { embedText, generateAnswer } from '@/lib/knowledge-gemini'
import type { KnowledgeChatMessage } from '@/lib/knowledge-types'

export async function POST(req: NextRequest) {
  const { message, history = [], category } = await req.json()

  if (!message?.trim()) {
    return NextResponse.json({ error: 'Câu hỏi không được để trống' }, { status: 400 })
  }

  const supabase = createServiceClient()

  let queryEmbedding: number[]
  try {
    queryEmbedding = await embedText(message)
  } catch {
    return NextResponse.json({ error: 'Không thể tạo embedding' }, { status: 500 })
  }

  const { data: chunks, error: matchError } = await supabase.rpc('match_knowledge_chunks', {
    query_embedding: queryEmbedding,
    match_threshold: 0.4,
    match_count: 6,
    filter_category: category ?? null,
  })

  if (matchError) {
    return NextResponse.json({ error: matchError.message }, { status: 500 })
  }

  if (!chunks || chunks.length === 0) {
    return NextResponse.json({
      answer: 'Không tìm thấy thông tin liên quan trong thư viện tài liệu. Hãy thử upload thêm tài liệu hoặc thay đổi từ khóa.',
      sources: [],
    })
  }

  const answer = await generateAnswer(message, chunks, history as KnowledgeChatMessage[])
  return NextResponse.json({ answer, sources: chunks })
}
