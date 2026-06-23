import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { embedText, generateAnswer } from '@/lib/knowledge-gemini'
import { geminiErrorCode, geminiErrorMessage } from '@/lib/gemini-error'
import { deepseekErrorMessage } from '@/lib/deepseek'
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
  } catch (error) {
    // Embedding dùng Gemini → thiếu key báo "hãy nhập key" giống mọi tính năng Gemini khác.
    const code = geminiErrorCode(error)
    return NextResponse.json(
      { error: geminiErrorMessage(error), code },
      { status: code === 'NO_API_KEY' ? 400 : 500 }
    )
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

  try {
    const answer = await generateAnswer(message, chunks, history as KnowledgeChatMessage[])
    return NextResponse.json({ answer, sources: chunks })
  } catch (error) {
    // Tạo sinh câu trả lời dùng DeepSeek (key nhúng sẵn) → báo lỗi tương ứng nếu có sự cố.
    return NextResponse.json({ error: deepseekErrorMessage(error) }, { status: 500 })
  }
}
