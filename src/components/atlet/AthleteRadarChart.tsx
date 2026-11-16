'use client'

import React, { useState, useEffect } from 'react'
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Tooltip,
} from 'recharts'
import type { SixAttributes, PenilaianAtlet } from '@/lib/types'
import {
  formatAttributesForRadar,
  mapLegacyPenilaianToStats,
  clampScore,
} from '@/lib/athlete-stats'

export interface AthleteRadarChartProps {
  scores?: SixAttributes | null
  penilaian?: Partial<PenilaianAtlet> | null
  className?: string
  height?: number | string
  fillColor?: string
  strokeColor?: string
  strokeWidth?: number
  fillOpacity?: number
  showTooltip?: boolean
}

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{
    value?: number
    payload?: {
      attribute: string
      fullName: string
      value: number
      fullMark: number
    }
  }>
}

const RadarCustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload }) => {
  if (active && payload && payload.length > 0) {
    const data = payload[0].payload
    if (!data) return null
    return (
      <div className="bg-white border-2 border-[#1E293B] p-2.5 shadow-[3px_3px_0px_#1E293B] text-xs">
        <p className="font-pixel font-bold text-[#1E293B] uppercase tracking-wide">
          {data.attribute} • {data.fullName}
        </p>
        <div className="flex items-baseline gap-1 mt-1">
          <span className="text-lg font-pixel font-black text-amber-600 leading-none">
            {data.value}
          </span>
          <span className="text-[11px] text-gray-500 font-pixel">/ 100</span>
        </div>
      </div>
    )
  }
  return null
}

export function AthleteRadarChart({
  scores,
  penilaian,
  className = '',
  height = 280,
  fillColor = '#F59E0B',
  strokeColor = '#1E293B',
  strokeWidth = 2,
  fillOpacity = 0.6,
  showTooltip = true,
}: AthleteRadarChartProps) {
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Resolusi nilai skor 6 atribut dengan fallback graceful
  const rawScores = scores || (penilaian ? mapLegacyPenilaianToStats(penilaian) : mapLegacyPenilaianToStats(null))
  const safeScores: SixAttributes = {
    skor_str: clampScore(rawScores.skor_str),
    skor_agi: clampScore(rawScores.skor_agi),
    skor_flx: clampScore(rawScores.skor_flx),
    skor_sta: clampScore(rawScores.skor_sta),
    skor_tec: clampScore(rawScores.skor_tec),
    skor_dis: clampScore(rawScores.skor_dis),
  }

  const chartData = formatAttributesForRadar(safeScores)

  if (!isMounted) {
    return (
      <div
        className={`w-full flex flex-col items-center justify-center bg-amber-50/40 border-2 border-dashed border-[#1E2A38]/30 ${className}`}
        style={{ height, minHeight: 220 }}
      >
        <span className="text-xl animate-pulse">🥋</span>
        <span className="text-[11px] font-pixel text-[#1E2A38]/60 font-bold mt-1 tracking-wider">
          MEMUAT RADAR ATLET...
        </span>
      </div>
    )
  }

  return (
    <div
      className={`w-full relative ${className}`}
      style={{ height, minHeight: 220 }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="72%" data={chartData}>
          <PolarGrid stroke="#CBD5E1" strokeDasharray="3 3" />
          <PolarAngleAxis
            dataKey="attribute"
            tick={{
              fill: strokeColor,
              fontSize: 12,
              fontWeight: 800,
              fontFamily: 'monospace',
            }}
          />
          <PolarRadiusAxis
            angle={30}
            domain={[0, 100]}
            stroke="#94A3B8"
            tick={{ fill: '#64748B', fontSize: 10 }}
          />
          {showTooltip && (
            <Tooltip
              content={<RadarCustomTooltip />}
              wrapperStyle={{ outline: 'none' }}
            />
          )}
          <Radar
            name="Statistik Atlet"
            dataKey="value"
            stroke={strokeColor}
            fill={fillColor}
            fillOpacity={fillOpacity}
            strokeWidth={strokeWidth}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default AthleteRadarChart
