import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const supabase = createServiceClient()

  const { data: project, error } = await supabase
    .from('briefing_projects')
    .select('*')
    .eq('client_token', token)
    .single()

  if (error || !project) {
    return NextResponse.json({ error: 'Không tìm thấy dự án' }, { status: 404 })
  }

  // Kiểm tra xem đã có brief chưa
  const { data: brief } = await supabase
    .from('briefing_design_briefs')
    .select('*')
    .eq('project_id', project.id)
    .single()

  return NextResponse.json({ project, brief: brief || null })
}
