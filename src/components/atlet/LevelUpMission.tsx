'use client'

import React, { useState } from 'react'
import type { SixAttributes, PenilaianAtlet, LevelUpMission as LevelUpMissionType } from '@/lib/types'
import {
  generateLevelUpMissions,
  mapLegacyPenilaianToStats,
  clampScore,
} from '@/lib/athlete-stats'

export interface LevelUpMissionProps {
  missions?: LevelUpMissionType[]
  scores?: SixAttributes | null
  penilaian?: Partial<PenilaianAtlet> | null
  siswaName?: string
  className?: string
  interactive?: boolean
  onMissionToggle?: (missionId: string, isCompleted: boolean) => void
}

export function LevelUpMission({
  missions,
  scores,
  penilaian,
  siswaName,
  className = '',
  interactive = true,
  onMissionToggle,
}: LevelUpMissionProps) {
  const [completedMap, setCompletedMap] = useState<Record<string, boolean>>({})

  // Resolusi misi: jika diberikan langsung gunakan missions, jika tidak kalkulasi dari skor terendah
  const activeMissions: LevelUpMissionType[] = React.useMemo(() => {
    if (missions && missions.length > 0) {
      return missions
    }
    const rawScores = scores || (penilaian ? mapLegacyPenilaianToStats(penilaian) : mapLegacyPenilaianToStats(null))
    const safeScores: SixAttributes = {
      skor_str: clampScore(rawScores.skor_str),
      skor_agi: clampScore(rawScores.skor_agi),
      skor_flx: clampScore(rawScores.skor_flx),
      skor_sta: clampScore(rawScores.skor_sta),
      skor_tec: clampScore(rawScores.skor_tec),
      skor_dis: clampScore(rawScores.skor_dis),
    }
    return generateLevelUpMissions(safeScores)
  }, [missions, scores, penilaian])

  const handleToggle = (missionId: string) => {
    const nextState = !completedMap[missionId]
    setCompletedMap((prev) => ({
      ...prev,
      [missionId]: nextState,
    }))
    if (onMissionToggle) {
      onMissionToggle(missionId, nextState)
    }
  }

  return (
    <div
      className={`bg-white border-[3px] border-[#1E2A38] p-5 shadow-[5px_5px_0px_#1E2A38] text-[#1E2A38] flex flex-col gap-4 ${className}`}
    >
      {/* Header Kartu Misi */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b-2 border-[#1E2A38]/15">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">🎯</span>
            <h3 className="font-pixel text-base sm:text-lg font-black uppercase tracking-tight text-[#1E2A38]">
              MISI LEVEL UP HARIAN
            </h3>
          </div>
          <p className="text-xs text-gray-600 font-medium mt-0.5">
            Rekomendasi latihan mandiri di rumah untuk melatih atribut terendah{' '}
            {siswaName ? <span className="font-bold text-[#1E2A38]">{siswaName}</span> : 'atlet'}.
          </p>
        </div>
        <span className="self-start sm:self-center px-2.5 py-1 border-2 border-[#1E2A38] bg-yellow-300 font-pixel font-bold text-[11px] shadow-[2px_2px_0px_#1E2A38] uppercase">
          HOME DRILL
        </span>
      </div>

      {/* Konten Misi (1-2 Rekomendasi) */}
      {activeMissions.length === 0 ? (
        <div className="p-4 border-2 border-dashed border-[#1E2A38]/30 bg-emerald-50 text-center">
          <p className="text-sm font-pixel font-bold text-emerald-800">
            🌟 Luar biasa! Seluruh atribut berada di level optimal.
          </p>
          <p className="text-xs text-emerald-700 mt-1">
            Pertahankan rutinitas latihan fisik dan teknik di dojang!
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3.5">
          {activeMissions.map((mission, index) => {
            const missionId = mission.id || mission.attribute || `mission-${index}`
            const isCompleted = !!completedMap[missionId]

            return (
              <div
                key={missionId}
                className={`border-2 border-[#1E2A38] p-4 shadow-[3px_3px_0px_#1E2A38] transition-all flex flex-col gap-3 ${
                  isCompleted ? 'bg-emerald-50/70 border-emerald-700' : 'bg-[#FFFDF9]'
                }`}
              >
                {/* Baris Judul & Badge Prioritas */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-8 h-8 rounded-none border-2 border-[#1E2A38] bg-amber-100 flex items-center justify-center text-lg shrink-0 shadow-[2px_2px_0px_#1E2A38]">
                      {mission.icon || '⚡'}
                    </span>
                    <div className="min-w-0">
                      <h4 className="font-pixel font-bold text-sm text-[#1E2A38] leading-tight truncate">
                        {mission.title}
                      </h4>
                      <span className="text-[10px] text-gray-500 font-pixel uppercase">
                        Fokus Peningkatan: {mission.attributeLabel}
                      </span>
                    </div>
                  </div>

                  <span className="px-2 py-0.5 border border-[#1E2A38] bg-rose-100 text-rose-900 font-pixel font-bold text-[10px] shadow-[1px_1px_0px_#1E2A38] shrink-0">
                    BOOST {mission.attributeLabel} • {mission.score}/100
                  </span>
                </div>

                {/* Deskripsi Manfaat */}
                <p className="text-xs text-gray-700 leading-relaxed font-normal">
                  {mission.description}
                </p>

                {/* Box Target Terukur Harian */}
                <div className="bg-amber-100/70 border-2 border-[#1E2A38] p-2.5 shadow-[2px_2px_0px_#1E2A38] flex items-start gap-2">
                  <span className="text-base shrink-0 leading-none mt-0.5">⏱️</span>
                  <div className="min-w-0 flex-1">
                    <span className="text-[9px] font-pixel font-black text-amber-900 uppercase tracking-wider block leading-none">
                      TARGET HARIAN TERUKUR
                    </span>
                    <p className="text-xs font-bold text-[#1E2A38] mt-1 leading-snug">
                      {mission.target}
                    </p>
                  </div>
                </div>

                {/* Checkbox / Tombol Selesai Interaktif */}
                {interactive && (
                  <button
                    type="button"
                    onClick={() => handleToggle(missionId)}
                    className={`w-full py-2 px-3 border-2 border-[#1E2A38] font-pixel font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      isCompleted
                        ? 'bg-emerald-400 hover:bg-emerald-500 text-[#1E2A38] shadow-[2px_2px_0px_#1E2A38]'
                        : 'bg-white hover:bg-amber-100 text-[#1E2A38] shadow-[2px_2px_0px_#1E2A38]'
                    }`}
                  >
                    <span>{isCompleted ? '✅' : '⬜'}</span>
                    <span>
                      {isCompleted
                        ? 'Latihan Selesai Hari Ini! (+XP Prestasi)'
                        : 'Tandai Selesai Latihan Hari Ini'}
                    </span>
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Footer Motivasi Dojang */}
      <div className="pt-2 border-t-2 border-[#1E2A38]/15 flex items-center gap-2 text-gray-600">
        <span className="text-sm shrink-0">💡</span>
        <p className="text-[11px] leading-tight font-medium">
          <span className="font-bold text-[#1E2A38]">Tips Pelatih:</span> Disiplin latihan mandiri 15 menit
          setiap hari membentuk kelenturan otot dan refleks juara di arena kejuaraan.
        </p>
      </div>
    </div>
  )
}

export default LevelUpMission
