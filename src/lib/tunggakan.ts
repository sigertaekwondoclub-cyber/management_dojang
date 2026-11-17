export const BULAN_NAMES = [
  '',
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember'
]

export function formatRupiah(n: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(n).replace(/\u00a0/g, ' ')
}

export interface ItemTunggakanBulan {
  bulan: number
  tahun: number
  namaBulan: string
  nominal: number
  status: 'belum_bayar' | 'ditolak'
  iuranId?: string
}

export interface SiswaRekapTagihanExtended {
  id: string
  nama: string
  no_hp_ortu: string
  programKelas: string
  tglGabung: string
  hadir: number
  izin: number
  sakit: number
  alpha: number
  totalSesi: number
  persen: number
  statusIuran: string
  nominalIuran: number
  iuranId?: string
  riwayat: {
    id: string
    tgl: string
    kelas: string
    status_hadir: 'hadir' | 'izin' | 'sakit' | 'alpha'
    pelatih_nama: string
  }[]
  daftarTunggakan: ItemTunggakanBulan[]
  totalBulanMenunggak: number
  totalNominalTunggakan: number
  totalHadirTunggakan: number
  totalSesiTunggakan: number
}

export interface ClubSettingsInfo {
  nama_club: string | null
  rekening_bank: string | null
  rekening_nomor: string | null
  rekening_atas_nama: string | null
}

export function hitungTunggakanSiswa(params: {
  siswa: {
    id: string
    nama: string
    no_hp_ortu?: string | null
    tgl_gabung?: string | null
    program_kelas?: { nama_program?: string; biaya_bulanan?: number } | null
  }
  iuranRows: {
    id: string
    siswa_id: string
    bulan: number
    tahun: number
    nominal: number
    status_bayar: string
  }[]
  absensiRows: {
    id: string
    siswa_id: string
    tgl: string
    kelas: string
    status_hadir: string
    pelatih_nama?: string
  }[]
  filterBulan: number
  filterTahun: number
}): SiswaRekapTagihanExtended {
  const { siswa, iuranRows, absensiRows, filterBulan, filterTahun } = params
  const defaultBiaya = siswa.program_kelas?.biaya_bulanan || 100000
  const programNama = siswa.program_kelas?.nama_program || 'Umum'

  // 1. Tentukan Bulan Awal berdasarkan tgl_gabung (maksimal 24 bulan ke belakang)
  const maxLookbackMonths = 24
  const targetDate = new Date(filterTahun, filterBulan - 1, 1)

  let startDate: Date
  if (siswa.tgl_gabung) {
    const parts = siswa.tgl_gabung.split('-')
    if (parts.length >= 2 && !isNaN(parseInt(parts[0], 10)) && !isNaN(parseInt(parts[1], 10))) {
      startDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, 1)
    } else {
      const rawJoin = new Date(siswa.tgl_gabung)
      if (!isNaN(rawJoin.getTime())) {
        startDate = new Date(rawJoin.getFullYear(), rawJoin.getMonth(), 1)
      } else {
        startDate = new Date(filterTahun, filterBulan - 1, 1)
      }
    }
  } else {
    startDate = new Date(filterTahun, filterBulan - 1, 1)
  }

  // Batasi agar tidak lebih awal dari targetDate - maxLookbackMonths
  const earliestAllowed = new Date(filterTahun, filterBulan - 1 - maxLookbackMonths, 1)
  if (startDate < earliestAllowed) {
    startDate = earliestAllowed
  }

  // Jika startDate lebih besar dari targetDate (siswa gabung di masa depan), samakan dengan targetDate
  if (startDate > targetDate) {
    startDate = targetDate
  }

  // 2. Loop setiap bulan dari startDate sampai targetDate
  const daftarTunggakan: ItemTunggakanBulan[] = []
  const currentIter = new Date(startDate)

  // Map iuran siswa
  const siswaIuranMap = new Map<string, (typeof iuranRows)[0]>()
  for (const iur of iuranRows) {
    if (iur.siswa_id === siswa.id) {
      siswaIuranMap.set(`${iur.tahun}-${iur.bulan}`, iur)
    }
  }

  let statusPeriodeIni = 'belum_bayar'
  let nominalPeriodeIni = defaultBiaya
  let iuranIdPeriodeIni: string | undefined = undefined

  while (currentIter <= targetDate) {
    const b = currentIter.getMonth() + 1
    const y = currentIter.getFullYear()
    const key = `${y}-${b}`
    const existingIur = siswaIuranMap.get(key)

    const isCurrentPeriod = b === filterBulan && y === filterTahun

    if (existingIur) {
      if (isCurrentPeriod) {
        statusPeriodeIni = existingIur.status_bayar
        nominalPeriodeIni = Number(existingIur.nominal) || defaultBiaya
        iuranIdPeriodeIni = existingIur.id
      }

      if (existingIur.status_bayar === 'belum_bayar' || existingIur.status_bayar === 'ditolak') {
        daftarTunggakan.push({
          bulan: b,
          tahun: y,
          namaBulan: BULAN_NAMES[b],
          nominal: Number(existingIur.nominal) || defaultBiaya,
          status: existingIur.status_bayar as 'belum_bayar' | 'ditolak',
          iuranId: existingIur.id
        })
      }
    } else {
      // Tidak ada data iuran di DB -> otomatis dihitung menunggak
      if (isCurrentPeriod) {
        statusPeriodeIni = 'belum_bayar'
        nominalPeriodeIni = defaultBiaya
      }

      daftarTunggakan.push({
        bulan: b,
        tahun: y,
        namaBulan: BULAN_NAMES[b],
        nominal: defaultBiaya,
        status: 'belum_bayar'
      })
    }

    // Maju ke bulan berikutnya
    currentIter.setMonth(currentIter.getMonth() + 1)
  }

  const totalBulanMenunggak = daftarTunggakan.length
  const totalNominalTunggakan = daftarTunggakan.reduce((acc, curr) => acc + curr.nominal, 0)

  // Helper to parse year-month from string
  const parseYM = (tgl: string) => {
    const parts = tgl.split('-')
    if (parts.length >= 2) {
      const y = parseInt(parts[0], 10)
      const m = parseInt(parts[1], 10)
      if (!isNaN(y) && !isNaN(m)) return { year: y, month: m }
    }
    const d = new Date(tgl)
    return { year: d.getFullYear(), month: d.getMonth() + 1 }
  }

  // 3. Hitung Absensi Periode Terpilih
  const siswaAbsensi = absensiRows.filter(a => a.siswa_id === siswa.id)
  const currentMonthAbsensi = siswaAbsensi.filter(a => {
    const ym = parseYM(a.tgl)
    return ym.month === filterBulan && ym.year === filterTahun
  })

  const hadir = currentMonthAbsensi.filter(a => a.status_hadir === 'hadir').length
  const izin = currentMonthAbsensi.filter(a => a.status_hadir === 'izin').length
  const sakit = currentMonthAbsensi.filter(a => a.status_hadir === 'sakit').length
  const alpha = currentMonthAbsensi.filter(a => a.status_hadir === 'alpha').length
  const totalSesi = currentMonthAbsensi.length
  const persen = totalSesi > 0 ? Math.round((hadir / totalSesi) * 100) : 0

  // 4. Hitung Absensi Kumulatif Selama Periode Menunggak
  const unpaidYearMonthSet = new Set(daftarTunggakan.map(t => `${t.tahun}-${t.bulan}`))
  const unpaidAbsensi = siswaAbsensi.filter(a => {
    const ym = parseYM(a.tgl)
    return unpaidYearMonthSet.has(`${ym.year}-${ym.month}`)
  })
  const totalHadirTunggakan = unpaidAbsensi.filter(a => a.status_hadir === 'hadir').length
  const totalSesiTunggakan = unpaidAbsensi.length

  return {
    id: siswa.id,
    nama: siswa.nama,
    no_hp_ortu: siswa.no_hp_ortu || '',
    programKelas: programNama,
    tglGabung: siswa.tgl_gabung || '',
    hadir,
    izin,
    sakit,
    alpha,
    totalSesi,
    persen,
    statusIuran: statusPeriodeIni,
    nominalIuran: nominalPeriodeIni,
    iuranId: iuranIdPeriodeIni,
    riwayat: currentMonthAbsensi.map(a => ({
      id: a.id,
      tgl: a.tgl,
      kelas: a.kelas,
      status_hadir: a.status_hadir as 'hadir' | 'izin' | 'sakit' | 'alpha',
      pelatih_nama: a.pelatih_nama || 'Pelatih'
    })),
    daftarTunggakan,
    totalBulanMenunggak,
    totalNominalTunggakan,
    totalHadirTunggakan,
    totalSesiTunggakan
  }
}

export function generatePesanTagihan(
  siswa: SiswaRekapTagihanExtended,
  clubSettings: ClubSettingsInfo | null,
  filterBulan: number,
  filterTahun: number
): string {
  const bul = BULAN_NAMES[filterBulan]
  const clubName = clubSettings?.nama_club || 'Siger Taekwondo Club'
  const bank = clubSettings?.rekening_bank || 'BCA / BRI / Mandiri'
  const noRek = clubSettings?.rekening_nomor || '-'
  const an = clubSettings?.rekening_atas_nama || clubName

  let rincianTunggakanText = ''
  if (siswa.totalBulanMenunggak > 1) {
    const itemLines = siswa.daftarTunggakan.map(item => {
      const isCurrent = item.bulan === filterBulan && item.tahun === filterTahun
      const label = `${item.namaBulan} ${item.tahun}`
      return `  - ${label}: ${formatRupiah(item.nominal)}${isCurrent ? ' (Bulan Berjalan)' : ''}`
    }).join('\n')

    rincianTunggakanText =
      `💰 *RINCIAN TAGIHAN IURAN*:\n` +
      `• Jumlah Tunggakan: *${siswa.totalBulanMenunggak} Bulan*\n` +
      `• Rincian Periode:\n${itemLines}\n` +
      `----------------------------------\n` +
      `💵 *TOTAL TAGIHAN*: *${formatRupiah(siswa.totalNominalTunggakan)}*\n`
  } else {
    const nominal = siswa.totalNominalTunggakan > 0 ? siswa.totalNominalTunggakan : siswa.nominalIuran
    rincianTunggakanText =
      `💰 *RINCIAN TAGIHAN IURAN*:\n` +
      `• Tagihan ${bul} ${filterTahun}: *${formatRupiah(nominal)}*\n`
  }

  let kehadiranKumulatifText = ''
  if (siswa.totalBulanMenunggak > 1 && siswa.totalSesiTunggakan > 0) {
    kehadiranKumulatifText = `\n• Kehadiran Selama Periode Menunggak: *${siswa.totalHadirTunggakan}x latihan*`
  }

  return (
    `🥋 *PEMBERITAHUAN TAGIHAN IURAN BULANAN*\n*${clubName.toUpperCase()}*\n\n` +
    `Kepada Yth. Orang Tua / Wali Siswa\n` +
    `👤 *Nama Siswa*: ${siswa.nama}\n` +
    `🥋 *Program*: Kelas ${siswa.programKelas}\n` +
    `📅 *Periode Tagihan*: ${bul} ${filterTahun}\n\n` +
    `${rincianTunggakanText}` +
    `📌 *Status*: ⏳ Belum Lunas\n\n` +
    `📊 *REKAP KEHADIRAN LATIHAN*:\n` +
    `• Bulan Ini (${bul} ${filterTahun}): *${siswa.hadir}x hadir* dari ${siswa.totalSesi} sesi (${siswa.persen}%)\n` +
    `  (Izin: ${siswa.izin}x | Sakit: ${siswa.sakit}x | Alpha: ${siswa.alpha}x)` +
    `${kehadiranKumulatifText}\n\n` +
    `💳 *Rekening Pembayaran*:\n` +
    `• Bank: ${bank}\n` +
    `• No. Rekening: *${noRek}*\n` +
    `• Atas Nama: ${an}\n\n` +
    `_Mohon untuk melakukan konfirmasi & upload bukti transfer melalui portal wali murid atau kirimkan balasan ke pesan ini setelah melakukan pembayaran._\n\n` +
    `Terima kasih atas kerja sama dan dukungannya. 🙏🥋`
  )
}

export function generatePesanRekapLengkap(
  siswa: SiswaRekapTagihanExtended,
  clubSettings: ClubSettingsInfo | null,
  filterBulan: number,
  filterTahun: number
): string {
  const bul = BULAN_NAMES[filterBulan]
  const clubName = clubSettings?.nama_club || 'Siger Taekwondo Club'
  const statusLabel: Record<string, string> = {
    lunas: '✅ LUNAS',
    belum_bayar: '⏳ BELUM DIBAYAR',
    menunggu_verifikasi: '🔍 MENUNGGU VERIFIKASI ADMIN',
    ditolak: '❌ DITOLAK (Silakan Upload Ulang)'
  }

  let infoTunggakan = ''
  if (siswa.totalBulanMenunggak > 1) {
    infoTunggakan = `• Total Tunggakan: *${siswa.totalBulanMenunggak} Bulan* (${formatRupiah(siswa.totalNominalTunggakan)})\n`
  }

  return (
    `📊 *LAPORAN BULANAN SISWA*\n*${clubName.toUpperCase()}*\n\n` +
    `👤 *Nama Siswa*: ${siswa.nama}\n` +
    `🥋 *Program*: ${siswa.programKelas}\n` +
    `📅 *Periode*: ${bul} ${filterTahun}\n\n` +
    `🥋 *REKAP KEHADIRAN*:\n` +
    `• Total Kehadiran: *${siswa.hadir}x* dari ${siswa.totalSesi} sesi (${siswa.persen}%)\n` +
    `• Izin: ${siswa.izin}x | Sakit: ${siswa.sakit}x | Alpha: ${siswa.alpha}x\n\n` +
    `💰 *STATUS IURAN BULANAN*:\n` +
    `• Tagihan Periode Ini: *${formatRupiah(siswa.nominalIuran)}*\n` +
    `• Status: *${statusLabel[siswa.statusIuran] || siswa.statusIuran}*\n` +
    `${infoTunggakan}\n` +
    `Tetap semangat berlatih! 🥋🔥\n` +
    `_${clubName}_`
  )
}

export function generateTeksSalinSemuaBelumBayar(
  listBelum: SiswaRekapTagihanExtended[],
  filterBulan: number,
  filterTahun: number
): string {
  const bul = BULAN_NAMES[filterBulan]
  const totalNominal = listBelum.reduce((acc, curr) => acc + curr.totalNominalTunggakan, 0)

  let text =
    `📋 *DAFTAR SISWA BELUM BAYAR IURAN*\n` +
    `📅 Periode: ${bul} ${filterTahun}\n` +
    `👥 Total: ${listBelum.length} Siswa\n` +
    `💰 Total Tagihan Akumulasi: ${formatRupiah(totalNominal)}\n\n`

  listBelum.forEach((s, idx) => {
    const detailBulan = s.totalBulanMenunggak > 1
      ? `${s.totalBulanMenunggak} Bulan (${s.daftarTunggakan.map(d => d.namaBulan.slice(0, 3)).join(', ')})`
      : '1 Bulan'
    text += `${idx + 1}. *${s.nama}* (${s.programKelas})\n` +
      `   • Tunggakan: ${detailBulan} - ${formatRupiah(s.totalNominalTunggakan)}\n` +
      `   • Kehadiran Bulan Ini: ${s.hadir}/${s.totalSesi} sesi | WA: ${s.no_hp_ortu || '-'}\n\n`
  })

  return text
}
