import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { analyzeRegulatory } from '@/lib/regulatory-gemini'
import type { CheckFormData } from '@/lib/regulatory-types'

export async function POST(req: NextRequest) {
  const supabase = createServiceClient()

  let body: CheckFormData & { floorplan_image_base64?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body không hợp lệ' }, { status: 400 })
  }

  const {
    project_name,
    project_address,
    building_type,
    zoning_type,
    land_area,
    land_width,
    land_depth,
    floors,
    total_height,
    building_area,
    total_floor_area,
    setback_front,
    setback_rear,
    setback_left,
    setback_right,
    corridor_width,
    window_ratio,
    extra_notes,
    floorplan_image_base64,
  } = body

  if (!project_name || !project_address || !land_area || !building_area) {
    return NextResponse.json({ error: 'Thiếu thông tin bắt buộc' }, { status: 400 })
  }

  const { data: checkRow, error: checkErr } = await supabase
    .from('reg_checks')
    .insert({
      project_name,
      project_address,
      building_type,
      zoning_type,
      land_area,
      land_width,
      land_depth,
      floors,
      total_height,
      building_area,
      total_floor_area,
      setback_front,
      setback_rear,
      setback_left,
      setback_right,
      corridor_width,
      window_ratio,
      extra_notes: extra_notes || '',
      status: 'analyzing',
    })
    .select()
    .single()

  if (checkErr || !checkRow) {
    return NextResponse.json({ error: checkErr?.message ?? 'Không tạo được check' }, { status: 500 })
  }

  let analysisResult
  try {
    analysisResult = await analyzeRegulatory(checkRow, floorplan_image_base64)
  } catch (e) {
    await supabase.from('reg_checks').update({ status: 'error' }).eq('id', checkRow.id)
    const msg = e instanceof Error ? e.message : String(e)
    const isQuota = msg.includes('429') || msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('resource_exhausted')
    const userMsg = isQuota
      ? 'Gemini API hết quota (429). Vui lòng kiểm tra GEMINI_API_KEY tại aistudio.google.com.'
      : `Phân tích AI thất bại: ${msg}`
    return NextResponse.json({ error: userMsg }, { status: 500 })
  }

  const { data: reportRow, error: reportErr } = await supabase
    .from('reg_reports')
    .insert({
      check_id: checkRow.id,
      overall_score: analysisResult.overall_score,
      compliance_summary: analysisResult.compliance_summary,
      violations: analysisResult.violations,
      passed_checks: analysisResult.passed_checks,
      gemini_model: 'gemini-2.0-flash',
    })
    .select()
    .single()

  if (reportErr || !reportRow) {
    await supabase.from('reg_checks').update({ status: 'error' }).eq('id', checkRow.id)
    return NextResponse.json({ error: reportErr?.message ?? 'Không lưu được report' }, { status: 500 })
  }

  await supabase.from('reg_checks').update({ status: 'completed' }).eq('id', checkRow.id)

  return NextResponse.json({ check_id: checkRow.id, report_id: reportRow.id })
}
