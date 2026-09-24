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

    // 5. Hitung potensi revenue per jenis kelas berdasarkan siswa aktif (Batch Query)
    const classRevenue: Record<string, number> = {}
    let totalClassRevenue = 0

    const { data: allActiveStudents, error: countErr } = await supabaseAdmin
      .from('siswa')
      .select('program_kelas_id')
      .eq('status_aktif', true)

    if (countErr) throw new Error(`Gagal memuat data siswa aktif: ${countErr.message}`)

    for (const prog of activeClasses) {
      const studentCount = allActiveStudents?.filter(s => s.program_kelas_id === prog.id).length || 0
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

    // Batch query absensi pelatih untuk bulan berjalan
    const { data: allSessions, error: sessErr } = await supabaseAdmin
      .from('absensi_pelatih')
      .select('id, program_kelas_id, pelatih_id')
      .gte('tgl', startDate)
      .lte('tgl', endDate)

    if (sessErr) throw new Error(`Gagal memuat data absensi pelatih: ${sessErr.message}`)

    for (const prog of activeClasses) {
      // Proporsi coach pool untuk kelas ini
      const proporsi = totalClassRevenue > 0 ? (classRevenue[prog.id] / totalClassRevenue) : 0
      classPool[prog.id] = coachPoolAmount * proporsi

      // Hitung absensi pelatih (sesi completed) untuk kelas ini
      const completedCount = allSessions?.filter(s => s.program_kelas_id === prog.id).length || 0
      completedSessionsCount[prog.id] = completedCount
      ratePerSession[prog.id] = completedCount > 0 ? (classPool[prog.id] / completedCount) : 0
    }

    // 7. Ambil semua pelatih aktif
    const { data: coaches, error: coachErr } = await supabaseAdmin
      .from('pelatih')
      .select('*')
      .eq('status_aktif', true)

    if (coachErr || !coaches) throw new Error('Gagal mengambil data pelatih: ' + (coachErr?.message || ''))

    // 8. Ambil kasbon aktif pelatih yang belum lunas
    const { data: activeDebts } = await supabaseAdmin
      .from('kasbon_pelatih')
      .select('pelatih_id, sisa_hutang')
      .eq('status', 'belum_lunas')

    const coachActiveDebts: Record<string, number> = {}
    ;(activeDebts || []).forEach(d => {
      coachActiveDebts[d.pelatih_id] = (coachActiveDebts[d.pelatih_id] || 0) + Number(d.sisa_hutang || 0)
    })

    // 9. Hitung honor masing-masing pelatih & estimasi potongan kasbon
    const coachPayouts = []

    for (const coach of coaches) {
      // Ambil absensi mengajar untuk pelatih ini di memory
      const taughtSessions = allSessions?.filter(s => s.pelatih_id === coach.id) || []
      let teachingHonor = 0
      const sessionCount = taughtSessions.length

      for (const sess of taughtSessions) {
        if (sess.program_kelas_id && ratePerSession[sess.program_kelas_id]) {
          teachingHonor += ratePerSession[sess.program_kelas_id]
        }
      }

      // Hitung founder share (jika is_founder = true)
      const founderCoaches = coaches.filter(c => c.is_founder)
      const founderShare = coach.is_founder && founderCoaches.length > 0
        ? (founderMarginAmount / founderCoaches.length)
        : 0

      const totalPayout = teachingHonor + founderShare
      const sisaHutang = coachActiveDebts[coach.id] || 0
      const defaultPotongan = Math.min(totalPayout, sisaHutang)
      const honorBersih = Math.max(0, totalPayout - defaultPotongan)

      coachPayouts.push({
        pelatih_id: coach.id,
        sessions_taught: sessionCount,
        teaching_honor: Math.round(teachingHonor),
        founder_margin_share: Math.round(founderShare),
        total_payout: Math.round(totalPayout),
        potongan_kasbon: Math.round(defaultPotongan),
        honor_bersih: Math.round(honorBersih),
      })
    }

    // 10. Simpan ke database
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
      potongan_kasbon: cp.potongan_kasbon,
      honor_bersih: cp.honor_bersih,
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
    // 1. Ambil detail payroll
    const { data: detail, error: fetchErr } = await supabaseAdmin
      .from('payroll_details')
      .select('*, pelatih:pelatih_id(nama)')
      .eq('id', detailId)
      .single()

    if (fetchErr || !detail) throw new Error('Detail payroll tidak ditemukan')

    if (status === true) {
      // 2. Jika ditandai dibayar dan ada potongan kasbon
      let remainingToDeduct = Number(detail.potongan_kasbon || 0)

      if (remainingToDeduct > 0) {
        // Ambil kasbon aktif pelatih tersebut urut FIFO (tanggal terlama lebih dulu)
        const { data: activeLoans } = await supabaseAdmin
          .from('kasbon_pelatih')
          .select('*')
          .eq('pelatih_id', detail.pelatih_id)
          .eq('status', 'belum_lunas')
          .order('tgl_pinjam', { ascending: true })

        for (const loan of (activeLoans || [])) {
          if (remainingToDeduct <= 0) break
          const amountToDeduct = Math.min(remainingToDeduct, Number(loan.sisa_hutang))
          if (amountToDeduct > 0) {
            // Catat di pembayaran_kasbon
            await supabaseAdmin
              .from('pembayaran_kasbon')
              .insert({
                kasbon_id: loan.id,
                pelatih_id: detail.pelatih_id,
                tgl_bayar: new Date().toISOString().split('T')[0],
                nominal: amountToDeduct,
                metode: 'potong_honor',
                payroll_detail_id: detailId,
                catatan: `Potongan payroll periode ${detail.payroll_run_id}`,
              })

            // Update sisa hutang kasbon
            const newSisa = Math.max(0, Number(loan.sisa_hutang) - amountToDeduct)
            await supabaseAdmin
              .from('kasbon_pelatih')
              .update({
                sisa_hutang: newSisa,
                status: newSisa === 0 ? 'lunas' : 'belum_lunas',
              })
              .eq('id', loan.id)

            remainingToDeduct -= amountToDeduct
          }
        }
      }

      // Update status payroll detail
      const payload = {
        status_dibayar: true,
        tgl_dibayar: new Date().toISOString().split('T')[0],
      }

      const { error } = await supabaseAdmin
        .from('payroll_details')
        .update(payload)
        .eq('id', detailId)

      if (error) throw error
    } else {
      // 3. Jika status dibatalkan (rollback)
      const { data: linkedPayments } = await supabaseAdmin
        .from('pembayaran_kasbon')
        .select('*')
        .eq('payroll_detail_id', detailId)

      if (linkedPayments && linkedPayments.length > 0) {
        for (const pay of linkedPayments) {
          const { data: currentLoan } = await supabaseAdmin
            .from('kasbon_pelatih')
            .select('sisa_hutang')
            .eq('id', pay.kasbon_id)
            .single()

          if (currentLoan) {
            const restoredSisa = Number(currentLoan.sisa_hutang) + Number(pay.nominal)
            await supabaseAdmin
              .from('kasbon_pelatih')
              .update({
                sisa_hutang: restoredSisa,
                status: 'belum_lunas',
              })
              .eq('id', pay.kasbon_id)
          }
        }

        // Hapus riwayat pembayaran kasbon terkait payroll ini
        await supabaseAdmin
          .from('pembayaran_kasbon')
          .delete()
          .eq('payroll_detail_id', detailId)
      }

      // Update status payroll detail
      const { error } = await supabaseAdmin
        .from('payroll_details')
        .update({
          status_dibayar: false,
          tgl_dibayar: null,
        })
        .eq('id', detailId)

      if (error) throw error
    }

    return { success: true }
  } catch (err: any) {
    return { success: false, message: err.message || 'Gagal mengubah status bayar' }
  }
}

export async function updatePotonganKasbon(detailId: string, potongan: number) {
  try {
    const { data: detail, error: fetchErr } = await supabaseAdmin
      .from('payroll_details')
      .select('*')
      .eq('id', detailId)
      .single()

    if (fetchErr || !detail) throw new Error('Data payroll tidak ditemukan')
    if (detail.status_dibayar) throw new Error('Tidak dapat mengubah potongan karena honor sudah dibayarkan.')

    if (potongan < 0) throw new Error('Nominal potongan tidak boleh negatif')
    if (potongan > Number(detail.total_payout)) {
      throw new Error(`Nominal potongan tidak boleh melebihi total honor (Maksimal: Rp ${Number(detail.total_payout).toLocaleString('id-ID')})`)
    }

    const honorBersih = Math.max(0, Number(detail.total_payout) - potongan)

    const { error: updateErr } = await supabaseAdmin
      .from('payroll_details')
      .update({
        potongan_kasbon: Math.round(potongan),
        honor_bersih: Math.round(honorBersih),
      })
      .eq('id', detailId)

    if (updateErr) throw updateErr

    return { success: true, message: 'Potongan kasbon berhasil diperbarui!' }
  } catch (err: any) {
    return { success: false, message: err.message || 'Gagal mengubah potongan kasbon' }
  }
}

export async function tambahKasbon(pelatihId: string, nominal: number, tglPinjam: string, keterangan: string) {
  try {
    if (!pelatihId) throw new Error('Pelatih harus dipilih')
    if (nominal <= 0) throw new Error('Nominal pinjaman harus lebih dari 0')
    if (!tglPinjam) throw new Error('Tanggal pinjam harus diisi')
    if (!keterangan) throw new Error('Keterangan kasbon harus diisi')

    // Ambil info nama pelatih
    const { data: coach } = await supabaseAdmin
      .from('pelatih')
      .select('nama')
      .eq('id', pelatihId)
      .single()

    const coachNama = coach?.nama || 'Pelatih'

    // 1. Insert ke kasbon_pelatih
    const { data: newKasbon, error: insertErr } = await supabaseAdmin
      .from('kasbon_pelatih')
      .insert({
        pelatih_id: pelatihId,
        nominal_pinjaman: nominal,
        sisa_hutang: nominal,
        tgl_pinjam: tglPinjam,
        keterangan: keterangan.trim(),
        status: 'belum_lunas',
      })
      .select()
      .single()

    if (insertErr || !newKasbon) {
      throw new Error('Gagal mencatat kasbon: ' + (insertErr?.message || ''))
    }

    // 2. Insert ke keuangan_club (Pengeluaran kas)
    const { error: txErr } = await supabaseAdmin
      .from('keuangan_club')
      .insert({
        tgl: tglPinjam,
        jenis: 'expense',
        kategori: 'Kasbon Pelatih',
        nominal: nominal,
        keterangan: `Kasbon Pelatih: ${coachNama} — ${keterangan.trim()} [Kasbon #${newKasbon.id}]`,
        sumber: 'kasbon',
      })

    if (txErr) {
      console.error('Gagal sinkron kas keluar:', txErr)
      await supabaseAdmin.from('kasbon_pelatih').delete().eq('id', newKasbon.id)
      throw new Error('Gagal mencatat pengeluaran kas: ' + txErr.message)
    }

    return { success: true, message: 'Kasbon berhasil dicatat dan pengeluaran kas telah disinkronkan!' }
  } catch (err: any) {
    return { success: false, message: err.message || 'Gagal menambahkan kasbon' }
  }
}

export async function hapusKasbon(kasbonId: string) {
  try {
    // 1. Cek riwayat pembayaran
    const { count, error: countErr } = await supabaseAdmin
      .from('pembayaran_kasbon')
      .select('id', { count: 'exact', head: true })
      .eq('kasbon_id', kasbonId)

    if (countErr) throw countErr
    if ((count || 0) > 0) {
      throw new Error('Kasbon tidak dapat dihapus karena sudah memiliki riwayat pembayaran/cicilan.')
    }

    // 2. Hapus catatan di keuangan_club
    await supabaseAdmin
      .from('keuangan_club')
      .delete()
      .like('keterangan', `%[Kasbon #${kasbonId}]%`)

    // 3. Hapus data kasbon
    const { error: delErr } = await supabaseAdmin
      .from('kasbon_pelatih')
      .delete()
      .eq('id', kasbonId)

    if (delErr) throw delErr

    return { success: true, message: 'Kasbon berhasil dihapus dan pengeluaran kas klub dibatalkan.' }
  } catch (err: any) {
    return { success: false, message: err.message || 'Gagal menghapus kasbon' }
  }
}

export async function catatPembayaranTunai(kasbonId: string, nominal: number, tglBayar: string, catatan?: string) {
  try {
    if (nominal <= 0) throw new Error('Nominal pembayaran harus lebih dari 0')
    if (!tglBayar) throw new Error('Tanggal bayar harus diisi')

    // 1. Ambil data kasbon
    const { data: loan, error: loanErr } = await supabaseAdmin
      .from('kasbon_pelatih')
      .select('*, pelatih:pelatih_id(nama)')
      .eq('id', kasbonId)
      .single()

    if (loanErr || !loan) throw new Error('Data kasbon tidak ditemukan')

    if (nominal > Number(loan.sisa_hutang)) {
      throw new Error(`Nominal pembayaran melebihi sisa hutang (Maksimal: Rp ${Number(loan.sisa_hutang).toLocaleString('id-ID')})`)
    }

    const coachNama = (loan.pelatih as any)?.nama || 'Pelatih'

    // 2. Insert ke pembayaran_kasbon
    const { data: payment, error: payErr } = await supabaseAdmin
      .from('pembayaran_kasbon')
      .insert({
        kasbon_id: kasbonId,
        pelatih_id: loan.pelatih_id,
        tgl_bayar: tglBayar,
        nominal: nominal,
        metode: 'tunai',
        catatan: catatan?.trim() || 'Pembayaran tunai',
      })
      .select()
      .single()

    if (payErr || !payment) throw new Error('Gagal mencatat pembayaran: ' + (payErr?.message || ''))

    // 3. Update sisa hutang
    const newSisa = Math.max(0, Number(loan.sisa_hutang) - nominal)
    const { error: updateErr } = await supabaseAdmin
      .from('kasbon_pelatih')
      .update({
        sisa_hutang: newSisa,
        status: newSisa === 0 ? 'lunas' : 'belum_lunas',
      })
      .eq('id', kasbonId)

    if (updateErr) throw updateErr

    // 4. Catat pemasukan ke keuangan_club
    const { error: txErr } = await supabaseAdmin
      .from('keuangan_club')
      .insert({
        tgl: tglBayar,
        jenis: 'income',
        kategori: 'Pelunasan Kasbon',
        nominal: nominal,
        keterangan: `Pelunasan Kasbon Tunai: ${coachNama} — ${catatan?.trim() || 'Cicilan manual'} [BayarKasbon #${payment.id}]`,
        sumber: 'kasbon',
      })

    if (txErr) {
      console.error('Gagal mencatat mutasi pemasukan:', txErr)
    }

    return { success: true, message: 'Pembayaran tunai berhasil dicatat dan kas masuk telah disinkronkan!' }
  } catch (err: any) {
    return { success: false, message: err.message || 'Gagal memproses pembayaran' }
  }
}
