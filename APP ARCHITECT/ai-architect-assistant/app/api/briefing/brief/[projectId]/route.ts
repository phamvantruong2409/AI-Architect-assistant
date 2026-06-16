import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params
  const supabase = createServiceClient()

  const { data: brief, error: briefError } = await supabase
    .from('briefing_design_briefs')
    .select('*')
    .eq('project_id', projectId)
    .single()

  if (briefError || !brief) {
    return NextResponse.json({ error: 'Không tìm thấy design brief' }, { status: 404 })
  }

  const { data: project } = await supabase
    .from('briefing_projects')
    .select('*')
    .eq('id', projectId)
    .single()

  const { data: session } = await supabase
    .from('briefing_quiz_sessions')
    .select('budget_range')
    .eq('project_id', projectId)
    .single()

  return NextResponse.json({ brief, project, budget_range: session?.budget_range })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params
  const { kts_notes } = await req.json()
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('briefing_design_briefs')
    .update({ kts_notes })
    .eq('project_id', projectId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
