import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { chunkText } from '@/lib/knowledge-chunker'
import { embedText } from '@/lib/knowledge-gemini'
import { geminiErrorCode, geminiErrorMessage } from '@/lib/gemini-error'

const EMBED_DELAY_MS = 200

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createServiceClient()

  const { data: doc, error: fetchError } = await supabase
    .from('knowledge_documents')
    .select('id, content, status')
    .eq('id', id)
    .single()

  if (fetchError || !doc) {
    return NextResponse.json({ error: 'Không tìm thấy tài liệu' }, { status: 404 })
  }
  if (doc.status === 'ready') {
    return NextResponse.json({ error: 'Tài liệu đã được xử lý' }, { status: 409 })
  }

  await supabase.from('knowledge_documents').update({ status: 'processing' }).eq('id', id)

  try {
    const chunks = chunkText(doc.content)
    await supabase.from('knowledge_chunks').delete().eq('document_id', id)

    for (let i = 0; i < chunks.length; i++) {
      const embedding = await embedText(chunks[i])
      await supabase.from('knowledge_chunks').insert({
        document_id: id,
        content: chunks[i],
        embedding: JSON.stringify(embedding),
        chunk_index: i,
      })
      if (i < chunks.length - 1) {
        await new Promise((r) => setTimeout(r, EMBED_DELAY_MS))
      }
    }

    await supabase
      .from('knowledge_documents')
      .update({ status: 'ready', chunk_count: chunks.length })
      .eq('id', id)

    return NextResponse.json({ success: true, chunk_count: chunks.length })
  } catch (err) {
    // Embedding dùng Gemini → thiếu key báo "hãy nhập key" thay vì lỗi kỹ thuật khó hiểu.
    const code = geminiErrorCode(err)
    const message = code === 'UNKNOWN'
      ? (err instanceof Error ? err.message : 'Lỗi không xác định')
      : geminiErrorMessage(err)
    await supabase
      .from('knowledge_documents')
      .update({ status: 'error', error_message: message })
      .eq('id', id)
    return NextResponse.json(
      { error: message, code },
      { status: code === 'NO_API_KEY' ? 400 : 500 }
    )
  }
}
