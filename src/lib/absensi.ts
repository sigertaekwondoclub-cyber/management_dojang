/**
 * Helper to get the program name from a student record,
 * handling both object and single-element array shapes from Supabase joins.
 */
export function getStudentProgramName(siswa: {
  program_kelas?: { nama_program?: string } | { nama_program?: string }[] | null
}): string {
  if (!siswa?.program_kelas) return ''
  if (Array.isArray(siswa.program_kelas)) {
    return siswa.program_kelas[0]?.nama_program || ''
  }
  return siswa.program_kelas.nama_program || ''
}

/**
 * Checks if a student is eligible for a specific training class:
 * - 'Umum': all active students attend regular training (including Prestasi students who attend 1 regular session).
 * - 'Pomsae': only students whose program is Prestasi AND fokus_prestasi === 'pomsae'.
 * - 'Kyurugi': only students whose program is Prestasi AND fokus_prestasi === 'kyurugi'.
 */
export function isSiswaEligibleForKelas(
  siswa: {
    fokus_prestasi?: string | null
    program_kelas?: { nama_program?: string } | { nama_program?: string }[] | null
  },
  kelas: string
): boolean {
  if (kelas === 'Umum') return true
  const progName = getStudentProgramName(siswa).toLowerCase()
  const isPrestasi = progName.includes('prestasi')
  if (kelas === 'Pomsae') {
    return isPrestasi && siswa.fokus_prestasi === 'pomsae'
  }
  if (kelas === 'Kyurugi') {
    return isPrestasi && siswa.fokus_prestasi === 'kyurugi'
  }
  return true
}

/**
 * Filters a list of students for a specific training session/class.
 */
export function filterSiswaByKelas<T extends {
  fokus_prestasi?: string | null
  program_kelas?: { nama_program?: string } | { nama_program?: string }[] | null
}>(
  siswaList: T[],
  kelas: string
): T[] {
  return siswaList.filter(s => isSiswaEligibleForKelas(s, kelas))
}

/**
 * Sanitizes fokus_prestasi when saving a student:
 * If program is NOT Prestasi, fokus_prestasi must always be null.
 */
export function sanitizeFokusPrestasi(
  programNama: string | undefined | null,
  fokusPrestasi: string | undefined | null
): 'pomsae' | 'kyurugi' | null {
  if (!programNama) return null
  const isPrestasi = programNama.toLowerCase().includes('prestasi')
  if (!isPrestasi) return null
  if (fokusPrestasi === 'pomsae' || fokusPrestasi === 'kyurugi') {
    return fokusPrestasi
  }
  return null
}

export interface RekapKehadiranItem {
  nama: string
  programKelas: string
  hadir: number
  izin: number
  sakit: number
  alpha: number
  totalSesi: number
  persen: number
}

export interface GenerateRekapKehadiranParams {
  siswaList: RekapKehadiranItem[]
  bulanNama: string
  tahun: number | string
  labelKelas: string
  totalSesiDojang: number
  catatanTambahan?: string
}

export function generatePesanRekapKehadiranGrup(params: GenerateRekapKehadiranParams): string {
  const { siswaList, bulanNama, tahun, labelKelas, totalSesiDojang, catatanTambahan } = params

  // Urutkan siswa: persen tertinggi (descending), lalu nama (ascending)
  const sorted = [...siswaList].sort((a, b) => {
    if (b.persen !== a.persen) return b.persen - a.persen
    return a.nama.localeCompare(b.nama)
  })

  // Hitung ringkasan
  const totalPersen = sorted.reduce((acc, curr) => acc + curr.persen, 0)
  const avgPersen = sorted.length > 0 ? Math.round(totalPersen / sorted.length) : 0
  const count100 = sorted.filter(s => s.persen === 100).length

  const lines: string[] = []
  lines.push('🥋 *REKAP KEHADIRAN SISWA*')
  lines.push('*SIGER TAEKWONDO CLUB*')
  lines.push(`📅 *Periode*: ${bulanNama} ${tahun}`)
  lines.push(`🏷️ *Program*: ${labelKelas}`)
  lines.push(`📊 *Total Sesi*: ${totalSesiDojang} Sesi Latihan`)
  lines.push('')
  lines.push('📋 *Rincian Kehadiran Siswa*:')

  if (sorted.length === 0) {
    lines.push('_Belum ada data kehadiran untuk periode ini._')
  } else {
    sorted.forEach((s, idx) => {
      let badge = '⚠️ Perlu Ditingkatkan'
      if (s.persen >= 80) badge = '🌟 Sangat Baik'
      else if (s.persen >= 60) badge = '👍 Cukup'

      lines.push(`${idx + 1}. *${s.nama}* (${s.programKelas})`)
      lines.push(`   • Hadir: ${s.hadir} | Izin: ${s.izin} | Sakit: ${s.sakit} | Alpha: ${s.alpha}`)
      lines.push(`   • Kehadiran: ${s.persen}% (${badge})`)
    })
  }

  lines.push('')
  lines.push('📈 *Ringkasan Dojang*:')
  lines.push(`• Rata-rata Kehadiran: ${avgPersen}%`)
  lines.push(`• Kehadiran Penuh (100%): ${count100} Siswa`)

  if (catatanTambahan && catatanTambahan.trim()) {
    lines.push('')
    lines.push('📢 *Catatan & Pengumuman*:')
    lines.push(catatanTambahan.trim())
  }

  lines.push('')
  lines.push('Terima kasih atas bimbingan dan dukungan Ayah/Bunda di rumah. Tetap semangat berlatih! 🥋🔥')

  return lines.join('\n')
}


