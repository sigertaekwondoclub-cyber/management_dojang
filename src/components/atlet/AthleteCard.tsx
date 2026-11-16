'use client'

import React from 'react'
import type { Siswa, PenilaianAtlet, SixAttributes } from '@/lib/types'
import {
  mapLegacyPenilaianToStats,
  calculateOVR,
  determineArchetype,
  getOVRTier,
  ATTRIBUTE_CONFIG,
  clampScore,
} from '@/lib/athlete-stats'
import { AthleteRadarChart } from './AthleteRadarChart'

export interface AthleteCardSiswa {
  nama: string
  sabuk_saat_ini?: string | null
  foto_url?: string | null
  program_kelas?: {
    nama_program?: string
  } | null
  id?: string
  no_kartu?: string
  tgl_lahir?: string | null
}

export interface AthleteCardProps {
  siswa: AthleteCardSiswa
  penilaian?: Partial<PenilaianAtlet> | null
  scores?: SixAttributes | null
  ovr?: number
  archetype?: string
  className?: string
  showRadarChart?: boolean
  onClick?: () => void
}

/**
 * Indikator warna sesuai spesifikasi:
 * - hijau jika >= 85
 * - biru jika >= 75
 * - kuning jika >= 65
 * - merah jika < 65
 */
function getStatColorStyles(score: number): {
  containerBg: string
  badgeBg: string
  badgeText: string
  borderColor: string
  labelColor: string
} {
  if (score >= 85) {
    return {
      containerBg: 'bg-emerald-50',
      badgeBg: 'bg-emerald-500',
      badgeText: 'text-white',
      borderColor: 'border-emerald-600',
      labelColor: 'text-emerald-900',
    }
  }
  if (score >= 75) {
    return {
      containerBg: 'bg-blue-50',
      badgeBg: 'bg-blue-500',
      badgeText: 'text-white',
      borderColor: 'border-blue-600',
      labelColor: 'text-blue-900',
    }
  }
  if (score >= 65) {
    return {
      containerBg: 'bg-amber-50',
      badgeBg: 'bg-amber-500',
      badgeText: 'text-white',
      borderColor: 'border-amber-600',
      labelColor: 'text-amber-900',
    }
  }
  return {
    containerBg: 'bg-rose-50',
    badgeBg: 'bg-rose-500',
    badgeText: 'text-white',
    borderColor: 'border-rose-600',
    labelColor: 'text-rose-900',
  }
}

export function AthleteCard({
  siswa,
  penilaian,
  scores,
  ovr,
  archetype,
  className = '',
  showRadarChart = false,
  onClick,
}: AthleteCardProps) {
  const [imgError, setImgError] = React.useState<boolean>(false)

  React.useEffect(() => {
    setImgError(false)
  }, [siswa.foto_url])

  // 1. Resolusi 6 atribut
  const finalScores: SixAttributes = scores
    ? {
        skor_str: clampScore(scores.skor_str),
        skor_agi: clampScore(scores.skor_agi),
        skor_flx: clampScore(scores.skor_flx),
        skor_sta: clampScore(scores.skor_sta),
        skor_tec: clampScore(scores.skor_tec),
        skor_dis: clampScore(scores.skor_dis),
      }
    : mapLegacyPenilaianToStats(penilaian)

  // 2. Resolusi OVR & Tier
  const finalOVR =
    typeof ovr === 'number'
      ? clampScore(ovr)
      : typeof penilaian?.ovr_score === 'number' && penilaian.ovr_score > 0
        ? clampScore(penilaian.ovr_score)
        : calculateOVR(finalScores)

  const ovrTier = getOVRTier(finalOVR)

  // 3. Resolusi Archetype
  const finalArchetype =
    archetype || penilaian?.archetype || determineArchetype(finalScores)

  // 4. Sabuk siswa
  const sabukName = siswa.sabuk_saat_ini || 'Putih'

  // 5. Enam atribut pill data
  const miniStats = [
    {
      key: ATTRIBUTE_CONFIG.skor_str.key,
      label: ATTRIBUTE_CONFIG.skor_str.label,
      icon: ATTRIBUTE_CONFIG.skor_str.icon,
      score: finalScores.skor_str,
    },
    {
      key: ATTRIBUTE_CONFIG.skor_agi.key,
      label: ATTRIBUTE_CONFIG.skor_agi.label,
      icon: ATTRIBUTE_CONFIG.skor_agi.icon,
      score: finalScores.skor_agi,
    },
    {
      key: ATTRIBUTE_CONFIG.skor_flx.key,
      label: ATTRIBUTE_CONFIG.skor_flx.label,
      icon: ATTRIBUTE_CONFIG.skor_flx.icon,
      score: finalScores.skor_flx,
    },
    {
      key: ATTRIBUTE_CONFIG.skor_sta.key,
      label: ATTRIBUTE_CONFIG.skor_sta.label,
      icon: ATTRIBUTE_CONFIG.skor_sta.icon,
      score: finalScores.skor_sta,
    },
    {
      key: ATTRIBUTE_CONFIG.skor_tec.key,
      label: ATTRIBUTE_CONFIG.skor_tec.label,
      icon: ATTRIBUTE_CONFIG.skor_tec.icon,
      score: finalScores.skor_tec,
    },
    {
      key: ATTRIBUTE_CONFIG.skor_dis.key,
      label: ATTRIBUTE_CONFIG.skor_dis.label,
      icon: ATTRIBUTE_CONFIG.skor_dis.icon,
      score: finalScores.skor_dis,
    },
  ]

  const clickableStyles = onClick
    ? 'cursor-pointer hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[7px_7px_0px_#1E2A38] transition-all duration-100'
    : ''

  return (
    <div
      onClick={onClick}
      className={`bg-[#FFFDF9] border-[3px] border-[#1E2A38] p-5 shadow-[5px_5px_0px_#1E2A38] text-[#1E2A38] flex flex-col gap-4 relative overflow-hidden ${clickableStyles} ${className}`}
    >
      {/* Top Card Badge / Decorative Ribbon */}
      <div className="flex items-center justify-between pb-2 border-b-2 border-[#1E2A38]/15">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 bg-[#1E2A38]" />
          <span className="text-[10px] font-pixel font-bold uppercase tracking-widest text-[#1E2A38]/75">
            SIGER ATHLETE PROFILE
          </span>
        </div>
        {siswa.program_kelas?.nama_program && (
          <span className="text-[10px] font-pixel font-bold px-2 py-0.5 border border-[#1E2A38] bg-amber-100 shadow-[1px_1px_0px_#1E2A38]">
            {siswa.program_kelas.nama_program}
          </span>
        )}
      </div>

      {/* Header: Avatar, Nama, Sabuk Badge */}
      <div className="flex items-center gap-3.5">
        {siswa.foto_url && !imgError ? (
          <img
            src={siswa.foto_url}
            alt={siswa.nama}
            onError={() => setImgError(true)}
            className="w-16 h-16 sm:w-20 sm:h-20 object-cover border-2 border-[#1E2A38] shadow-[3px_3px_0px_#1E2A38] bg-white shrink-0"
          />
        ) : (
          <div className="w-16 h-16 sm:w-20 sm:h-20 border-2 border-[#1E2A38] shadow-[3px_3px_0px_#1E2A38] bg-amber-100 flex flex-col items-center justify-center shrink-0">
            <span className="text-2xl sm:text-3xl leading-none">🥋</span>
            <span className="text-[9px] font-pixel font-black text-[#1E2A38] mt-1 tracking-tight">
              SIGER TKD
            </span>
          </div>
        )}

        <div className="flex-1 min-w-0">
          <h3 className="font-pixel text-lg sm:text-xl font-bold uppercase tracking-tight text-[#1E2A38] truncate">
            {siswa.nama}
          </h3>
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 border-2 border-[#1E2A38] bg-white font-pixel font-bold text-xs shadow-[2px_2px_0px_#1E2A38]">
              <span>🥋</span>
              <span>Sabuk {sabukName}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Badge OVR Besar dengan Tier (cth: "OVR 84 - GOLD TIER") */}
      <div className="border-2 border-[#1E2A38] bg-white shadow-[3px_3px_0px_#1E2A38] flex items-stretch overflow-hidden">
        <div
          className="px-3.5 py-2.5 flex flex-col items-center justify-center border-r-2 border-[#1E2A38] shrink-0 min-w-[76px]"
          style={{ backgroundColor: ovrTier.color }}
        >
          <span className="text-[9px] font-pixel font-black text-white/95 uppercase tracking-widest leading-none">
            OVR
          </span>
          <span className="text-3xl font-pixel font-black text-white leading-none mt-1 drop-shadow-[1px_1px_0px_rgba(0,0,0,0.35)]">
            {finalOVR}
          </span>
        </div>
        <div className="flex-1 px-3 py-2 flex flex-col justify-center">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-pixel font-black text-sm sm:text-base text-[#1E2A38] tracking-wide">
              OVR {finalOVR} - {ovrTier.badge}
            </span>
          </div>
          <p className="text-[11px] text-gray-600 font-medium leading-snug mt-0.5">
            Peringkat Klasifikasi Atlet • Tier {ovrTier.tier}
          </p>
        </div>
      </div>

      {/* Badge Archetype (cth: "⚡ Speed Striker") */}
      <div className="flex items-center justify-between gap-2 p-2 border-2 border-[#1E2A38] bg-amber-50/80 shadow-[2px_2px_0px_#1E2A38]">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[11px] font-pixel font-bold text-gray-500 uppercase shrink-0">
            Archetype:
          </span>
          <span className="font-pixel font-black text-xs sm:text-sm text-[#1E2A38] truncate">
            {finalArchetype}
          </span>
        </div>
        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
      </div>

      {/* Optional Radar Chart preview */}
      {showRadarChart && (
        <div className="border-2 border-[#1E2A38] bg-white p-2 shadow-[2px_2px_0px_#1E2A38]">
          <AthleteRadarChart scores={finalScores} height={200} showTooltip={true} />
        </div>
      )}

      {/* Grid 6 Mini-Stats Pill */}
      <div>
        <div className="text-[10px] font-pixel font-bold text-gray-500 uppercase tracking-wider mb-2">
          Statistik Fisik &amp; Teknik (6 Atribut)
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {miniStats.map((stat) => {
            const styles = getStatColorStyles(stat.score)
            return (
              <div
                key={stat.key}
                className={`border-2 border-[#1E2A38] ${styles.containerBg} p-2 flex items-center justify-between shadow-[2px_2px_0px_#1E2A38]`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-sm shrink-0 leading-none">{stat.icon}</span>
                  <div className="flex flex-col min-w-0">
                    <span className="font-pixel font-black text-xs text-[#1E2A38] leading-none">
                      {stat.key}
                    </span>
                    <span className="text-[9px] text-gray-500 truncate leading-none mt-0.5">
                      {stat.label}
                    </span>
                  </div>
                </div>
                <span
                  className={`px-1.5 py-0.5 text-xs font-pixel font-black border border-[#1E2A38] ${styles.badgeBg} ${styles.badgeText} shadow-[1px_1px_0px_#1E2A38] leading-none`}
                >
                  {stat.score}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default AthleteCard
