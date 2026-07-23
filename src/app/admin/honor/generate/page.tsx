'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
const supabase = createClient()
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import Link from 'next/link'

const BULAN_NAMES = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

function formatRupiah(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
}

interface CoachHonorPreview {
  pelatih_id: string
  nama: string
  jumlah_sesi_mengajar: number
  honor_diterima: number
}

export default function AdminHonorGeneratePage() {
  const now = new Date()

  const [bulan, setBulan] = useState(String(now.getMonth() + 1).padStart(2, '0'))
  const [tahun, setTahun] = useState(String(now.getFullYear()))

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Calculation parameters & results
  const [persentasePool, setPersentasePool] = useState(40)
  const [totalIuranTerkumpul, setTotalIuranTerkumpul] = useState(0)
  const [totalPoolHonor, setTotalPoolHonor] = useState(0)
  const [totalSesiSemuaPelatih, setTotalSesiSemuaPelatih] = useState(0)
  const [previews, setPreviews] = useState<CoachHonorPreview[]>([])

  const calculatePreview = useCallback(async () => {
    setLoading(true)
    setError(null)
    setSuccessMsg(null)

    const bulanInt = parseInt(bulan)
    const tahunInt = parseInt(tahun)
    const startDate = `${tahunInt}-${String(bulanInt).padStart(2, '0')}-01`
    const endDate = new Date(tahunInt, bulanInt, 0).toLocaleDateString('sv-SE')

    try {
      // 1. Dapatkan persentase pool dari pengaturan
      const { data: pengaturan } = await supabase.from('pengaturan_club').select('persentase_pool_honor').limit(1)
      const currentPct = pengaturan?.[0]?.persentase_pool_honor ?? 40
      setPersentasePool(currentPct)

      // 2. Hitung total iuran lunas bulan berjalan
      const { data: iuranData, error: iuranErr } = await supabase
        .from('iuran')
        .select('nominal')
        .eq('bulan', bulanInt)
        .eq('tahun', tahunInt)
        .eq('status_bayar', 'lunas')

      if (iuranErr) throw iuranErr
      
      const totalIuran = (iuranData || []).reduce((sum, item) => sum + Number(item.nominal), 0)
      setTotalIuranTerkumpul(totalIuran)

      const poolHonor = (totalIuran * currentPct) / 100
      setTotalPoolHonor(poolHonor)

      // 3. Ambil absensi_pelatih untuk bulan terpilih
      const { data: absensiPelatih, error: absensiErr } = await supabase
        .from('absensi_pelatih')
        .select('pelatih_id')
        .gte('tgl', startDate)
        .lte('tgl', endDate)

      if (absensiErr) throw absensiErr

      const totalSesi = absensiPelatih?.length || 0
      setTotalSesiSemuaPelatih(totalSesi)

      // 4. Ambil list pelatih aktif
      const { data: pelatihData, error: pelatihErr } = await supabase
        .from('pelatih')
        .select('id, nama')
        .eq('status_aktif', true)

      if (pelatihErr) throw pelatihErr

      // 5. Kalkulasikan proporsi honor masing-masing pelatih
      const sesiCountMap: Record<string, number> = {}
      absensiPelatih?.forEach(a => {
        sesiCountMap[a.pelatih_id] = (sesiCountMap[a.pelatih_id] || 0) + 1
      })

      const coachPreviews: CoachHonorPreview[] = (pelatihData || []).map(p => {
        const sesi = sesiCountMap[p.id] || 0
        const honor = totalSesi > 0 ? (sesi / totalSesi) * poolHonor : 0
        return {
          pelatih_id: p.id,
          nama: p.nama,
          jumlah_sesi_mengajar: sesi,
          honor_diterima: Math.round(honor),
        }
      })

      setPreviews(coachPreviews)
    } catch (err: any) {
      setError(err.message || 'Gagal menghitung honor.')
    } finally {
      setLoading(false)
    }
  }, [bulan, tahun])

  useEffect(() => {
    calculatePreview()
  }, [calculatePreview])

  const handleSimpanHonor = async () => {
    if (previews.length === 0) return
    setSaving(true)
    setError(null)

    const bulanInt = parseInt(bulan)
    const tahunInt = parseInt(tahun)

    const rows = previews.map(p => ({
      pelatih_id: p.pelatih_id,
      bulan: bulanInt,
      tahun: tahunInt,
      jumlah_sesi_mengajar: p.jumlah_sesi_mengajar,
      total_sesi_semua_pelatih: totalSesiSemuaPelatih,
      total_iuran_terkumpul_bulan: totalIuranTerkumpul,
      persentase_pool_dipakai: persentasePool,
      total_pool_honor: totalPoolHonor,
      honor_diterima: p.honor_diterima,
      status_dibayar: false,
    }))

    try {
      const { error: insertErr } = await supabase
        .from('honor_pelatih')
        .upsert(rows, { onConflict: 'pelatih_id,bulan,tahun' })

      if (insertErr) throw insertErr

      setSuccessMsg(`✅ Honor pelatih untuk bulan ${BULAN_NAMES[bulanInt]} ${tahunInt} berhasil disimpan!`)
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan honor pelatih.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-8">
      <div>
        <Link href="/admin/honor" className="text-sm font-bold text-dark hover:underline">
          ← Kembali ke Honor Pelatih
        </Link>
        <h1 className="text-3xl font-bold font-sans text-dark mt-2">⚡ Hitung & Generate Honor</h1>
        <p className="text-dark/60 font-sans mt-1">Kalkulasikan proporsi honor mengajar pelatih berdasarkan iuran terkumpul.</p>
      </div>

      <Card>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 items-end">
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
          <Button variant="secondary" onClick={calculatePreview} disabled={loading}>
            {loading ? 'Menghitung...' : '🔍 Hitung Ulang'}
          </Button>
        </div>
      </Card>

      {/* Summary Cards */}
      {!loading && previews.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="bg-background text-dark border-2 border-dark text-center p-4">
            <div className="text-xl font-bold font-sans">{formatRupiah(totalIuranTerkumpul)}</div>
            <div className="text-xs text-dark/60 font-sans mt-1">Iuran Terkumpul (Lunas)</div>
          </Card>
          <Card className="bg-background text-dark border-2 border-dark text-center p-4">
            <div className="text-xl font-bold font-sans">{persentasePool}% / {formatRupiah(totalPoolHonor)}</div>
            <div className="text-xs text-dark/60 font-sans mt-1">Pool Honor ({persentasePool}%)</div>
          </Card>
          <Card className="bg-background text-dark border-2 border-dark text-center p-4">
            <div className="text-xl font-bold font-sans">{totalSesiSemuaPelatih} sesi</div>
            <div className="text-xs text-dark/60 font-sans mt-1">Total Sesi Mengajar</div>
          </Card>
        </div>
      )}

      {/* Preview Table */}
      {loading ? (
        <Card className="text-center py-12 text-dark/50 font-sans">Mengkalkulasikan data...</Card>
      ) : previews.length === 0 ? (
        <Card className="text-center py-12 text-dark/50 font-sans">Tidak ada data untuk periode ini.</Card>
      ) : (
        <div className="flex flex-col gap-4">
          <Card>
            <h2 className="font-bold font-sans text-dark text-lg mb-4">Pratinjau Honor Pelatih</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm font-sans">
                <thead>
                  <tr className="border-b-2 border-dark">
                    <th className="text-left py-2 px-3 font-bold text-dark">Nama Pelatih</th>
                    <th className="text-center py-2 px-3 font-bold text-dark">Jumlah Sesi</th>
                    <th className="text-center py-2 px-3 font-bold text-dark">Rasio Sesi</th>
                    <th className="text-right py-2 px-3 font-bold text-dark">Estimasi Honor</th>
                  </tr>
                </thead>
                <tbody>
                  {previews.map(p => {
                    const ratio = totalSesiSemuaPelatih > 0 ? (p.jumlah_sesi_mengajar / totalSesiSemuaPelatih) * 100 : 0
                    return (
                      <tr key={p.pelatih_id} className="border-b border-dark/10 hover:bg-background transition-colors">
                        <td className="py-3 px-3 font-bold text-dark">{p.nama}</td>
                        <td className="py-3 px-3 text-center text-dark">{p.jumlah_sesi_mengajar}</td>
                        <td className="py-3 px-3 text-center text-dark/60">{ratio.toFixed(1)}%</td>
                        <td className="py-3 px-3 text-right font-bold text-dark">{formatRupiah(p.honor_diterima)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {error && <p className="text-accent font-bold font-sans text-sm">⚠️ {error}</p>}
          {successMsg && <p className="text-primary font-bold font-sans text-sm">{successMsg}</p>}

          <Button
            variant="primary"
            onClick={handleSimpanHonor}
            disabled={saving || previews.length === 0}
            className="w-full text-lg py-4"
          >
            {saving ? '⏳ Menyimpan...' : '💾 Simpan & Terbitkan Honor'}
          </Button>
        </div>
      )}
    </div>
  )
}
