import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { extractText, detectFileType } from '@/lib/knowledge-extractors'

export async function GET() {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('knowledge_documents')
    .select('id, name, file_type, category, status, chunk_count, created_at, error_message')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ documents: data })
}

export async function POST(req: NextRequest) {
  const supabase = createServiceClient()

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const category = (formData.get('category') as string) || 'general'

  if (!file) return NextResponse.json({ error: 'Không có file' }, { status: 400 })

  const fileType = detectFileType(file.name)
  if (!fileType) {
    return NextResponse.json(
      { error: 'Định dạng không hỗ trợ. Chỉ chấp nhận PDF, DOCX, TXT.' },
      { status: 400 }
    )
  }

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  let content: string
  try {
    content = await extractText(buffer, fileType)
  } catch {
    return NextResponse.json({ error: 'Không thể đọc nội dung file' }, { status: 422 })
  }

  if (!content.trim()) {
    return NextResponse.json({ error: 'File không có nội dung văn bản' }, { status: 422 })
  }

  const { data, error } = await supabase
    .from('knowledge_documents')
    .insert({ name: file.name, file_type: fileType, category, content, status: 'pending' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ document: data }, { status: 201 })
}
