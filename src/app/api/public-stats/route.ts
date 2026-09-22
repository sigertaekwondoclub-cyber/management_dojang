import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  const now = new Date()
  const bul = now.getMonth() + 1
  const tah = now.getFullYear()
  const lastDay = new Date(tah, bul, 0).getDate()
  const startTgl = `${tah}-${String(bul).padStart(2, '0')}-01`
  const endTgl = `${tah}-${String(bul).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  const [siswaRes, pelatihRes, absensiRes] = await Promise.all([
    supabaseAdmin
      .from('siswa')
      .select('id', { count: 'exact', head: true })
      .eq('status_aktif', true),
    supabaseAdmin
      .from('pelatih')
      .select('id', { count: 'exact', head: true })
      .eq('status_aktif', true),
    supabaseAdmin
      .from('absensi_siswa')
      .select('siswa_id, siswa!inner(nama, sabuk_saat_ini, status_aktif)')
      .eq('status_hadir', 'hadir')
      .gte('tgl', startTgl)
      .lte('tgl', endTgl)
  ])

  // Count attendance per active student
  const attendanceCounts: Record<string, { nama: string; sabuk: string; totalHadir: number }> = {}
  if (absensiRes.data) {
    for (const row of absensiRes.data) {
      const s = row.siswa as any
      if (!s || !s.status_aktif) continue
      const id = row.siswa_id
      if (!attendanceCounts[id]) {
        attendanceCounts[id] = {
          nama: s.nama,
          sabuk: s.sabuk_saat_ini,
          totalHadir: 0
        }
      }
      attendanceCounts[id].totalHadir += 1
    }
  }

  const topDisiplin = Object.values(attendanceCounts)
    .sort((a, b) => b.totalHadir - a.totalHadir)
    .slice(0, 5)

  return NextResponse.json({
    siswaAktif: siswaRes.count ?? 0,
    pelatihAktif: pelatihRes.count ?? 0,
    topDisiplin,
    periodeBulan: bul,
    periodeTahun: tah,
  })
}
