'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
const supabase = createClient()
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import Link from 'next/link'

const BULAN_NAMES = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

function formatRupiah(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
}

interface MismatchedItem {
  id: string
  siswa_id: string
  siswa_nama: string
  program_nama: string
  nominal_lama: number
  nominal_baru: number
}

export default function AdminIuranGeneratePage() {
  const now = new Date()

  const [bulan, setBulan] = useState(String(now.getMonth() + 1).padStart(2, '0'))
  const [tahun, setTahun] = useState(String(now.getFullYear()))
  
  const [loading, setLoading] = useState(false)
  const [countSiswa, setCountSiswa] = useState(0)
  const [readySiswa, setReadySiswa] = useState<any[]>([])
  const [mismatchedList, setMismatchedList] = useState<MismatchedItem[]>([])
  const [generating, setGenerating] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const checkSiswaWithoutIuran = useCallback(async () => {
    setLoading(true)
    setError(null)
    setSuccessMsg(null)

    const bulanInt = parseInt(bulan)
    const tahunInt = parseInt(tahun)

    try {
      // 1. Ambil semua siswa aktif
      const { data: siswaData, error: siswaErr } = await supabase
        .from('siswa')
        .select('id, nama, program_kelas_id, program_kelas:program_kelas_id(nama_program, biaya_bulanan)')
        .eq('status_aktif', true)

      if (siswaErr) throw siswaErr

      // 2. Ambil iuran untuk bulan & tahun terpilih
      const { data: iuranData, error: iuranErr } = await supabase
        .from('iuran')
        .select('id, siswa_id, nominal, status_bayar')
        .eq('bulan', bulanInt)
        .eq('tahun', tahunInt)

      if (iuranErr) throw iuranErr

      const existingSiswaIds = new Set((iuranData || []).map(i => i.siswa_id))
      
      // Filter siswa aktif yang belum punya iuran bulan ini
      const withoutIuran = (siswaData || []).filter(s => !existingSiswaIds.has(s.id))

      setReadySiswa(withoutIuran)
      setCountSiswa(withoutIuran.length)

      // Deteksi siswa yang sudah punya iuran belum bayar, tapi nominalnya berbeda dari kelas saat ini
      const siswaMap = new Map((siswaData || []).map(s => [s.id, s]))
      const mismatched: MismatchedItem[] = []

      for (const iur of iuranData || []) {
        if (iur.status_bayar === 'belum_bayar' || iur.status_bayar === 'ditolak') {
          const s = siswaMap.get(iur.siswa_id)
          if (s) {
            const currentProg = s.program_kelas as any
            const targetNominal = Number(currentProg?.biaya_bulanan || 100000)
            if (Number(iur.nominal) !== targetNominal) {
              mismatched.push({
                id: iur.id,
                siswa_id: s.id,
                siswa_nama: s.nama,
                program_nama: currentProg?.nama_program || 'Umum',
                nominal_lama: Number(iur.nominal),
                nominal_baru: targetNominal,
              })
            }
          }
        }
      }

      setMismatchedList(mismatched)
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan saat memeriksa data.')
    } finally {
      setLoading(false)
    }
  }, [bulan, tahun])

  useEffect(() => {
    checkSiswaWithoutIuran()
  }, [checkSiswaWithoutIuran])

  const handleGenerate = async () => {
    if (readySiswa.length === 0) return
    setGenerating(true)
    setError(null)

    const bulanInt = parseInt(bulan)
    const tahunInt = parseInt(tahun)

    const rows = readySiswa.map(s => ({
      siswa_id: s.id,
      bulan: bulanInt,
      tahun: tahunInt,
      nominal: s.program_kelas?.biaya_bulanan || 100000,
      status_bayar: 'belum_bayar',
    }))

    try {
      const { error: insertErr } = await supabase.from('iuran').insert(rows)
      if (insertErr) throw insertErr

      setSuccessMsg(`✅ Berhasil men-generate ${rows.length} tagihan untuk bulan ${BULAN_NAMES[bulanInt]} ${tahunInt}!`)
      await checkSiswaWithoutIuran()
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan data iuran.')
    } finally {
      setGenerating(false)
    }
  }

  const handleSyncMismatched = async () => {
    if (mismatchedList.length === 0) return
    setSyncing(true)
    setError(null)

    try {
      for (const item of mismatchedList) {
        const { error: updErr } = await supabase
          .from('iuran')
          .update({ nominal: item.nominal_baru })
          .eq('id', item.id)
        if (updErr) throw updErr
      }

      setSuccessMsg(`✅ Berhasil memperbarui tarif tagihan untuk ${mismatchedList.length} siswa sesuai kelas saat ini!`)
      await checkSiswaWithoutIuran()
    } catch (err: any) {
      setError(err.message || 'Gagal menyinkronkan tarif iuran.')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto flex flex-col gap-8">
      <div>
        <Link href="/admin/iuran" className="text-sm font-bold text-dark hover:underline">
          ← Kembali ke Kelola Iuran
        </Link>
        <h1 className="text-3xl font-bold font-sans text-dark mt-2">⚡ Generate & Sinkron Tagihan</h1>
        <p className="text-dark/60 font-sans mt-1">Buat tagihan iuran baru secara otomatis dan sinkronkan tarif kelas siswa.</p>
      </div>

      <Card className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <label className="font-bold text-dark">Bulan</label>
            <select
              value={bulan}
              onChange={e => setBulan(e.target.value)}
              className="border-2 border-dark rounded-2xl px-4 py-3 bg-white text-dark focus:outline-none focus:ring-2 focus:ring-primary font-sans"
            >
              {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map(m => (
                <option key={m} value={m}>{BULAN_NAMES[parseInt(m)]}</option>
              ))}
            </select>
          </div>
          <Input
            label="Tahun"
            type="number"
            value={tahun}
            onChange={e => setTahun(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="text-center py-6 text-dark/50 font-bold font-sans">Memeriksa data...</div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="p-4 border-2 border-dark rounded-2xl bg-background text-dark">
              <div className="flex justify-between items-center">
                <span className="font-sans text-dark/70">Siswa Aktif Tanpa Tagihan:</span>
                <span className="font-bold font-sans text-xl">{countSiswa} siswa</span>
              </div>
              {countSiswa > 0 && (
                <p className="text-xs text-dark/50 mt-2 font-sans">
                  Tagihan akan dibuat otomatis berdasarkan tarif program kelas masing-masing siswa.
                </p>
              )}
            </div>

            {mismatchedList.length > 0 && (
              <div className="p-4 border-2 border-accent rounded-2xl bg-accent/10 text-dark flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <span className="font-bold font-sans text-accent">⚠️ Perubahan Kelas Terdeteksi:</span>
                  <Badge color="accent">{mismatchedList.length} tagihan tidak sesuai</Badge>
                </div>
                <p className="text-xs text-dark/80 font-sans">
                  Ada {mismatchedList.length} siswa yang berpindah kelas (misal dari Umum ke Prestasi) namun tagihan belum bayar masih tertera tarif lama.
                </p>
                <div className="max-h-36 overflow-y-auto flex flex-col gap-1.5 text-xs bg-white/60 p-2.5 rounded-xl border border-dark/20">
                  {mismatchedList.map(m => (
                    <div key={m.id} className="flex justify-between items-center">
                      <span className="font-bold text-dark">{m.siswa_nama} ({m.program_nama})</span>
                      <span className="text-dark/70 font-mono">
                        {formatRupiah(m.nominal_lama)} ➔ <strong className="text-primary">{formatRupiah(m.nominal_baru)}</strong>
                      </span>
                    </div>
                  ))}
                </div>
                <Button
                  variant="accent"
                  onClick={handleSyncMismatched}
                  disabled={syncing || loading}
                  className="w-full text-sm py-2.5 font-bold"
                >
                  {syncing ? '⏳ Menyinkronkan...' : `🔄 Perbarui Tarif ${mismatchedList.length} Tagihan Sekarang`}
                </Button>
              </div>
            )}
          </div>
        )}

        {error && <p className="text-accent font-bold font-sans text-sm">⚠️ {error}</p>}
        {successMsg && <p className="text-primary font-bold font-sans text-sm">{successMsg}</p>}

        <Button
          variant="primary"
          onClick={handleGenerate}
          disabled={countSiswa === 0 || generating || loading}
          className="w-full text-lg py-4"
        >
          {generating ? '⏳ Menyimpan Tagihan...' : '⚡ Generate Tagihan'}
        </Button>
      </Card>
    </div>
  )
}

