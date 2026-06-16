import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET() {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('briefing_projects')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { client_name, client_email, project_name } = body

  if (!client_name || !project_name) {
    return NextResponse.json({ error: 'Thiếu tên khách hàng hoặc tên dự án' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('briefing_projects')
    .insert({
      client_name,
      client_email: client_email || null,
      project_name,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const clientUrl = `${appUrl}/brief/${data.client_token}`
  return NextResponse.json({ project: data, client_url: clientUrl }, { status: 201 })
}
