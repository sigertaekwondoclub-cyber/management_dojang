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

type Tab = 'keuangan' | 'kehadiran' | 'honor' | 'anggota' | 'prestasi' | 'ortu'

interface SiswaRekap {
  id: string
  nama: string
  no_hp_ortu: string
  hadir: number
  izin: number
  sakit: number
  alpha: number
  totalSesi: number
  persen: number
  statusIuran: string
  nominalIuran: number
}

export default function AdminLaporanPage() {
  const now = new Date()
  const [activeTab, setActiveTab] = useState<Tab>('keuangan')
  const [filterBulan, setFilterBulan] = useState(String(now.getMonth() + 1).padStart(2, '0'))
  const [filterTahun, setFilterTahun] = useState(String(now.getFullYear()))
  const [loading, setLoading] = useState(false)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [keuanganData, setKeuanganData] = useState<any[]>([])
  const [kehadiranData, setKehadiranData] = useState<{ nama: string; hadir: number; izin: number; sakit: number; alpha: number }[]>([])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [honorData, setHonorData] = useState<any[]>([])
  const [anggotaData, setAnggotaData] = useState<{ aktif: number; baru: number; nonaktif: number; list: { id: string; nama: string; tgl_gabung: string; status_aktif: boolean }[] }>({ aktif: 0, baru: 0, nonaktif: 0, list: [] })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [prestasiData, setPrestasiData] = useState<any[]>([])
  const [ortuData, setOrtuData] = useState<SiswaRekap[]>([])

  const fetchKeuangan = useCallback(async () => {
    const bul = parseInt(filterBulan)
    const tah = parseInt(filterTahun)
    const { data: iuranRows } = await supabase
      .from('iuran')
      .select('nominal, status_bayar, siswa:siswa_id(nama)')
      .eq('bulan', bul).eq('tahun', tah)
    const { data: transaksi } = await supabase
      .from('transaksi_keuangan')
      .select('*')
      .gte('tgl', `${tah}-${filterBulan}-01`)
      .lte('tgl', `${tah}-${filterBulan}-31`)
      .order('tgl', { ascending: true })
    setKeuanganData([{ iuranRows: iuranRows || [], transaksi: transaksi || [] }])
  }, [filterBulan, filterTahun])

  const fetchKehadiran = useCallback(async () => {
    const tah = parseInt(filterTahun)
    const { data } = await supabase
      .from('absensi_siswa')
      .select('siswa_id, status_hadir, siswa:siswa_id(nama)')
      .gte('tgl', `${tah}-${filterBulan}-01`)
      .lte('tgl', `${tah}-${filterBulan}-31`)
    const grouped: Record<string, { nama: string; hadir: number; izin: number; sakit: number; alpha: number }> = {}
    for (const row of (data || [])) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nama = (row.siswa as any)?.nama || 'Unknown'
      if (!grouped[row.siswa_id]) grouped[row.siswa_id] = { nama, hadir: 0, izin: 0, sakit: 0, alpha: 0 }
      grouped[row.siswa_id][row.status_hadir as 'hadir' | 'izin' | 'sakit' | 'alpha']++
    }
    setKehadiranData(Object.values(grouped).sort((a, b) => b.hadir - a.hadir))
  }, [filterBulan, filterTahun])

  const fetchHonor = useCallback(async () => {
    const bul = parseInt(filterBulan)
    const tah = parseInt(filterTahun)
    const { data: runData } = await supabase
      .from('payroll_runs')
      .select('*, payroll_details(*, pelatih:pelatih_id(nama, role))')
      .eq('bulan', bul).eq('tahun', tah)
      .maybeSingle()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setHonorData(runData ? [runData as any] : [])
  }, [filterBulan, filterTahun])

  const fetchAnggota = useCallback(async () => {
    const tah = parseInt(filterTahun)
    const { data: all } = await supabase.from('siswa').select('id, nama, tgl_gabung, status_aktif')
    const rows = all || []
    const aktif = rows.filter(s => s.status_aktif)
    const baru = aktif.filter(s => s.tgl_gabung >= `${tah}-01-01` && s.tgl_gabung <= `${tah}-12-31`)
    const nonaktif = rows.filter(s => !s.status_aktif)
    setAnggotaData({ aktif: aktif.length, baru: baru.length, nonaktif: nonaktif.length, list: rows })
  }, [filterTahun])

  const fetchPrestasi = useCallback(async () => {
    const { data } = await supabase
      .from('prestasi')
      .select('*, siswa:siswa_id(nama)')
      .order('tgl_event', { ascending: false })
    setPrestasiData(data || [])
  }, [])

  const fetchOrtu = useCallback(async () => {
    const bul = parseInt(filterBulan)
    const tah = parseInt(filterTahun)
    const { data: siswaList } = await supabase
      .from('siswa')
      .select('id, nama, no_hp_ortu')
      .eq('status_aktif', true)
      .order('nama')
    if (!siswaList) return
    const siswaIds = siswaList.map(s => s.id)
    const { data: absensiRows } = await supabase
      .from('absensi_siswa')
      .select('siswa_id, status_hadir')
      .in('siswa_id', siswaIds)
      .gte('tgl', `${tah}-${filterBulan}-01`)
      .lte('tgl', `${tah}-${filterBulan}-31`)
    const { data: iuranRows } = await supabase
      .from('iuran')
      .select('siswa_id, status_bayar, nominal')
      .in('siswa_id', siswaIds)
      .eq('bulan', bul).eq('tahun', tah)
    const merged: SiswaRekap[] = siswaList.map(s => {
      const abs = (absensiRows || []).filter(a => a.siswa_id === s.id)
      const iuran = (iuranRows || []).find(i => i.siswa_id === s.id)
      const hadir = abs.filter(a => a.status_hadir === 'hadir').length
      const total = abs.length
      return {
        ...s,
        hadir,
        izin: abs.filter(a => a.status_hadir === 'izin').length,
        sakit: abs.filter(a => a.status_hadir === 'sakit').length,
        alpha: abs.filter(a => a.status_hadir === 'alpha').length,
        totalSesi: total,
        persen: total > 0 ? Math.round((hadir / total) * 100) : 0,
        statusIuran: iuran?.status_bayar || 'belum_bayar',
        nominalIuran: iuran?.nominal || 0,
      }
    })
    setOrtuData(merged)
  }, [filterBulan, filterTahun])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    await Promise.all([fetchKeuangan(), fetchKehadiran(), fetchHonor(), fetchAnggota(), fetchPrestasi(), fetchOrtu()])
    setLoading(false)
  }, [fetchKeuangan, fetchKehadiran, fetchHonor, fetchAnggota, fetchPrestasi, fetchOrtu])

  useEffect(() => { fetchAll() }, [fetchAll])

  const downloadCSV = (filename: string, rows: (string | number)[][], headers: string[]) => {
    const content = [headers, ...rows]
      .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
  }

  const handleDownloadCSV = () => {
    const bul = BULAN_NAMES[parseInt(filterBulan)]
    if (activeTab === 'kehadiran') {
      downloadCSV(`kehadiran-${bul}-${filterTahun}.csv`,
        kehadiranData.map(s => {
          const total = s.hadir + s.izin + s.sakit + s.alpha
          return [s.nama, s.hadir, s.izin, s.sakit, s.alpha, total, total > 0 ? `${Math.round(s.hadir / total * 100)}%` : '0%']
        }),
        ['Nama Siswa', 'Hadir', 'Izin', 'Sakit', 'Alpha', 'Total Sesi', '% Kehadiran']
      )
    } else if (activeTab === 'prestasi') {
      downloadCSV(`prestasi-${filterTahun}.csv`,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        prestasiData.map((p: any) => [(p.siswa as any)?.nama || '', p.nama_event, p.kategori || '', p.peringkat || '', p.medali || '-', p.tgl_event]),
        ['Nama Siswa', 'Nama Event', 'Kategori', 'Peringkat', 'Medali', 'Tanggal']
      )
    } else if (activeTab === 'honor') {
      const run = honorData[0]
      if (!run) return
      downloadCSV(`honor-pelatih-${bul}-${filterTahun}.csv`,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (run.payroll_details || []).map((d: any) => [d.pelatih?.nama || '', d.pelatih?.role || '', d.teaching_honor || 0, d.founder_margin_share || 0, d.total_payout || 0, d.sudah_dibayar ? 'Sudah Dibayar' : 'Belum']),
        ['Nama Pelatih', 'Role', 'Honor Mengajar', 'Founder Share', 'Total Payout', 'Status']
      )
    } else if (activeTab === 'ortu') {
      downloadCSV(`rekap-ortu-${bul}-${filterTahun}.csv`,
        ortuData.map(s => [s.nama, s.no_hp_ortu, s.hadir, s.izin, s.sakit, s.alpha, `${s.persen}%`, s.statusIuran, s.nominalIuran]),
        ['Nama Siswa', 'No HP Ortu', 'Hadir', 'Izin', 'Sakit', 'Alpha', '% Kehadiran', 'Status Iuran', 'Nominal (Rp)']
      )
    }
  }

  const bukaWA = (siswa: SiswaRekap) => {
    const bul = BULAN_NAMES[parseInt(filterBulan)]
    const statusLabel: Record<string, string> = {
      lunas: '✅ LUNAS', belum_bayar: '❌ BELUM BAYAR',
      menunggu_verifikasi: '🔍 MENUNGGU VERIFIKASI', ditolak: '❌ DITOLAK'
    }
    const teks = `📊 *REKAP SIGER TAEKWONDO*\n👤 *${siswa.nama}*\n📅 Periode: ${bul} ${filterTahun}\n\n✅ *KEHADIRAN LATIHAN*\n• Hadir: ${siswa.hadir}x dari ${siswa.totalSesi} sesi${siswa.totalSesi > 0 ? ` (${siswa.persen}%)` : ''}\n• Izin: ${siswa.izin}x | Sakit: ${siswa.sakit}x | Alpha: ${siswa.alpha}x\n\n💰 *STATUS IURAN*\n• ${bul} ${filterTahun}: ${statusLabel[siswa.statusIuran] || siswa.statusIuran}${siswa.nominalIuran > 0 ? ` (${formatRupiah(siswa.nominalIuran)})` : ''}\n\nSiger Taekwondo Club 🥋`
    const noWA = siswa.no_hp_ortu.replace(/^0/, '62').replace(/\D/g, '')
    window.open(`https://wa.me/${noWA}?text=${encodeURIComponent(teks)}`, '_blank')
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'keuangan', label: '💰 Keuangan' },
    { key: 'kehadiran', label: '📅 Kehadiran' },
    { key: 'honor', label: '🏆 Honor Pelatih' },
    { key: 'anggota', label: '👤 Anggota' },
    { key: 'prestasi', label: '🎖️ Prestasi' },
    { key: 'ortu', label: '📤 Blast WA Ortu' },
  ]

  const iuranRows = keuanganData[0]?.iuranRows || []
  const transaksiRows = keuanganData[0]?.transaksi || []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const totalPemasukan = iuranRows.filter((r: any) => r.status_bayar === 'lunas').reduce((s: number, r: any) => s + r.nominal, 0)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const totalPengeluaran = transaksiRows.filter((r: any) => r.jenis === 'keluar').reduce((s: number, r: any) => s + r.nominal, 0)

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-6 pb-10">
      <div className="flex items-center justify-between flex-wrap gap-4 print:hidden">
        <div>
          <h1 className="text-3xl font-bold font-sans text-dark">📄 Laporan &amp; Rekap</h1>
          <p className="text-dark/60 font-sans mt-1">Rekap data untuk owner dan pengiriman laporan ke orang tua</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => window.print()}
            className="px-4 py-2 bg-dark text-white rounded-2xl font-bold text-sm border-2 border-dark hover:bg-dark/80 transition-colors">
            🖨️ Print / PDF
          </button>
          {(['kehadiran', 'prestasi', 'honor', 'ortu'] as Tab[]).includes(activeTab) && (
            <button onClick={handleDownloadCSV}
              className="px-4 py-2 bg-primary text-dark rounded-2xl font-bold text-sm border-2 border-primary hover:bg-primary/80 transition-colors">
              ⬇️ Download CSV
            </button>
          )}
        </div>
      </div>

      <div className="hidden print:block mb-4">
        <h1 className="text-2xl font-bold">📄 Laporan Siger Taekwondo Club</h1>
        <p className="text-sm text-gray-500">Periode: {BULAN_NAMES[parseInt(filterBulan)]} {filterTahun}</p>
        <hr className="mt-2" />
      </div>

      <Card className="print:hidden">
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

      <div className="flex gap-2 flex-wrap print:hidden">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 rounded-2xl font-bold font-sans text-sm transition-all border-2 ${activeTab === t.key ? 'bg-dark text-white border-dark' : 'bg-white text-dark border-dark/30 hover:border-dark'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <Card className="text-center py-16 text-dark/50 font-sans">Memuat data laporan...</Card>
      ) : (
        <>
          {activeTab === 'keuangan' && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="flex flex-col gap-1">
                  <div className="text-xs font-bold text-dark/50 uppercase tracking-wide">💵 Pemasukan Iuran</div>
                  <div className="text-2xl font-bold font-sans text-green-700">{formatRupiah(totalPemasukan)}</div>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  <div className="text-xs text-dark/40">{iuranRows.filter((r: any) => r.status_bayar === 'lunas').length} siswa lunas</div>
                </Card>
                <Card className="flex flex-col gap-1">
                  <div className="text-xs font-bold text-dark/50 uppercase tracking-wide">💸 Pengeluaran</div>
                  <div className="text-2xl font-bold font-sans text-red-600">{formatRupiah(totalPengeluaran)}</div>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  <div className="text-xs text-dark/40">{transaksiRows.filter((r: any) => r.jenis === 'keluar').length} transaksi</div>
                </Card>
                <Card className="flex flex-col gap-1">
                  <div className="text-xs font-bold text-dark/50 uppercase tracking-wide">🏦 Saldo Bersih</div>
                  <div className={`text-2xl font-bold font-sans ${totalPemasukan - totalPengeluaran >= 0 ? 'text-green-700' : 'text-red-600'}`}>{formatRupiah(totalPemasukan - totalPengeluaran)}</div>
                </Card>
              </div>
              <Card>
                <h2 className="font-bold text-dark mb-3">📋 Detail Iuran — {BULAN_NAMES[parseInt(filterBulan)]} {filterTahun}</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm font-sans">
                    <thead><tr className="border-b-2 border-dark/20">
                      <th className="text-left py-2 text-dark/60 font-bold">Nama Siswa</th>
                      <th className="text-right py-2 text-dark/60 font-bold">Nominal</th>
                      <th className="text-center py-2 text-dark/60 font-bold">Status</th>
                    </tr></thead>
                    <tbody>
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {iuranRows.map((r: any, i: number) => (
                        <tr key={i} className="border-b border-dark/10">
                          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                          <td className="py-2 font-bold text-dark">{(r.siswa as any)?.nama}</td>
                          <td className="py-2 text-right text-dark">{formatRupiah(r.nominal)}</td>
                          <td className="py-2 text-center">
                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${r.status_bayar === 'lunas' ? 'bg-green-100 text-green-700' : r.status_bayar === 'belum_bayar' ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-700'}`}>
                              {r.status_bayar === 'lunas' ? '✅ Lunas' : r.status_bayar === 'belum_bayar' ? '❌ Belum' : '🔍 Menunggu'}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {iuranRows.length === 0 && <tr><td colSpan={3} className="py-8 text-center text-dark/40">Tidak ada data iuran untuk periode ini</td></tr>}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {activeTab === 'kehadiran' && (
            <Card>
              <h2 className="font-bold text-dark mb-3">📅 Rekap Kehadiran — {BULAN_NAMES[parseInt(filterBulan)]} {filterTahun}</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm font-sans">
                  <thead><tr className="border-b-2 border-dark/20">
                    <th className="text-left py-2 text-dark/60 font-bold">Nama Siswa</th>
                    <th className="text-center py-2 text-green-700 font-bold">✅ Hadir</th>
                    <th className="text-center py-2 text-blue-600 font-bold">📝 Izin</th>
                    <th className="text-center py-2 text-yellow-600 font-bold">🤒 Sakit</th>
                    <th className="text-center py-2 text-red-600 font-bold">❌ Alpha</th>
                    <th className="text-center py-2 text-dark/60 font-bold">% Hadir</th>
                  </tr></thead>
                  <tbody>
                    {kehadiranData.map((s, i) => {
                      const total = s.hadir + s.izin + s.sakit + s.alpha
                      const pct = total > 0 ? Math.round(s.hadir / total * 100) : 0
                      return (
                        <tr key={i} className="border-b border-dark/10">
                          <td className="py-2 font-bold text-dark">{s.nama}</td>
                          <td className="py-2 text-center text-green-700 font-bold">{s.hadir}</td>
                          <td className="py-2 text-center text-blue-600">{s.izin}</td>
                          <td className="py-2 text-center text-yellow-600">{s.sakit}</td>
                          <td className="py-2 text-center text-red-600">{s.alpha}</td>
                          <td className="py-2 text-center">
                            <span className={`font-bold ${pct >= 80 ? 'text-green-700' : pct >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>{pct}%</span>
                          </td>
                        </tr>
                      )
                    })}
                    {kehadiranData.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-dark/40">Tidak ada data absensi untuk periode ini</td></tr>}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {activeTab === 'honor' && (
            <div className="flex flex-col gap-4">
              {honorData.length === 0 ? (
                <Card className="text-center py-16 text-dark/50 font-sans border-dashed border-4 border-dark/20 bg-transparent">
                  <div className="text-4xl mb-2">📭</div>
                  <p className="font-bold text-lg">Belum ada payroll untuk periode ini</p>
                  <p className="text-sm mt-1">Generate payroll di halaman Honor Pelatih terlebih dahulu</p>
                </Card>
              ) : (
                (() => {
                  const run = honorData[0]
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const details: any[] = run.payroll_details || []
                  return (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Card className="flex flex-col gap-1">
                          <div className="text-xs font-bold text-dark/50 uppercase tracking-wide">💰 Total Income Iuran</div>
                          <div className="text-2xl font-bold font-sans text-green-700">{formatRupiah(run.total_income)}</div>
                        </Card>
                        <Card className="flex flex-col gap-1">
                          <div className="text-xs font-bold text-dark/50 uppercase tracking-wide">🏆 Coach Pool</div>
                          <div className="text-2xl font-bold font-sans text-blue-600">{formatRupiah(run.coach_pool_amount)}</div>
                        </Card>
                      </div>
                      <Card>
                        <h2 className="font-bold text-dark mb-3">Rincian Honor Pelatih — {BULAN_NAMES[run.bulan]} {run.tahun}</h2>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm font-sans">
                            <thead><tr className="border-b-2 border-dark/20">
                              <th className="text-left py-2 text-dark/60 font-bold">Pelatih</th>
                              <th className="text-right py-2 text-dark/60 font-bold">Honor Mengajar</th>
                              <th className="text-right py-2 text-dark/60 font-bold">Founder Share</th>
                              <th className="text-right py-2 text-dark/60 font-bold">Total Payout</th>
                              <th className="text-center py-2 text-dark/60 font-bold">Status</th>
                            </tr></thead>
                            <tbody>
                              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                              {details.map((d: any, i: number) => (
                                <tr key={i} className="border-b border-dark/10">
                                  <td className="py-2 font-bold text-dark">{d.pelatih?.nama}</td>
                                  <td className="py-2 text-right">{formatRupiah(d.teaching_honor || 0)}</td>
                                  <td className="py-2 text-right">{formatRupiah(d.founder_margin_share || 0)}</td>
                                  <td className="py-2 text-right font-bold text-green-700">{formatRupiah(d.total_payout || 0)}</td>
                                  <td className="py-2 text-center">
                                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${d.sudah_dibayar ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                                      {d.sudah_dibayar ? '✅ Dibayar' : '⏳ Belum'}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </Card>
                    </>
                  )
                })()
              )}
            </div>
          )}

          {activeTab === 'anggota' && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="flex flex-col gap-1">
                  <div className="text-xs font-bold text-dark/50 uppercase tracking-wide">👤 Siswa Aktif</div>
                  <div className="text-5xl font-bold font-sans text-dark mt-1">{anggotaData.aktif}</div>
                  <div className="text-xs text-dark/40">anggota terdaftar aktif</div>
                </Card>
                <Card className="flex flex-col gap-1">
                  <div className="text-xs font-bold text-dark/50 uppercase tracking-wide">🆕 Baru di {filterTahun}</div>
                  <div className="text-5xl font-bold font-sans text-green-700 mt-1">{anggotaData.baru}</div>
                  <div className="text-xs text-dark/40">siswa bergabung tahun ini</div>
                </Card>
                <Card className="flex flex-col gap-1">
                  <div className="text-xs font-bold text-dark/50 uppercase tracking-wide">⛔ Tidak Aktif</div>
                  <div className="text-5xl font-bold font-sans text-red-600 mt-1">{anggotaData.nonaktif}</div>
                  <div className="text-xs text-dark/40">siswa nonaktif</div>
                </Card>
              </div>
              <Card>
                <h2 className="font-bold text-dark mb-3">Daftar Siswa Aktif</h2>
                <div className="flex flex-col">
                  {anggotaData.list.filter(s => s.status_aktif).map((s, i) => (
                    <div key={i} className="flex items-center justify-between py-3 border-b border-dark/10">
                      <span className="font-bold text-dark">{s.nama}</span>
                      <span className="text-xs text-dark/40">Bergabung {new Date(s.tgl_gabung).toLocaleDateString('id-ID')}</span>
                    </div>
                  ))}
                  {anggotaData.list.filter(s => s.status_aktif).length === 0 && (
                    <div className="py-8 text-center text-dark/40">Belum ada siswa aktif</div>
                  )}
                </div>
              </Card>
            </div>
          )}

          {activeTab === 'prestasi' && (
            <Card>
              <h2 className="font-bold text-dark mb-4">🎖️ Rekap Prestasi Club</h2>
              <div className="grid grid-cols-3 gap-4 mb-6">
                {(['emas', 'perak', 'perunggu'] as const).map(m => (
                  <div key={m} className="text-center p-4 bg-background rounded-2xl border-2 border-dark/10">
                    <div className="text-4xl">{m === 'emas' ? '🥇' : m === 'perak' ? '🥈' : '🥉'}</div>
                    <div className="text-4xl font-bold font-sans text-dark mt-1">
                      {prestasiData.filter((p: { medali?: string }) => p.medali === m).length}
                    </div>
                    <div className="text-xs text-dark/50 uppercase font-bold mt-1 capitalize">{m}</div>
                  </div>
                ))}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm font-sans">
                  <thead><tr className="border-b-2 border-dark/20">
                    <th className="text-left py-2 text-dark/60 font-bold">Siswa</th>
                    <th className="text-left py-2 text-dark/60 font-bold">Event</th>
                    <th className="text-center py-2 text-dark/60 font-bold">Peringkat</th>
                    <th className="text-center py-2 text-dark/60 font-bold">Medali</th>
                    <th className="text-left py-2 text-dark/60 font-bold">Tanggal</th>
                  </tr></thead>
                  <tbody>
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {prestasiData.map((p: any, i: number) => (
                      <tr key={i} className="border-b border-dark/10">
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        <td className="py-2 font-bold text-dark">{(p.siswa as any)?.nama}</td>
                        <td className="py-2 text-dark">{p.nama_event}</td>
                        <td className="py-2 text-center font-bold text-dark">{p.peringkat || '—'}</td>
                        <td className="py-2 text-center text-xl">
                          {p.medali === 'emas' ? '🥇' : p.medali === 'perak' ? '🥈' : p.medali === 'perunggu' ? '🥉' : '—'}
                        </td>
                        <td className="py-2 text-dark/60 text-xs">{new Date(p.tgl_event).toLocaleDateString('id-ID')}</td>
                      </tr>
                    ))}
                    {prestasiData.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-dark/40">Belum ada data prestasi</td></tr>}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {activeTab === 'ortu' && (
            <Card>
              <h2 className="font-bold text-dark mb-1">📤 Blast Laporan via WhatsApp</h2>
              <p className="text-sm text-dark/60 mb-5">Kirim rekap kehadiran &amp; iuran ke orang tua masing-masing siswa untuk <b>{BULAN_NAMES[parseInt(filterBulan)]} {filterTahun}</b></p>
              <div className="flex flex-col gap-3">
                {ortuData.map((s, i) => (
                  <div key={i} className="flex items-center justify-between gap-4 p-4 bg-background rounded-2xl border-2 border-dark/10">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-dark text-base">{s.nama}</div>
                      <div className="text-xs text-dark/50 mt-1 flex flex-wrap gap-3">
                        <span>📅 Hadir: <b className="text-green-700">{s.hadir}</b>/{s.totalSesi}{s.totalSesi > 0 && ` (${s.persen}%)`}</span>
                        <span>💰 Iuran: <b className={s.statusIuran === 'lunas' ? 'text-green-700' : 'text-red-600'}>{s.statusIuran === 'lunas' ? '✅ Lunas' : s.statusIuran === 'belum_bayar' ? '❌ Belum' : '🔍 Menunggu'}</b></span>
                      </div>
                    </div>
                    <button onClick={() => bukaWA(s)}
                      className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2.5 rounded-2xl font-bold text-sm transition-colors whitespace-nowrap shrink-0">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                      Kirim WA
                    </button>
                  </div>
                ))}
                {ortuData.length === 0 && <div className="text-center py-16 text-dark/40">Tidak ada siswa aktif</div>}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
