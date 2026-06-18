import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { analyzeClientBrief } from '@/lib/briefing-gemini'
import { calculateStyleScores } from '@/lib/briefing-quiz-data'
import { DEFAULT_GEMINI_MODEL } from '@/lib/gemini-models'
import type { QuizSession } from '@/lib/briefing-types'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const {
    project_id,
    selected_images,
    family_size,
    family_members,
    lifestyle_habits,
    budget_range,
    free_text_notes,
  } = body

  if (!project_id) {
    return NextResponse.json({ error: 'Thiếu project_id' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data: project, error: projectError } = await supabase
    .from('briefing_projects')
    .select('*')
    .eq('id', project_id)
    .single()

  if (projectError || !project) {
    return NextResponse.json({ error: 'Không tìm thấy dự án' }, { status: 404 })
  }

  const style_scores = calculateStyleScores(selected_images || [])

  const sessionData = {
    project_id,
    selected_images: selected_images || [],
    style_scores,
    family_size: family_size || 1,
    family_members: family_members || [],
    lifestyle_habits: lifestyle_habits || {},
    budget_range: budget_range || '500m_1b',
    free_text_notes: free_text_notes || '',
    completed_at: new Date().toISOString(),
  }

  const { data: existingSession } = await supabase
    .from('briefing_quiz_sessions')
    .select('id')
    .eq('project_id', project_id)
    .single()

  if (existingSession) {
    await supabase.from('briefing_quiz_sessions').update(sessionData).eq('id', existingSession.id)
  } else {
    await supabase.from('briefing_quiz_sessions').insert(sessionData)
  }

  const session: QuizSession = {
    id: existingSession?.id || '',
    ...sessionData,
    started_at: new Date().toISOString(),
  }

  const briefData = await analyzeClientBrief(session, project.project_name)

  const { data: existingBrief } = await supabase
    .from('briefing_design_briefs')
    .select('id')
    .eq('project_id', project_id)
    .single()

  let brief
  if (existingBrief) {
    const { data } = await supabase
      .from('briefing_design_briefs')
      .update({ ...briefData, generated_at: new Date().toISOString(), gemini_model: DEFAULT_GEMINI_MODEL })
      .eq('id', existingBrief.id)
      .select()
      .single()
    brief = data
  } else {
    const { data } = await supabase
      .from('briefing_design_briefs')
      .insert({ project_id, ...briefData, gemini_model: DEFAULT_GEMINI_MODEL })
      .select()
      .single()
    brief = data
  }

  await supabase
    .from('briefing_projects')
    .update({ status: 'completed', updated_at: new Date().toISOString() })
    .eq('id', project_id)

  return NextResponse.json({ brief, project })
}
