import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || url === 'your_supabase_url_here' || !key || key === 'your_supabase_service_role_key_here') {
    return NextResponse.json([])
  }

  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('reg_checks')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Supabase connection failed' }, { status: 500 })
  }
}
