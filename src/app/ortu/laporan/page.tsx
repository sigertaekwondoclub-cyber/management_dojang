'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'

const supabase = createClient()

const BULAN_NAMES = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

function formatRupiah(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
}

export default function OrtuLaporanPage() {
  const now = new Date()
  const [filterBulan, setFilterBulan] = useState(String(now.getMonth() + 1).padStart(2, '0'))
  const [filterTahun, setFilterTahun] = useState(String(now.getFullYear()))
  const [loading, setLoading] = useState(true)
  const [namaSiswa, setNamaSiswa] = useState('')
  const [siswaId, setSiswaId] = useState<string | null>(null)
  const [absensi, setAbsensi] = useState({ hadir: 0, izin: 0, sakit: 0, alpha: 0, total: 0, persen: 0 })
  const [iuran, setIuran] = useState<{ status_bayar: string; nominal: number } | null>(null)

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase
        .from('profiles').select('siswa_id, nama').eq('id', user.id).single()
      if (profile?.siswa_id) {
        setSiswaId(profile.siswa_id)
        const { data: siswaData } = await supabase
          .from('siswa').select('nama').eq('id', profile.siswa_id).single()
        setNamaSiswa(siswaData?.nama || profile.nama || '')
      } else {
        setNamaSiswa(profile?.nama || '')
        setLoading(false)
      }
    }
    fetchProfile()
  }, [])

  const fetchData = useCallback(async () => {
    if (!siswaId) return
    setLoading(true)
    const tah = parseInt(filterTahun)
    const { data: absensiRows } = await supabase
      .from('absensi_siswa').select('status_hadir')
      .eq('siswa_id', siswaId)
      .gte('tgl', `${tah}-${filterBulan}-01`)
      .lte('tgl', `${tah}-${filterBulan}-31`)
    const rows = absensiRows || []
    const hadir = rows.filter(r => r.status_hadir === 'hadir').length
    const izin = rows.filter(r => r.status_hadir === 'izin').length
    const sakit = rows.filter(r => r.status_hadir === 'sakit').length
    const alpha = rows.filter(r => r.status_hadir === 'alpha').length
    const total = rows.length
    setAbsensi({ hadir, izin, sakit, alpha, total, persen: total > 0 ? Math.round(hadir / total * 100) : 0 })
    const { data: iuranData } = await supabase
      .from('iuran').select('status_bayar, nominal')
      .eq('siswa_id', siswaId)
      .eq('bulan', parseInt(filterBulan))
      .eq('tahun', tah)
      .maybeSingle()
    setIuran(iuranData)
    setLoading(false)
  }, [siswaId, filterBulan, filterTahun])

  useEffect(() => { if (siswaId) fetchData() }, [fetchData, siswaId])

  const handleShareWA = () => {
    const bul = BULAN_NAMES[parseInt(filterBulan)]
    const statusLabel: Record<string, string> = {
      lunas: '✅ LUNAS', belum_bayar: '❌ BELUM BAYAR',
      menunggu_verifikasi: '🔍 MENUNGGU VERIFIKASI', ditolak: '❌ DITOLAK'
    }
    const teks = `📊 *REKAP SIGER TAEKWONDO*\n👤 *${namaSiswa}*\n📅 Periode: ${bul} ${filterTahun}\n\n✅ *KEHADIRAN LATIHAN*\n• Hadir: ${absensi.hadir}x dari ${absensi.total} sesi${absensi.total > 0 ? ` (${absensi.persen}%)` : ''}\n• Izin: ${absensi.izin}x | Sakit: ${absensi.sakit}x | Alpha: ${absensi.alpha}x\n\n💰 *STATUS IURAN*\n• ${bul} ${filterTahun}: ${iuran ? (statusLabel[iuran.status_bayar] || iuran.status_bayar) : '❌ BELUM ADA DATA'}${iuran?.nominal ? ` (${formatRupiah(iuran.nominal)})` : ''}\n\nSiger Taekwondo Club 🥋`
    window.open(`https://wa.me/?text=${encodeURIComponent(teks)}`, '_blank')
  }

  const statusConfig: Record<string, { label: string; cls: string }> = {
    lunas: { label: '✅ Lunas', cls: 'text-green-700 bg-green-50 border-green-200' },
    belum_bayar: { label: '❌ Belum Bayar', cls: 'text-red-600 bg-red-50 border-red-200' },
    menunggu_verifikasi: { label: '🔍 Menunggu Verifikasi', cls: 'text-yellow-700 bg-yellow-50 border-yellow-200' },
    ditolak: { label: '❌ Ditolak', cls: 'text-red-600 bg-red-50 border-red-200' },
  }

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6 pb-10">
      <div>
        <h1 className="text-3xl font-bold font-sans text-dark">📄 Laporan Perkembangan</h1>
        <p className="text-dark/60 font-sans mt-1">
          Rekap kehadiran dan iuran {namaSiswa && <b>{namaSiswa}</b>}
        </p>
      </div>

      <Card>
        <div className="flex gap-4 flex-wrap items-end">
          <div className="flex flex-col gap-2">
            <label className="font-bold text-dark text-sm">Bulan</label>
            <select value={filterBulan} onChange={e => setFilterBulan(e.target.value)}
              className="border-2 border-dark rounded-2xl px-4 py-3 bg-white text-dark focus:outline-none focus:ring-2 focus:ring-primary font-sans min-w-[140px]">
              {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map(m => (
                <option key={m} value={m}>{BULAN_NAMES[parseInt(m)]}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label className="font-bold text-dark text-sm">Tahun</label>
            <input type="number" value={filterTahun} onChange={e => setFilterTahun(e.target.value)}
              className="border-2 border-dark rounded-2xl px-4 py-3 bg-white text-dark focus:outline-none focus:ring-2 focus:ring-primary font-sans w-[100px]" />
          </div>
        </div>
      </Card>

      {loading ? (
        <Card className="text-center py-16 text-dark/50">Memuat data laporan...</Card>
      ) : (
        <>
          <Card>
            <h2 className="font-bold text-dark text-lg mb-4">📅 Kehadiran Latihan — {BULAN_NAMES[parseInt(filterBulan)]} {filterTahun}</h2>
            {absensi.total === 0 ? (
              <p className="text-dark/50 text-sm">Belum ada data absensi untuk periode ini.</p>
            ) : (
              <div className="flex items-start gap-6 flex-wrap">
                <div className="relative w-28 h-28 shrink-0">
                  <svg viewBox="0 0 36 36" className="w-28 h-28 -rotate-90">
                    <circle cx="18" cy="18" r="15.915" fill="none" stroke="#f1f5f9" strokeWidth="3.5" />
                    <circle cx="18" cy="18" r="15.915" fill="none" stroke="#22c55e" strokeWidth="3.5"
                      strokeDasharray={`${absensi.persen} ${100 - absensi.persen}`} strokeLinecap="round" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-dark leading-none">{absensi.persen}%</span>
                    <span className="text-[10px] text-dark/40 font-bold uppercase">hadir</span>
                  </div>
                </div>
                <div className="flex flex-col gap-3 py-1">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-green-500 shrink-0" />
                    <span className="text-sm font-sans text-dark"><b className="text-green-700">{absensi.hadir}x</b> Hadir</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-blue-400 shrink-0" />
                    <span className="text-sm font-sans text-dark"><b className="text-blue-600">{absensi.izin}x</b> Izin</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-yellow-400 shrink-0" />
                    <span className="text-sm font-sans text-dark"><b className="text-yellow-600">{absensi.sakit}x</b> Sakit</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-red-400 shrink-0" />
                    <span className="text-sm font-sans text-dark"><b className="text-red-600">{absensi.alpha}x</b> Alpha</span>
                  </div>
                  <p className="text-xs text-dark/40 mt-1">Total {absensi.total} sesi tercatat</p>
                </div>
              </div>
            )}
          </Card>

          <Card>
            <h2 className="font-bold text-dark text-lg mb-4">💰 Status Iuran — {BULAN_NAMES[parseInt(filterBulan)]} {filterTahun}</h2>
            {!iuran ? (
              <p className="text-dark/50 text-sm">Belum ada tagihan iuran untuk periode ini.</p>
            ) : (
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <span className={`px-4 py-2 rounded-2xl font-bold text-sm border-2 ${statusConfig[iuran.status_bayar]?.cls || 'text-dark bg-background border-dark/10'}`}>
                  {statusConfig[iuran.status_bayar]?.label || iuran.status_bayar}
                </span>
                <div className="text-2xl font-bold font-sans text-dark">{formatRupiah(iuran.nominal)}</div>
              </div>
            )}
          </Card>

          <button onClick={handleShareWA}
            className="w-full flex items-center justify-center gap-3 bg-green-500 hover:bg-green-600 active:bg-green-700 text-white py-4 rounded-2xl font-bold text-base transition-colors shadow-lg">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Bagikan Laporan via WhatsApp
          </button>
        </>
      )}
    </div>
  )
}
