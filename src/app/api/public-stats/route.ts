import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  const [siswaRes, pelatihRes] = await Promise.all([
    supabaseAdmin
      .from('siswa')
      .select('id', { count: 'exact', head: true })
      .eq('status_aktif', true),
    supabaseAdmin
      .from('pelatih')
      .select('id', { count: 'exact', head: true })
      .eq('status_aktif', true),
  ])

  return NextResponse.json({
    siswaAktif: siswaRes.count ?? 0,
    pelatihAktif: pelatihRes.count ?? 0,
  })
}
