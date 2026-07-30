'use server'

import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function generatePayroll(bulan: number, tahun: number) {
  try {
    // 1. Ambil data konfigurasi club (alokasi bucket)
    const { data: config, error: configErr } = await supabaseAdmin
      .from('pengaturan_club')
      .select('*')
      .limit(1)
      .single()

    if (configErr || !config) {
      throw new Error('Gagal memuat konfigurasi club: ' + (configErr?.message || 'Data kosong'))
    }

    const pctCoachPool = Number(config.pct_coach_pool ?? 0.45)
    const pctOperational = Number(config.pct_operational ?? 0.18)
    const pctReserve = Number(config.pct_reserve ?? 0.17)
    const pctDevelopment = Number(config.pct_development ?? 0.12)
    const pctFounderMargin = Number(config.pct_founder_margin ?? 0.08)

    // 2. Ambil total iuran yang sudah dibayar bulan berjalan (status_bayar = 'lunas')
    const { data: paidIurans, error: iuranErr } = await supabaseAdmin
      .from('iuran')
      .select('nominal')
      .eq('bulan', bulan)
      .eq('tahun', tahun)
      .eq('status_bayar', 'lunas')

    if (iuranErr) throw new Error('Gagal mengambil data iuran: ' + iuranErr.message)

    const totalIncome = (paidIurans || []).reduce((acc, curr) => acc + Number(curr.nominal || 0), 0)

    // 3. Hitung jumlah nominal per-bucket
    const coachPoolAmount = totalIncome * pctCoachPool
    const operationalAmount = totalIncome * pctOperational
    const reserveAmount = totalIncome * pctReserve
    const developmentAmount = totalIncome * pctDevelopment
    const founderMarginAmount = totalIncome * pctFounderMargin

    // 4. Ambil program kelas aktif
    const { data: activeClasses, error: classErr } = await supabaseAdmin
      .from('program_kelas')
      .select('*')
      .eq('status_aktif', true)

    if (classErr || !activeClasses) throw new Error('Gagal mengambil program kelas: ' + (classErr?.message || ''))

    // 5. Hitung potensi revenue per jenis kelas berdasarkan siswa aktif
    const classRevenue: Record<string, number> = {}
    let totalClassRevenue = 0

    for (const prog of activeClasses) {
      const { count, error: countErr } = await supabaseAdmin
        .from('siswa')
        .select('*', { count: 'exact', head: true })
        .eq('program_kelas_id', prog.id)
        .eq('status_aktif', true)

      if (countErr) throw new Error(`Gagal menghitung siswa program ${prog.nama_program}: ${countErr.message}`)

      const studentCount = count || 0
      const revenue = studentCount * Number(prog.biaya_bulanan || 0)
      classRevenue[prog.id] = revenue
      totalClassRevenue += revenue
    }

    // 6. Alokasikan coach pool per kelas dan hitung rate per sesi
    const startDate = `${tahun}-${String(bulan).padStart(2, '0')}-01`
    const endDate = new Date(tahun, bulan, 0).toLocaleDateString('sv-SE') // last day of month YYYY-MM-DD

    const classPool: Record<string, number> = {}
    const completedSessionsCount: Record<string, number> = {}
    const ratePerSession: Record<string, number> = {}

    for (const prog of activeClasses) {
      // Proporsi coach pool untuk kelas ini
      const proporsi = totalClassRevenue > 0 ? (classRevenue[prog.id] / totalClassRevenue) : 0
      classPool[prog.id] = coachPoolAmount * proporsi

      // Hitung absensi pelatih (sesi completed) untuk kelas ini
      // Di database kita, absensi_pelatih sudah ada. Kita hitung baris unique per tanggal, pelatih, dan program_kelas_id
      const { data: sessData, error: sessErr } = await supabaseAdmin
        .from('absensi_pelatih')
        .select('id')
        .eq('program_kelas_id', prog.id)
        .gte('tgl', startDate)
        .lte('tgl', endDate)

      if (sessErr) throw new Error(`Gagal memuat sesi untuk kelas ${prog.nama_program}: ${sessErr.message}`)

      const completedCount = sessData?.length || 0
      completedSessionsCount[prog.id] = completedCount
      ratePerSession[prog.id] = completedCount > 0 ? (classPool[prog.id] / completedCount) : 0
    }

    // 7. Ambil semua pelatih aktif
    const { data: coaches, error: coachErr } = await supabaseAdmin
      .from('pelatih')
      .select('*')
      .eq('status_aktif', true)

    if (coachErr || !coaches) throw new Error('Gagal mengambil data pelatih: ' + (coachErr?.message || ''))

    // 8. Hitung honor masing-masing pelatih
    const coachPayouts = []

    for (const coach of coaches) {
      // Ambil absensi mengajar untuk pelatih ini pada bulan ini
      const { data: taughtSessions, error: taughtErr } = await supabaseAdmin
        .from('absensi_pelatih')
        .select('program_kelas_id')
        .eq('pelatih_id', coach.id)
        .gte('tgl', startDate)
        .lte('tgl', endDate)

      if (taughtErr) throw new Error(`Gagal memuat sesi ajar pelatih ${coach.nama}: ${taughtErr.message}`)

      let teachingHonor = 0
      const sessionCount = taughtSessions?.length || 0

      if (taughtSessions && taughtSessions.length > 0) {
        for (const sess of taughtSessions) {
          if (sess.program_kelas_id && ratePerSession[sess.program_kelas_id]) {
            teachingHonor += ratePerSession[sess.program_kelas_id]
          }
        }
      }

      // Hitung founder share (jika is_founder = true)
      // Distribusikan founder margin ke semua yang is_founder secara merata (atau total jika hanya 1 head_coach founder)
      // Dalam hal ini sesuai logic dokumen: Margin Founder dibagikan ke founder pelatih
      const founderCoaches = coaches.filter(c => c.is_founder)
      const founderShare = coach.is_founder && founderCoaches.length > 0
        ? (founderMarginAmount / founderCoaches.length)
        : 0

      const totalPayout = teachingHonor + founderShare

      coachPayouts.push({
        pelatih_id: coach.id,
        sessions_taught: sessionCount,
        teaching_honor: Math.round(teachingHonor),
        founder_margin_share: Math.round(founderShare),
        total_payout: Math.round(totalPayout),
      })
    }

    // 9. Simpan ke database
    // Hapus snapshot yang lama untuk bulan/tahun ini (jika ada) untuk menghindari konflik UNIQUE
    const { data: existingRun } = await supabaseAdmin
      .from('payroll_runs')
      .select('id')
      .eq('bulan', bulan)
      .eq('tahun', tahun)
      .maybeSingle()

    if (existingRun) {
      await supabaseAdmin.from('payroll_runs').delete().eq('id', existingRun.id)
    }

    // Insert payroll_run baru
    const { data: newRun, error: insertRunErr } = await supabaseAdmin
      .from('payroll_runs')
      .insert({
        bulan,
        tahun,
        total_income: Math.round(totalIncome),
        coach_pool_amount: Math.round(coachPoolAmount),
        operational_amount: Math.round(operationalAmount),
        reserve_amount: Math.round(reserveAmount),
        development_amount: Math.round(developmentAmount),
        founder_margin_amount: Math.round(founderMarginAmount),
      })
      .select()
      .single()

    if (insertRunErr || !newRun) {
      throw new Error('Gagal menyimpan ringkasan payroll: ' + (insertRunErr?.message || ''))
    }

    // Insert payroll_details
    const detailsPayload = coachPayouts.map(cp => ({
      payroll_run_id: newRun.id,
      pelatih_id: cp.pelatih_id,
      sessions_taught: cp.sessions_taught,
      teaching_honor: cp.teaching_honor,
      founder_margin_share: cp.founder_margin_share,
      total_payout: cp.total_payout,
      status_dibayar: false,
    }))

    const { error: insertDetailsErr } = await supabaseAdmin
      .from('payroll_details')
      .insert(detailsPayload)

    if (insertDetailsErr) {
      throw new Error('Gagal menyimpan rincian payroll pelatih: ' + insertDetailsErr.message)
    }

    return { success: true, message: 'Berhasil mengkalkulasi payroll baru!' }
  } catch (error: any) {
    return { success: false, message: error.message || 'Terjadi kesalahan' }
  }
}

export async function updateDetailStatusDibayar(detailId: string, status: boolean) {
  try {
    const payload = {
      status_dibayar: status,
      tgl_dibayar: status ? new Date().toISOString().split('T')[0] : null
    }

    const { error } = await supabaseAdmin
      .from('payroll_details')
      .update(payload)
      .eq('id', detailId)

    if (error) throw error
    return { success: true }
  } catch (err: any) {
    return { success: false, message: err.message || 'Gagal mengubah status bayar' }
  }
}
