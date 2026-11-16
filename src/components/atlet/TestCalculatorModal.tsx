'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import type { Siswa, SixAttributes, RawTestData } from '@/lib/types'
import {
  calculateAge,
  isChildCategory,
  convertRawTestToScore,
  calculateOVR,
  determineArchetype,
  getOVRTier,
  ATTRIBUTE_CONFIG,
  clampScore,
} from '@/lib/athlete-stats'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

export interface TestCalculatorModalProps {
  isOpen: boolean
  onClose: () => void
  siswa: Siswa
  initialRawData?: RawTestData | null
  attendancePercent?: number
  totalSessions?: number
  initialAttitude?: number
  onApply: (scores: SixAttributes, rawData: RawTestData) => void
}

export function TestCalculatorModal({
  isOpen,
  onClose,
  siswa,
  initialRawData,
  attendancePercent = 100,
  totalSessions,
  initialAttitude = 85,
  onApply,
}: TestCalculatorModalProps) {
  // Hitung usia dan kategori siswa
  const age = useMemo(() => calculateAge(siswa.tgl_lahir), [siswa.tgl_lahir])
  const isChild = useMemo(() => isChildCategory(age), [age])

  // State nilai tes fisik mentah
  const [pushupCount, setPushupCount] = useState<number>(
    initialRawData?.pushup_count ?? (isChild ? 18 : 25)
  )
  const [kickingCount, setKickingCount] = useState<number>(
    initialRawData?.kicking_speed_count ?? (isChild ? 30 : 35)
  )
  const [splitCm, setSplitCm] = useState<number>(
    initialRawData?.split_cm ?? 5
  )
  const [skippingSec, setSkippingSec] = useState<number>(
    initialRawData?.skipping_sec ?? 90
  )
  const [techniqueStars, setTechniqueStars] = useState<number>(
    initialRawData?.technique_stars ?? 4
  )
  const [attitudeScore, setAttitudeScore] = useState<number>(initialAttitude)

  // Stopwatch state untuk pengujian di lapangan
  const [timerMode, setTimerMode] = useState<'30s' | 'stopwatch'>('30s')
  const [timerSeconds, setTimerSeconds] = useState<number>(30)
  const [timerActive, setTimerActive] = useState<boolean>(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // Reset state jika initialRawData atau siswa berubah saat modal dibuka
  useEffect(() => {
    if (isOpen) {
      if (initialRawData) {
        if (typeof initialRawData.pushup_count === 'number') setPushupCount(initialRawData.pushup_count)
        if (typeof initialRawData.kicking_speed_count === 'number') setKickingCount(initialRawData.kicking_speed_count)
        if (typeof initialRawData.split_cm === 'number') setSplitCm(initialRawData.split_cm)
        if (typeof initialRawData.skipping_sec === 'number') setSkippingSec(initialRawData.skipping_sec)
        if (typeof initialRawData.technique_stars === 'number') setTechniqueStars(initialRawData.technique_stars)
      } else {
        setPushupCount(isChild ? 18 : 25)
        setKickingCount(isChild ? 30 : 35)
        setSplitCm(5)
        setSkippingSec(90)
        setTechniqueStars(4)
      }
      setAttitudeScore(initialAttitude)
    }
  }, [isOpen, initialRawData, isChild, initialAttitude])

  // Pengendali stopwatch
  useEffect(() => {
    if (timerActive) {
      timerRef.current = setInterval(() => {
        setTimerSeconds((prev) => {
          if (timerMode === '30s') {
            if (prev <= 1) {
              setTimerActive(false)
              return 0
            }
            return prev - 1
          } else {
            return prev + 1
          }
        })
      }, 1000)
    } else if (timerRef.current) {
      clearInterval(timerRef.current)
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [timerActive, timerMode])

  const handleStartTimer = (mode: '30s' | 'stopwatch') => {
    setTimerMode(mode)
    setTimerSeconds(mode === '30s' ? 30 : 0)
    setTimerActive(true)
  }

  const handleStopTimer = () => {
    setTimerActive(false)
  }

  const handleResetTimer = () => {
    setTimerActive(false)
    setTimerSeconds(timerMode === '30s' ? 30 : 0)
  }

  // Hitung live scores
  const calculatedScores = useMemo<SixAttributes>(() => {
    const str = convertRawTestToScore('pushup_count', pushupCount, age)
    const agi = convertRawTestToScore('kicking_speed_count', kickingCount, age)
    const flx = convertRawTestToScore('split_cm', splitCm, age)
    const sta = convertRawTestToScore('skipping_sec', skippingSec, age)
    const tec = convertRawTestToScore('technique_stars', techniqueStars, age)
    const dis =
      totalSessions === 0
        ? clampScore(attitudeScore)
        : convertRawTestToScore('discipline', attendancePercent, age, { attitudeScore })

    return {
      skor_str: str,
      skor_agi: agi,
      skor_flx: flx,
      skor_sta: sta,
      skor_tec: tec,
      skor_dis: dis,
    }
  }, [pushupCount, kickingCount, splitCm, skippingSec, techniqueStars, attendancePercent, attitudeScore, age, totalSessions])

  const ovr = useMemo(() => calculateOVR(calculatedScores), [calculatedScores])
  const archetype = useMemo(() => determineArchetype(calculatedScores), [calculatedScores])
  const ovrTier = useMemo(() => getOVRTier(ovr), [ovr])

  const handleApply = () => {
    const rawData: RawTestData = {
      pushup_count: pushupCount,
      kicking_speed_count: kickingCount,
      split_cm: splitCm,
      skipping_sec: skippingSec,
      technique_stars: techniqueStars,
      persen_kehadiran: totalSessions === 0 ? 0 : attendancePercent,
    }

    onApply(calculatedScores, rawData)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-dark/70 backdrop-blur-sm animate-fade-in">
      <div
        className="relative bg-white border-[3px] border-dark shadow-[8px_8px_0px_#1E2A38] w-full max-w-2xl rounded-2xl p-5 sm:p-6 z-10 flex flex-col gap-4 max-h-[92vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex justify-between items-start border-b-2 border-dark/10 pb-3 shrink-0">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-2xl">🧮</span>
              <h2 className="text-xl sm:text-2xl font-black font-sans text-dark tracking-tight">
                Kalkulator Tes Fisik Lapangan
              </h2>
            </div>
            <p className="text-xs text-dark/70 font-sans mt-1">
              Standar rubrik otomatis beradaptasi dengan kategori usia siswa
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl border-2 border-dark hover:bg-dark hover:text-white flex items-center justify-center font-bold text-base transition-colors"
            title="Tutup Modal"
          >
            ✕
          </button>
        </div>

        {/* Info Siswa & Kategori Usia */}
        <div className="bg-primary/10 border-2 border-dark rounded-xl p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl border-2 border-dark bg-secondary flex items-center justify-center font-black text-dark text-lg shrink-0">
              {siswa.nama.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-dark font-sans text-sm sm:text-base">{siswa.nama}</span>
                <Badge color="dark">Sabuk {siswa.sabuk_saat_ini}</Badge>
              </div>
              <div className="text-xs text-dark/70 font-sans mt-0.5">
                Usia: <strong className="text-dark font-mono">{age > 0 ? `${age} tahun` : 'Belum diisi (Default < 12 thn)'}</strong>
                {' · '}Presensi:{' '}
                <strong className="text-dark font-mono">
                  {totalSessions === 0 ? 'N/A (Belum ada sesi)' : `${attendancePercent}%`}
                </strong>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span
              className={`text-xs px-2.5 py-1 rounded-full font-bold border-2 border-dark ${
                isChild ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'
              }`}
            >
              {isChild ? '🧒 Kategori Anak (< 12 Thn)' : '🥋 Kategori Remaja / Dewasa (≥ 12 Thn)'}
            </span>
          </div>
        </div>

        {/* Stopwatch Lapangan Mini */}
        <div className="bg-slate-900 text-white rounded-xl p-3 border-2 border-dark flex items-center justify-between gap-3 flex-wrap shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">⏱️</span>
            <div>
              <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                Stopwatch / Timer Lapangan
              </div>
              <div className="text-2xl font-black font-mono tracking-wider text-primary">
                {timerMode === '30s'
                  ? `${timerSeconds}s`
                  : `${Math.floor(timerSeconds / 60)
                      .toString()
                      .padStart(2, '0')}:${(timerSeconds % 60).toString().padStart(2, '0')}`}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => handleStartTimer('30s')}
              disabled={timerActive && timerMode === '30s'}
              className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-dark font-bold text-xs rounded-lg border border-dark transition-all disabled:opacity-50"
            >
              Mode 30s Speed
            </button>
            <button
              type="button"
              onClick={() => handleStartTimer('stopwatch')}
              disabled={timerActive && timerMode === 'stopwatch'}
              className="px-2.5 py-1 bg-cyan-500 hover:bg-cyan-400 text-dark font-bold text-xs rounded-lg border border-dark transition-all disabled:opacity-50"
            >
              Mode Stopwatch
            </button>
            {timerActive ? (
              <button
                type="button"
                onClick={handleStopTimer}
                className="px-3 py-1 bg-rose-500 hover:bg-rose-400 text-white font-bold text-xs rounded-lg border border-dark transition-all"
              >
                Jeda
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setTimerActive(true)}
                className="px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-xs rounded-lg border border-dark transition-all"
              >
                Mulai
              </button>
            )}
            <button
              type="button"
              onClick={handleResetTimer}
              className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold text-xs rounded-lg border border-dark transition-all"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Scrollable Form Content */}
        <div className="flex flex-col gap-4 overflow-y-auto pr-1">
          {/* 1. Kekuatan (STR) - Push-up & Sit-up */}
          <div className="p-3.5 bg-background border-2 border-dark rounded-xl flex flex-col gap-2">
            <div className="flex justify-between items-start gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">{ATTRIBUTE_CONFIG.skor_str.icon}</span>
                <div>
                  <h4 className="font-bold text-dark text-sm">
                    {ATTRIBUTE_CONFIG.skor_str.key} · Push-up &amp; Sit-up (Kali)
                  </h4>
                  <p className="text-[11px] text-dark/60">
                    {isChild ? 'Target Anak: <10 (60) | 10-18 (72) | 19-28 (82) | >28 (95)' : 'Target Dewasa: <15 (60) | 15-25 (72) | 26-38 (82) | >38 (95)'}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-dark/50 block">Skor STR</span>
                <span className="font-mono font-black text-lg text-rose-600">
                  {calculatedScores.skor_str}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setPushupCount((prev) => Math.max(0, prev - 1))}
                className="w-9 h-9 rounded-lg border-2 border-dark bg-white font-bold text-lg hover:bg-dark/5 active:scale-95 transition-all shrink-0"
              >
                -
              </button>
              <input
                type="number"
                min="0"
                max="100"
                value={pushupCount}
                onChange={(e) => setPushupCount(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full border-2 border-dark rounded-lg px-3 py-1.5 font-mono font-bold text-center text-dark text-base bg-white focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                type="button"
                onClick={() => setPushupCount((prev) => prev + 1)}
                className="w-9 h-9 rounded-lg border-2 border-dark bg-white font-bold text-lg hover:bg-dark/5 active:scale-95 transition-all shrink-0"
              >
                +
              </button>
            </div>
          </div>

          {/* 2. Kelincahan (AGI) - Kicking Speed 30s */}
          <div className="p-3.5 bg-background border-2 border-dark rounded-xl flex flex-col gap-2">
            <div className="flex justify-between items-start gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">{ATTRIBUTE_CONFIG.skor_agi.icon}</span>
                <div>
                  <h4 className="font-bold text-dark text-sm">
                    {ATTRIBUTE_CONFIG.skor_agi.key} · Kicking Speed 30 Detik (Kali)
                  </h4>
                  <p className="text-[11px] text-dark/60">
                    {isChild ? 'Target Anak: <22 (60) | 22-30 (72) | 31-40 (82) | >40 (95)' : 'Target Dewasa: <25 (60) | 25-34 (72) | 35-44 (82) | >44 (95)'}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-dark/50 block">Skor AGI</span>
                <span className="font-mono font-black text-lg text-amber-600">
                  {calculatedScores.skor_agi}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setKickingCount((prev) => Math.max(0, prev - 1))}
                className="w-9 h-9 rounded-lg border-2 border-dark bg-white font-bold text-lg hover:bg-dark/5 active:scale-95 transition-all shrink-0"
              >
                -
              </button>
              <input
                type="number"
                min="0"
                max="120"
                value={kickingCount}
                onChange={(e) => setKickingCount(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full border-2 border-dark rounded-lg px-3 py-1.5 font-mono font-bold text-center text-dark text-base bg-white focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                type="button"
                onClick={() => setKickingCount((prev) => prev + 1)}
                className="w-9 h-9 rounded-lg border-2 border-dark bg-white font-bold text-lg hover:bg-dark/5 active:scale-95 transition-all shrink-0"
              >
                +
              </button>
            </div>
          </div>

          {/* 3. Kelenturan (FLX) - Jarak Split ke Lantai */}
          <div className="p-3.5 bg-background border-2 border-dark rounded-xl flex flex-col gap-2">
            <div className="flex justify-between items-start gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">{ATTRIBUTE_CONFIG.skor_flx.icon}</span>
                <div>
                  <h4 className="font-bold text-dark text-sm">
                    {ATTRIBUTE_CONFIG.skor_flx.key} · Jarak Split ke Lantai (cm)
                  </h4>
                  <p className="text-[11px] text-dark/60">
                    Semakin kecil semakin lentur: 0cm (98) | ≤5cm (90) | ≤10cm (80) | ≤20cm (70) | &gt;20cm (60)
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-dark/50 block">Skor FLX</span>
                <span className="font-mono font-black text-lg text-emerald-600">
                  {calculatedScores.skor_flx}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSplitCm((prev) => Math.max(0, prev - 1))}
                className="w-9 h-9 rounded-lg border-2 border-dark bg-white font-bold text-lg hover:bg-dark/5 active:scale-95 transition-all shrink-0"
              >
                -
              </button>
              <input
                type="number"
                min="0"
                max="60"
                value={splitCm}
                onChange={(e) => setSplitCm(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full border-2 border-dark rounded-lg px-3 py-1.5 font-mono font-bold text-center text-dark text-base bg-white focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                type="button"
                onClick={() => setSplitCm((prev) => prev + 1)}
                className="w-9 h-9 rounded-lg border-2 border-dark bg-white font-bold text-lg hover:bg-dark/5 active:scale-95 transition-all shrink-0"
              >
                +
              </button>
            </div>
          </div>

          {/* 4. Daya Tahan (STA) - Durasi Skipping / Jumping Jack */}
          <div className="p-3.5 bg-background border-2 border-dark rounded-xl flex flex-col gap-2">
            <div className="flex justify-between items-start gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">{ATTRIBUTE_CONFIG.skor_sta.icon}</span>
                <div>
                  <h4 className="font-bold text-dark text-sm">
                    {ATTRIBUTE_CONFIG.skor_sta.key} · Durasi Skipping / Kardio (Detik)
                  </h4>
                  <p className="text-[11px] text-dark/60">
                    &lt;60s (60) | 60-90s (72) | 91-120s (82) | &gt;120s (95)
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-dark/50 block">Skor STA</span>
                <span className="font-mono font-black text-lg text-cyan-600">
                  {calculatedScores.skor_sta}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSkippingSec((prev) => Math.max(0, prev - 5))}
                className="w-9 h-9 rounded-lg border-2 border-dark bg-white font-bold text-lg hover:bg-dark/5 active:scale-95 transition-all shrink-0"
              >
                -5
              </button>
              <input
                type="number"
                min="0"
                max="600"
                value={skippingSec}
                onChange={(e) => setSkippingSec(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full border-2 border-dark rounded-lg px-3 py-1.5 font-mono font-bold text-center text-dark text-base bg-white focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                type="button"
                onClick={() => setSkippingSec((prev) => prev + 5)}
                className="w-9 h-9 rounded-lg border-2 border-dark bg-white font-bold text-lg hover:bg-dark/5 active:scale-95 transition-all shrink-0"
              >
                +5
              </button>
            </div>
          </div>

          {/* 5. Teknik (TEC) - Rating Kerapihan Poomsae */}
          <div className="p-3.5 bg-background border-2 border-dark rounded-xl flex flex-col gap-2">
            <div className="flex justify-between items-start gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">{ATTRIBUTE_CONFIG.skor_tec.icon}</span>
                <div>
                  <h4 className="font-bold text-dark text-sm">
                    {ATTRIBUTE_CONFIG.skor_tec.key} · Form &amp; Akurasi Teknik (Bintang 1-5)
                  </h4>
                  <p className="text-[11px] text-dark/60">
                    1⭐=55 (Dasar) | 2⭐=65 | 3⭐=75 (Baik) | 4⭐=85 | 5⭐=95 (Master)
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-dark/50 block">Skor TEC</span>
                <span className="font-mono font-black text-lg text-purple-600">
                  {calculatedScores.skor_tec}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 sm:gap-3 py-2 bg-white rounded-xl border-2 border-dark">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setTechniqueStars(star)}
                  className={`px-3 py-1.5 rounded-lg border-2 border-dark font-black text-base sm:text-lg transition-transform active:scale-90 ${
                    techniqueStars >= star
                      ? 'bg-amber-400 text-dark shadow-[2px_2px_0px_#1E2A38]'
                      : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  ⭐ {star}
                </button>
              ))}
            </div>
          </div>

          {/* 6. Kedisiplinan (DIS) - Presensi & Sikap */}
          <div className="p-3.5 bg-background border-2 border-dark rounded-xl flex flex-col gap-2">
            <div className="flex justify-between items-start gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">{ATTRIBUTE_CONFIG.skor_dis.icon}</span>
                <div>
                  <h4 className="font-bold text-dark text-sm">
                    {ATTRIBUTE_CONFIG.skor_dis.key} · Kedisiplinan &amp; Nilai Sikap
                  </h4>
                  <p className="text-[11px] text-dark/60">
                    {totalSessions === 0
                      ? 'Formula: 100% Nilai Sikap Pelatih (Belum ada sesi absensi)'
                      : `Formula: (50% Presensi: ${attendancePercent}%) + (50% Sikap Pelatih)`}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-dark/50 block">Skor DIS</span>
                <span className="font-mono font-black text-lg text-blue-600">
                  {calculatedScores.skor_dis}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-dark whitespace-nowrap">Nilai Sikap:</span>
              <input
                type="range"
                min="50"
                max="100"
                value={attitudeScore}
                onChange={(e) => setAttitudeScore(parseInt(e.target.value) || 85)}
                className="w-full accent-primary cursor-pointer"
              />
              <span className="font-mono font-bold text-dark text-sm w-10 text-right">
                {attitudeScore}
              </span>
            </div>
          </div>
        </div>

        {/* Live Calculation Preview Footer */}
        <div className="bg-slate-50 border-2 border-dark rounded-xl p-3 shrink-0 flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <div
                className="px-3 py-1 rounded-lg border-2 border-dark font-black font-mono text-xl sm:text-2xl text-dark"
                style={{ backgroundColor: ovrTier.color }}
              >
                {ovr}
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-dark/60 block">
                  Proyeksi OVR &amp; Archetype
                </span>
                <span className="font-bold text-dark text-sm sm:text-base">
                  {archetype}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-0.5 rounded-full font-bold border border-dark bg-white text-dark">
                {ovrTier.badge}
              </span>
            </div>
          </div>

          {/* Mini 6 Atribut Pill */}
          <div className="grid grid-cols-6 gap-1 text-center font-mono text-xs">
            <div className="bg-white p-1 rounded border border-dark/20">
              <span className="text-[9px] block text-dark/50 font-sans font-bold">STR</span>
              <strong className="text-rose-600">{calculatedScores.skor_str}</strong>
            </div>
            <div className="bg-white p-1 rounded border border-dark/20">
              <span className="text-[9px] block text-dark/50 font-sans font-bold">AGI</span>
              <strong className="text-amber-600">{calculatedScores.skor_agi}</strong>
            </div>
            <div className="bg-white p-1 rounded border border-dark/20">
              <span className="text-[9px] block text-dark/50 font-sans font-bold">FLX</span>
              <strong className="text-emerald-600">{calculatedScores.skor_flx}</strong>
            </div>
            <div className="bg-white p-1 rounded border border-dark/20">
              <span className="text-[9px] block text-dark/50 font-sans font-bold">STA</span>
              <strong className="text-cyan-600">{calculatedScores.skor_sta}</strong>
            </div>
            <div className="bg-white p-1 rounded border border-dark/20">
              <span className="text-[9px] block text-dark/50 font-sans font-bold">TEC</span>
              <strong className="text-purple-600">{calculatedScores.skor_tec}</strong>
            </div>
            <div className="bg-white p-1 rounded border border-dark/20">
              <span className="text-[9px] block text-dark/50 font-sans font-bold">DIS</span>
              <strong className="text-blue-600">{calculatedScores.skor_dis}</strong>
            </div>
          </div>
        </div>

        {/* Modal Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-dark/10 shrink-0">
          <Button variant="secondary" onClick={onClose} type="button" className="text-xs py-2 px-4">
            Batal
          </Button>
          <Button variant="primary" onClick={handleApply} type="button" className="text-xs py-2 px-5 font-black">
            ✅ Terapkan Skor ke Raport
          </Button>
        </div>
      </div>
    </div>
  )
}

