import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  const { reportId } = await params
  const supabase = createServiceClient()

  const { data: report, error: reportErr } = await supabase
    .from('reg_reports')
    .select('*')
    .eq('check_id', reportId)
    .single()

  if (reportErr || !report) {
    return NextResponse.json({ error: 'Không tìm thấy báo cáo' }, { status: 404 })
  }

  const { data: check, error: checkErr } = await supabase
    .from('reg_checks')
    .select('*')
    .eq('id', reportId)
    .single()

  if (checkErr || !check) {
    return NextResponse.json({ error: 'Không tìm thấy check' }, { status: 404 })
  }

  return NextResponse.json({ report, check })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  const { reportId } = await params
  const supabase = createServiceClient()
  const { kts_notes } = await req.json()

  const { error } = await supabase
    .from('reg_reports')
    .update({ kts_notes })
    .eq('check_id', reportId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
