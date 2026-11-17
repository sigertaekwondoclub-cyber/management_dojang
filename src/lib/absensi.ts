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

