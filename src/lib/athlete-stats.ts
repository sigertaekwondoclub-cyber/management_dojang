import type { SixAttributes, RawTestData, LevelUpMission, PenilaianAtlet } from './types'

export type RawTestKey =
  | 'pushup'
  | 'pushup_count'
  | 'str'
  | 'skor_str'
  | 'kicking_speed'
  | 'kicking_speed_count'
  | 'agi'
  | 'skor_agi'
  | 'split'
  | 'split_cm'
  | 'flx'
  | 'skor_flx'
  | 'skipping'
  | 'skipping_sec'
  | 'sta'
  | 'skor_sta'
  | 'technique'
  | 'technique_stars'
  | 'tec'
  | 'skor_tec'
  | 'discipline'
  | 'persen_kehadiran'
  | 'dis'
  | 'skor_dis'

export interface AttributeMetadata {
  key: string
  label: string
  fullLabel: string
  icon: string
  description: string
  color: string
}

export const ATTRIBUTE_CONFIG: Record<keyof SixAttributes, AttributeMetadata> = {
  skor_str: {
    key: 'STR',
    label: 'Strength',
    fullLabel: 'Kekuatan Otot',
    icon: '💥',
    description: 'Kekuatan otot & daya ledak tendangan',
    color: '#EF4444',
  },
  skor_agi: {
    key: 'AGI',
    label: 'Agility',
    fullLabel: 'Kelincahan & Speed',
    icon: '⚡',
    description: 'Kecepatan reaksi & langkah kaki',
    color: '#F59E0B',
  },
  skor_flx: {
    key: 'FLX',
    label: 'Flexibility',
    fullLabel: 'Kelenturan',
    icon: '🤸',
    description: 'Jangkauan split & kelenturan sendi',
    color: '#10B981',
  },
  skor_sta: {
    key: 'STA',
    label: 'Stamina',
    fullLabel: 'Daya Tahan Fisik',
    icon: '🫁',
    description: 'Kapasitas kardio & nafas ronde penuh',
    color: '#06B6D4',
  },
  skor_tec: {
    key: 'TEC',
    label: 'Technique',
    fullLabel: 'Teknik & Form',
    icon: '🥋',
    description: 'Kerapihan kuda-kuda & snap tendangan',
    color: '#8B5CF6',
  },
  skor_dis: {
    key: 'DIS',
    label: 'Discipline',
    fullLabel: 'Kedisiplinan',
    icon: '⭐',
    description: 'Presensi latihan & etika dojang',
    color: '#3B82F6',
  },
}

export const ARCHETYPES = {
  ALL_ROUNDER: 'All-Rounder Fighter',
  SPEED_STRIKER: '⚡ Speed Striker',
  POWER_KICKER: '💥 Power Kicker',
  FLEX_MASTER: '🤸 Flex Master',
  IRON_ENGINE: '🫁 Iron Engine',
  POOMSAE_SPECIALIST: '🥋 Poomsae Specialist',
  DISCIPLINED_GUARDIAN: '⭐ Disciplined Guardian',
} as const

/**
 * Batasi skor dalam rentang 0 - 100 integer.
 */
export function clampScore(score: number): number {
  if (isNaN(score) || score === null || score === undefined) return 0
  return Math.max(0, Math.min(100, Math.round(score)))
}

/**
 * Hitung usia akurat berdasarkan ISO date string tanggal lahir.
 * Kebal terhadap pergeseran timezone UTC dengan parsing tokenisasi YYYY-MM-DD.
 * Default ke 0 jika tanggal lahir kosong/invalid (kategori anak-anak).
 */
export function calculateAge(tglLahir?: string | null, referenceDate: Date = new Date()): number {
  if (!tglLahir || typeof tglLahir !== 'string') return 0

  const datePart = tglLahir.split('T')[0]
  const parts = datePart.split('-').map(Number)
  if (parts.length !== 3 || parts.some((n) => isNaN(n))) return 0

  const [birthYear, birthMonth, birthDay] = parts
  if (birthYear <= 1900 || birthMonth < 1 || birthMonth > 12 || birthDay < 1 || birthDay > 31) {
    return 0
  }

  const refYear = referenceDate.getFullYear()
  const refMonth = referenceDate.getMonth() + 1
  const refDay = referenceDate.getDate()

  let age = refYear - birthYear
  const monthDiff = refMonth - birthMonth

  if (monthDiff < 0 || (monthDiff === 0 && refDay < birthDay)) {
    age--
  }

  return Math.max(0, age)
}

/**
 * Periksa apakah siswa masuk kategori anak-anak (< 12 tahun).
 */
export function isChildCategory(age: number): boolean {
  return age < 12
}

/**
 * Hitung skor disiplin dari presensi dan nilai sikap pelatih.
 * Jika total sesi = 0 (misal siswa baru), nilai disiplin langsung diambil dari nilai sikap.
 */
export function calculateDisciplineScore(
  presensiHadir: number,
  totalSesi: number,
  nilaiSikap: number = 85
): number {
  const safeAttitude = clampScore(nilaiSikap)
  if (!totalSesi || totalSesi <= 0) {
    return safeAttitude
  }

  const safeHadir = Math.max(0, Math.min(totalSesi, presensiHadir))
  const attendancePercent = (safeHadir / totalSesi) * 100
  return clampScore(attendancePercent * 0.5 + safeAttitude * 0.5)
}

/**
 * Konversi hasil tes lapangan mentah menjadi skor 0-100 terstandarisasi.
 * Mempertimbangkan kategori usia (< 12 tahun vs >= 12 tahun).
 */
export function convertRawTestToScore(
  testKey: RawTestKey | string,
  rawVal: number,
  age: number = 0,
  extra?: { attitudeScore?: number }
): number {
  const isChild = age < 12
  const val = isNaN(rawVal) ? 0 : rawVal

  switch (testKey) {
    case 'pushup':
    case 'pushup_count':
    case 'str':
    case 'skor_str': {
      if (isChild) {
        if (val < 10) return 60
        if (val <= 18) return 72
        if (val <= 28) return 82
        return 95
      } else {
        if (val < 15) return 60
        if (val <= 25) return 72
        if (val <= 38) return 82
        return 95
      }
    }

    case 'kicking_speed':
    case 'kicking_speed_count':
    case 'agi':
    case 'skor_agi': {
      if (isChild) {
        if (val < 22) return 60
        if (val <= 30) return 72
        if (val <= 40) return 82
        return 95
      } else {
        if (val < 25) return 60
        if (val <= 34) return 72
        if (val <= 44) return 82
        return 95
      }
    }

    case 'split':
    case 'split_cm':
    case 'flx':
    case 'skor_flx': {
      if (val <= 0) return 98
      if (val <= 5) return 90
      if (val <= 10) return 80
      if (val <= 20) return 70
      return 60
    }

    case 'skipping':
    case 'skipping_sec':
    case 'sta':
    case 'skor_sta': {
      if (val < 60) return 60
      if (val <= 90) return 72
      if (val <= 120) return 82
      return 95
    }

    case 'technique':
    case 'technique_stars':
    case 'tec':
    case 'skor_tec': {
      if (val <= 1) return 55
      if (val <= 2) return 65
      if (val <= 3) return 75
      if (val <= 4) return 85
      return 95
    }

    case 'discipline':
    case 'persen_kehadiran':
    case 'dis':
    case 'skor_dis': {
      const attitude = extra?.attitudeScore ?? 85
      const attendance = Math.max(0, Math.min(100, val))
      return clampScore(attendance * 0.5 + attitude * 0.5)
    }

    default:
      return clampScore(val)
  }
}

/**
 * Hitung Overall Rating (OVR) dari 6 atribut.
 */
export function calculateOVR(scores: SixAttributes): number {
  const sum =
    clampScore(scores.skor_str) +
    clampScore(scores.skor_agi) +
    clampScore(scores.skor_flx) +
    clampScore(scores.skor_sta) +
    clampScore(scores.skor_tec) +
    clampScore(scores.skor_dis)

  return clampScore(sum / 6.0)
}

/**
 * Tentukan gelar/archetype atlet berdasarkan 6 atribut.
 * - Jika selisih nilai tertinggi dan terendah <= 7: "All-Rounder Fighter"
 * - Jika tidak, archetype ditentukan oleh atribut dengan nilai tertinggi.
 */
export function determineArchetype(scores: SixAttributes): string {
  const list = [
    { key: 'agi', val: clampScore(scores.skor_agi), title: ARCHETYPES.SPEED_STRIKER },
    { key: 'str', val: clampScore(scores.skor_str), title: ARCHETYPES.POWER_KICKER },
    { key: 'flx', val: clampScore(scores.skor_flx), title: ARCHETYPES.FLEX_MASTER },
    { key: 'sta', val: clampScore(scores.skor_sta), title: ARCHETYPES.IRON_ENGINE },
    { key: 'tec', val: clampScore(scores.skor_tec), title: ARCHETYPES.POOMSAE_SPECIALIST },
    { key: 'dis', val: clampScore(scores.skor_dis), title: ARCHETYPES.DISCIPLINED_GUARDIAN },
  ]

  const values = list.map((item) => item.val)
  const max = Math.max(...values)
  const min = Math.min(...values)

  if (max - min <= 7) {
    return ARCHETYPES.ALL_ROUNDER
  }

  const top = list.find((item) => item.val === max)
  return top ? top.title : ARCHETYPES.ALL_ROUNDER
}

/**
 * Data referensi misi level up untuk latihan mandiri di rumah.
 */
const LEVEL_UP_CATALOG: Record<
  keyof SixAttributes,
  Omit<LevelUpMission, 'attribute' | 'attributeLabel' | 'score'>
> = {
  skor_str: {
    id: 'mission-str',
    title: 'Penguatan Daya Ledak Otot',
    target: 'Push-up 15-20 kali & Sit-up 20 kali (3 set) per hari',
    description:
      'Latih kekuatan otot inti tubuh dan lengan agar hentakan tendangan memiliki daya tembus maksimal.',
    icon: '💥',
  },
  skor_agi: {
    id: 'mission-agi',
    title: 'Kecepatan Reaksi & Langkah Kaki',
    target: 'Lari zig-zag (shuttle run) 10x & skipping cepat 30 detik (3 set)',
    description:
      'Tingkatkan kelincahan gerak kaki (footwork) dan transisi langkah untuk mengecoh lawan saat sparring.',
    icon: '⚡',
  },
  skor_flx: {
    id: 'mission-flx',
    title: 'Peregangan Kelenturan Paha & Pinggul',
    target: 'Peregangan butterfly & split paha 10 menit sebelum tidur',
    description:
      'Buka kelenturan otot hamstring dan pinggul agar tendangan kepala (Dollyo & Yeop Chagi) lebih ringan dan tinggi.',
    icon: '🤸',
  },
  skor_sta: {
    id: 'mission-sta',
    title: 'Kardio Daya Tahan Nafas',
    target: 'Jumping jack 2 menit nonstop & skipping ritme cepat 3 ronde',
    description:
      'Bangun kapasitas aerobik agar fisik tetap bertenaga penuh dan tidak kehabisan nafas di ronde penentuan.',
    icon: '🫁',
  },
  skor_tec: {
    id: 'mission-tec',
    title: 'Presisi Kuda-Kuda & Snap Tendangan',
    target: 'Latihan tendangan di depan cermin 20x per kaki, tahan posisi 3 detik',
    description:
      'Perbaiki form kuda-kuda (Ap Koobi/Dwit Koobi) dan snap lutut agar jurus poomsae tajam dan stabil.',
    icon: '🥋',
  },
  skor_dis: {
    id: 'mission-dis',
    title: 'Konsistensi Hadir & Etika Dojang',
    target: 'Hadir 15 menit sebelum latihan & ikuti seluruh sesi jadwal latihan bulan ini',
    description:
      'Tingkatkan fokus dan kedisiplinan diri saat menerima instruksi pelatih demi perkembangan teknik yang konsisten.',
    icon: '⭐',
  },
}

/**
 * Generate 1-2 misi latihan mandiri di rumah berdasarkan atribut dengan skor terendah.
 */
export function generateLevelUpMissions(scores: SixAttributes): LevelUpMission[] {
  const attributeKeys: (keyof SixAttributes)[] = [
    'skor_str',
    'skor_agi',
    'skor_flx',
    'skor_sta',
    'skor_tec',
    'skor_dis',
  ]

  const sorted = attributeKeys
    .map((attr) => ({
      attr,
      score: clampScore(scores[attr]),
    }))
    .sort((a, b) => a.score - b.score)

  // Ambil 2 atribut terendah
  const selectedAttrs = sorted.slice(0, 2)

  return selectedAttrs.map((item) => {
    const config = ATTRIBUTE_CONFIG[item.attr]
    const template = LEVEL_UP_CATALOG[item.attr]
    return {
      id: template.id,
      attribute: item.attr,
      attributeLabel: config.key,
      score: item.score,
      title: template.title,
      target: template.target,
      description: template.description,
      icon: template.icon,
    }
  })
}

/**
 * Fallback mapper jika data lama membuka raport tanpa 6 atribut.
 * Memetakan skor_fisik, skor_kyorugi, skor_poomsae, skor_disiplin ke 6 atribut.
 */
export function mapLegacyPenilaianToStats(
  penilaian?: Partial<PenilaianAtlet> | null
): SixAttributes {
  if (!penilaian) {
    return {
      skor_str: 75,
      skor_agi: 75,
      skor_flx: 75,
      skor_sta: 75,
      skor_tec: 75,
      skor_dis: 85,
    }
  }

  // Jika kolom 6 atribut baru sudah terisi secara valid, gunakan nilai tersebut
  if (
    typeof penilaian.skor_str === 'number' &&
    !isNaN(penilaian.skor_str) &&
    typeof penilaian.skor_agi === 'number' &&
    !isNaN(penilaian.skor_agi) &&
    typeof penilaian.skor_flx === 'number' &&
    !isNaN(penilaian.skor_flx) &&
    typeof penilaian.skor_sta === 'number' &&
    !isNaN(penilaian.skor_sta) &&
    typeof penilaian.skor_tec === 'number' &&
    !isNaN(penilaian.skor_tec) &&
    typeof penilaian.skor_dis === 'number' &&
    !isNaN(penilaian.skor_dis)
  ) {
    return {
      skor_str: clampScore(penilaian.skor_str),
      skor_agi: clampScore(penilaian.skor_agi),
      skor_flx: clampScore(penilaian.skor_flx),
      skor_sta: clampScore(penilaian.skor_sta),
      skor_tec: clampScore(penilaian.skor_tec),
      skor_dis: clampScore(penilaian.skor_dis),
    }
  }

  // Fallback dari 4 pilar lama
  const fisik = typeof penilaian.skor_fisik === 'number' ? penilaian.skor_fisik : 75
  const kyorugi = typeof penilaian.skor_kyorugi === 'number' ? penilaian.skor_kyorugi : 75
  const poomsae = typeof penilaian.skor_poomsae === 'number' ? penilaian.skor_poomsae : 75
  const disiplin = typeof penilaian.skor_disiplin === 'number' ? penilaian.skor_disiplin : 85

  const skorStr = clampScore(Math.round(kyorugi * 0.6 + fisik * 0.4))
  const skorAgi = clampScore(Math.round(kyorugi * 0.6 + fisik * 0.4))
  const skorFlx = clampScore(Math.round(fisik * 0.7 + poomsae * 0.3))
  const skorSta = clampScore(fisik)
  const skorTec = clampScore(poomsae)
  const skorDis = clampScore(disiplin)

  return {
    skor_str: skorStr,
    skor_agi: skorAgi,
    skor_flx: skorFlx,
    skor_sta: skorSta,
    skor_tec: skorTec,
    skor_dis: skorDis,
  }
}

/**
 * Format 6 atribut menjadi array siap konsumsi oleh Recharts <RadarChart>.
 */
export function formatAttributesForRadar(scores: SixAttributes): Array<{
  attribute: string
  fullName: string
  value: number
  fullMark: number
}> {
  return [
    {
      attribute: ATTRIBUTE_CONFIG.skor_str.key,
      fullName: ATTRIBUTE_CONFIG.skor_str.fullLabel,
      value: clampScore(scores.skor_str),
      fullMark: 100,
    },
    {
      attribute: ATTRIBUTE_CONFIG.skor_agi.key,
      fullName: ATTRIBUTE_CONFIG.skor_agi.fullLabel,
      value: clampScore(scores.skor_agi),
      fullMark: 100,
    },
    {
      attribute: ATTRIBUTE_CONFIG.skor_flx.key,
      fullName: ATTRIBUTE_CONFIG.skor_flx.fullLabel,
      value: clampScore(scores.skor_flx),
      fullMark: 100,
    },
    {
      attribute: ATTRIBUTE_CONFIG.skor_sta.key,
      fullName: ATTRIBUTE_CONFIG.skor_sta.fullLabel,
      value: clampScore(scores.skor_sta),
      fullMark: 100,
    },
    {
      attribute: ATTRIBUTE_CONFIG.skor_tec.key,
      fullName: ATTRIBUTE_CONFIG.skor_tec.fullLabel,
      value: clampScore(scores.skor_tec),
      fullMark: 100,
    },
    {
      attribute: ATTRIBUTE_CONFIG.skor_dis.key,
      fullName: ATTRIBUTE_CONFIG.skor_dis.fullLabel,
      value: clampScore(scores.skor_dis),
      fullMark: 100,
    },
  ]
}

/**
 * Dapatkan Tier OVR atlet (S / A / B / C) dan warnanya untuk tampilan kartu pemain.
 */
export function getOVRTier(ovr: number): {
  tier: 'S' | 'A' | 'B' | 'C'
  badge: string
  color: string
} {
  const score = clampScore(ovr)
  if (score >= 90) return { tier: 'S', badge: 'DIAMOND TIER', color: '#8B5CF6' }
  if (score >= 80) return { tier: 'A', badge: 'GOLD TIER', color: '#F59E0B' }
  if (score >= 70) return { tier: 'B', badge: 'SILVER TIER', color: '#3B82F6' }
  return { tier: 'C', badge: 'BRONZE TIER', color: '#10B981' }
}
