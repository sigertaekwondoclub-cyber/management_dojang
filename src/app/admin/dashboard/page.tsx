'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { formatRupiah } from '@/lib/utils'
import Link from 'next/link'

const supabase = createClient()

export default function AdminDashboardPage() {
  const [stats, setStats] = useState({
    siswaAktif: 0,
    pelatihAktif: 0,
    iuranTotal: 0,
    iuranTerkumpul: 0,
    tagihanMenunggu: 0,
    daftarBaru: 0,
    pesananMerchantMenunggu: 0,
    merchantPemasukan: 0,
    income: 0,
    expense: 0
  })
  const [ujianMendatang, setUjianMendatang] = useState<any>(null)
  const [eventMendatang, setEventMendatang] = useState<any>(null)
  const [stokKritis, setStokKritis] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchDashboard = useCallback(async () => {
    setLoading(true)
    const now = new Date()
    const bulan = now.getMonth() + 1
    const tahun = now.getFullYear()
    const today = now.toISOString().split('T')[0]

    // Fetch all dashboard data in parallel
    const [
      siswaResult,
      daftarResult,
      pelatihResult,
      iuranResult,
      cashflowResult,
      honorResult,
      ujianResult,
      eventResult,
      merchantMenungguResult,
      merchantOmzetResult,
      stokResult
    ] = await Promise.all([
      supabase.from('siswa').select('status_aktif'),
      supabase.from('pendaftaran_siswa').select('id').eq('status', 'pending'),
      supabase.from('pelatih').select('id', { count: 'exact', head: true }).eq('status_aktif', true),
      supabase.from('iuran').select('nominal, status_bayar').eq('bulan', bulan).eq('tahun', tahun),
      supabase.from('keuangan_club').select('jenis, nominal').gte('tgl', `${tahun}-${String(bulan).padStart(2, '0')}-01`),
      supabase.from('honor_pelatih').select('honor_diterima').eq('tahun', tahun).eq('bulan', bulan).eq('status_dibayar', true),
      supabase.from('ujian_sabuk').select('tgl_ujian').gte('tgl_ujian', today).order('tgl_ujian', { ascending: true }).limit(1),
      supabase.from('event_kompetisi').select('nama, tgl').gte('tgl', today).order('tgl', { ascending: true }).limit(1),
      supabase.from('pesanan_merchant').select('id', { count: 'exact', head: true }).eq('status', 'menunggu_verifikasi'),
      supabase.from('pesanan_merchant').select('total_harga').in('status', ['lunas', 'diproses', 'siap_diambil']),
      supabase.from('produk_varian').select('ukuran, stok, produk_merchant(nama)').lte('stok', 5)
    ])

    const siswaData = siswaResult.data
    const siswaAktif = siswaData?.filter(s => s.status_aktif).length || 0

    const daftarData = daftarResult.data
    const daftarBaru = daftarData?.length || 0

    const pelatihAktif = pelatihResult.count || 0

    const iuranData = iuranResult.data
    let iuranTotal = 0
    let iuranTerkumpul = 0
    let tagihanMenunggu = 0
    iuranData?.forEach(i => {
      iuranTotal += Number(i.nominal)
      if (i.status_bayar === 'lunas') iuranTerkumpul += Number(i.nominal)
      if (i.status_bayar === 'menunggu_verifikasi') tagihanMenunggu++
    })

    const merchantPemasukan = (merchantOmzetResult.data || []).reduce((acc, curr) => acc + Number(curr.total_harga), 0)

    const cashflow = cashflowResult.data
    let income = iuranTerkumpul + merchantPemasukan
    let expense = 0
    cashflow?.forEach(c => {
      if (c.jenis === 'income') income += Number(c.nominal)
      if (c.jenis === 'expense') expense += Number(c.nominal)
    })
    
    const honorData = honorResult.data
    honorData?.forEach(h => { expense += Number(h.honor_diterima) })

    const uData = ujianResult.data
    const eData = eventResult.data

    setStats({
      siswaAktif,
      pelatihAktif: pelatihAktif || 0,
      iuranTotal,
      iuranTerkumpul,
      tagihanMenunggu,
      daftarBaru,
      pesananMerchantMenunggu: merchantMenungguResult.count || 0,
      merchantPemasukan,
      income,
      expense
    })
    setUjianMendatang(uData?.[0] || null)
    setEventMendatang(eData?.[0] || null)
    setStokKritis((stokResult.data || []) as any[])

    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchDashboard() }, [fetchDashboard])

  const iuranProgress = stats.iuranTotal > 0 ? (stats.iuranTerkumpul / stats.iuranTotal) * 100 : 0
  const saldo = stats.income - stats.expense

  if (loading) return <div className="p-8 text-center text-dark/50 font-bold font-sans">Memuat Dashboard...</div>

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto pb-10">
      <div className="animate-fade-in">
        <h1 className="text-3xl font-bold font-sans text-dark">🏠 Dashboard Admin</h1>
        <p className="text-dark/60 font-sans mt-1">Ringkasan aktivitas Siger Taekwondo Club</p>
      </div>

      {/* Banner Milestone Growth Pelatih */}
      {stats.siswaAktif >= 30 && (
        <div className="bg-[#BFDBFE] border-4 border-dark p-5 rounded-2xl shadow-brutal flex items-center gap-4 animate-fade-in-up">
          <div className="text-3xl animate-bounce-gentle">🚀</div>
          <div>
            <h4 className="font-bold text-dark font-sans text-lg">Milestone Pertumbuhan Klub!</h4>
            <p className="text-dark/80 text-sm font-sans mt-0.5">
              {stats.siswaAktif >= 50 
                ? "Coach pool cukup besar (≥ 50 siswa aktif), evaluasi skema gaji semi-tetap untuk pelatih inti."
                : stats.siswaAktif >= 40
                ? "Pertimbangkan promosi asisten pelatih jadi pelatih inti dibayar (≥ 40 siswa aktif)."
                : "Coach pool sudah stabil (≥ 30 siswa aktif), evaluasi kenaikan rate per sesi."
              }
            </p>
          </div>
        </div>
      )}

      {/* Grid Metrik Utama */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 stagger-children">
        {/* Siswa */}
        <Card className="p-6 border-2 border-dark bg-[#BBF7D0] hover:-translate-y-1 transition-transform animate-fade-in-up">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-sm font-sans font-bold text-dark/60">Siswa Aktif</div>
              <div className="text-4xl font-bold font-sans text-dark mt-1 animate-number-count">{stats.siswaAktif}</div>
            </div>
            <div className="text-4xl opacity-80 animate-float">🥋</div>
          </div>
        </Card>
        
        {/* Pelatih */}
        <Card className="p-6 border-2 border-dark bg-[#BFDBFE] hover:-translate-y-1 transition-transform animate-fade-in-up">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-sm font-sans font-bold text-dark/60">Pelatih Aktif</div>
              <div className="text-4xl font-bold font-sans text-dark mt-1 animate-number-count">{stats.pelatihAktif}</div>
            </div>
            <div className="text-4xl opacity-80 animate-float">👨‍🏫</div>
          </div>
        </Card>

        {/* Pendaftaran Siswa */}
        <Link href="/admin/pendaftaran" className="block outline-none">
          <Card className={`p-6 border-2 border-dark hover:-translate-y-1 transition-transform h-full animate-fade-in-up ${stats.daftarBaru > 0 ? 'bg-[#FDE68A]' : 'bg-white'}`}>
            <div className="flex justify-between items-start">
              <div>
                <div className="text-sm font-sans font-bold text-dark/60">Daftar Baru</div>
                <div className="text-4xl font-bold font-sans text-dark mt-1 animate-number-count">{stats.daftarBaru}</div>
              </div>
              <div className={`text-4xl opacity-80 ${stats.daftarBaru > 0 ? 'animate-bounce-gentle' : ''}`}>📝</div>
            </div>
            {stats.daftarBaru > 0 && <div className="text-xs font-bold text-dark mt-3 animate-pulse-soft">Menunggu verifikasi →</div>}
          </Card>
        </Link>

        {/* Verifikasi Iuran */}
        <Link href="/admin/iuran" className="block outline-none">
          <Card className={`p-6 border-2 border-dark hover:-translate-y-1 transition-transform h-full animate-fade-in-up ${stats.tagihanMenunggu > 0 ? 'bg-[#FECACA]' : 'bg-white'}`}>
            <div className="flex justify-between items-start">
              <div>
                <div className="text-sm font-sans font-bold text-dark/60">Verifikasi Iuran</div>
                <div className="text-4xl font-bold font-sans text-dark mt-1 animate-number-count">{stats.tagihanMenunggu}</div>
              </div>
              <div className={`text-4xl opacity-80 ${stats.tagihanMenunggu > 0 ? 'animate-bounce-gentle' : ''}`}>💰</div>
            </div>
            {stats.tagihanMenunggu > 0 && <div className="text-xs font-bold text-dark mt-3 animate-pulse-soft">Butuh pengecekan →</div>}
          </Card>
        </Link>

        {/* Verifikasi Pesanan Merchant */}
        <Link href="/admin/merchant/pesanan" className="block outline-none">
          <Card className={`p-6 border-2 border-dark hover:-translate-y-1 transition-transform h-full animate-fade-in-up ${stats.pesananMerchantMenunggu > 0 ? 'bg-accent' : 'bg-white'}`}>
            <div className="flex justify-between items-start">
              <div>
                <div className="text-sm font-sans font-bold text-dark/60">Pesanan Baru</div>
                <div className="text-4xl font-bold font-sans text-dark mt-1 animate-number-count">{stats.pesananMerchantMenunggu}</div>
              </div>
              <div className={`text-4xl opacity-80 ${stats.pesananMerchantMenunggu > 0 ? 'animate-bounce-gentle' : ''}`}>🛒</div>
            </div>
            {stats.pesananMerchantMenunggu > 0 && <div className="text-xs font-bold text-dark mt-3 animate-pulse-soft">Perlu diproses →</div>}
          </Card>
        </Link>
      </div>

      {/* Grid Grafik & Visualisasi */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 stagger-children">
        
        {/* BAR CHART: Cashflow Bulanan (Income vs Merchant vs Expense) */}
        <Card className="flex flex-col gap-4 border-2 border-dark p-6 animate-fade-in-up">
          <div>
            <h2 className="font-bold font-sans text-dark text-lg">Statistik Cashflow Bulan Ini</h2>
            <p className="text-xs text-dark/60">Perbandingan data kas masuk & keluar</p>
          </div>
          
          <div className="w-full flex items-center justify-center py-4 bg-background border-2 border-dark rounded-xl">
            {/* SVG Bar Chart */}
            <svg viewBox="0 0 400 240" className="w-full max-w-[400px]">
              {/* Grid Lines */}
              <line x1="40" y1="40" x2="360" y2="40" stroke="#E2E8F0" strokeDasharray="3" />
              <line x1="40" y1="90" x2="360" y2="90" stroke="#E2E8F0" strokeDasharray="3" />
              <line x1="40" y1="140" x2="360" y2="140" stroke="#E2E8F0" strokeDasharray="3" />
              <line x1="40" y1="190" x2="360" y2="190" stroke="#1E2A38" strokeWidth="2" />
              
              {/* Max Value Estimation */}
              {(() => {
                const maxVal = Math.max(stats.income - stats.merchantPemasukan, stats.merchantPemasukan, stats.expense, 100000);
                const scale = 140 / maxVal;
                const h1 = (stats.income - stats.merchantPemasukan) * scale;
                const h2 = stats.merchantPemasukan * scale;
                const h3 = stats.expense * scale;

                return (
                  <>
                    {/* Bar 1: Pemasukan Iuran */}
                    <rect x="75" y={190 - h1} width="40" height={h1} fill="#BBF7D0" stroke="#1E2A38" strokeWidth="2" className="shadow-brutal-sm" />
                    <text x="95" y="210" fontSize="10" fontWeight="bold" textAnchor="middle" fill="#1E2A38">Iuran</text>
                    <text x="95" y={180 - h1} fontSize="9" fontWeight="bold" textAnchor="middle" fill="#1E2A38">{formatRupiah(stats.income - stats.merchantPemasukan)}</text>

                    {/* Bar 2: Merchant Pemasukan */}
                    <rect x="180" y={190 - h2} width="40" height={h2} fill="#BFDBFE" stroke="#1E2A38" strokeWidth="2" />
                    <text x="200" y="210" fontSize="10" fontWeight="bold" textAnchor="middle" fill="#1E2A38">Toko</text>
                    <text x="200" y={180 - h2} fontSize="9" fontWeight="bold" textAnchor="middle" fill="#1E2A38">{formatRupiah(stats.merchantPemasukan)}</text>

                    {/* Bar 3: Pengeluaran */}
                    <rect x="285" y={190 - h3} width="40" height={h3} fill="#FECACA" stroke="#1E2A38" strokeWidth="2" />
                    <text x="305" y="210" fontSize="10" fontWeight="bold" textAnchor="middle" fill="#1E2A38">Keluar</text>
                    <text x="305" y={180 - h3} fontSize="9" fontWeight="bold" textAnchor="middle" fill="#1E2A38">{formatRupiah(stats.expense)}</text>
                  </>
                );
              })()}
            </svg>
          </div>
        </Card>

        {/* DONUT CHART: Distribusi Pemasukan */}
        <Card className="flex flex-col gap-4 border-2 border-dark p-6 animate-fade-in-up">
          <div>
            <h2 className="font-bold font-sans text-dark text-lg">Distribusi Pemasukan</h2>
            <p className="text-xs text-dark/60">Persentase Iuran vs Toko Merchant</p>
          </div>

          <div className="w-full flex flex-col sm:flex-row items-center justify-around py-4 bg-background border-2 border-dark rounded-xl gap-4">
            {/* SVG Donut Chart */}
            {(() => {
              const iuran = stats.income - stats.merchantPemasukan;
              const merchant = stats.merchantPemasukan;
              const total = iuran + merchant || 1;
              const pctIuran = Math.round((iuran / total) * 100);
              const pctMerchant = Math.round((merchant / total) * 100);

              // Donut calculations (radius = 50, circumference = 2 * pi * r = 314)
              const circ = 314;
              const dashIuran = (pctIuran / 100) * circ;
              const dashMerchant = (pctMerchant / 100) * circ;

              return (
                <>
                  <svg viewBox="0 0 160 160" className="w-32 h-32 transform -rotate-90">
                    <circle cx="80" cy="80" r="50" fill="transparent" stroke="#1E2A38" strokeWidth="30" />
                    {/* Slice 1: Iuran */}
                    <circle cx="80" cy="80" r="50" fill="transparent" stroke="#BBF7D0" strokeWidth="26"
                      strokeDasharray={`${dashIuran} ${circ}`} strokeDashoffset={0} />
                    {/* Slice 2: Merchant */}
                    {merchant > 0 && (
                      <circle cx="80" cy="80" r="50" fill="transparent" stroke="#BFDBFE" strokeWidth="26"
                        strokeDasharray={`${dashMerchant} ${circ}`} strokeDashoffset={-dashIuran} />
                    )}
                    {/* Inner hole spacer */}
                    <circle cx="80" cy="80" r="37" fill="#FBFBFB" stroke="#1E2A38" strokeWidth="2" />
                  </svg>

                  <div className="flex flex-col gap-3 font-sans">
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 border border-dark rounded bg-[#BBF7D0]" />
                      <span className="text-xs font-bold text-dark">Iuran Bulanan ({pctIuran}%)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 border border-dark rounded bg-[#BFDBFE]" />
                      <span className="text-xs font-bold text-dark">Toko Merchant ({pctMerchant}%)</span>
                    </div>
                    <div className="border-t border-dark/10 pt-2 text-xs font-bold text-dark/70">
                      Total Kas Masuk: {formatRupiah(total)}
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </Card>

        {/* Iuran Progress */}
        <Card className="flex flex-col gap-4 animate-fade-in-up">
          <h2 className="font-bold font-sans text-dark text-lg">Pemasukan Iuran Bulan Ini</h2>
          <div className="flex justify-between items-end">
            <div>
              <div className="text-3xl font-bold font-sans text-dark">{formatRupiah(stats.iuranTerkumpul)}</div>
              <div className="text-sm text-dark/60 font-sans mt-1">dari target {formatRupiah(stats.iuranTotal)}</div>
            </div>
            <div className="font-bold font-sans text-primary text-xl">{Math.round(iuranProgress)}%</div>
          </div>
          <div className="h-4 bg-dark/10 rounded-full overflow-hidden border border-dark/20 mt-2">
            <div 
              className="h-full bg-primary transition-all duration-1000 animate-progress-fill" 
              style={{ width: `${Math.min(iuranProgress, 100)}%` }}
            />
          </div>
        </Card>

        {/* Cashflow Singkat */}
        <Card className="flex flex-col gap-4 bg-dark text-white border-dark animate-fade-in-up">
          <h2 className="font-bold font-sans text-white/80 text-lg">Cashflow Bulan Ini</h2>
          <div className="grid grid-cols-3 gap-3 mt-2">
            <div className="bg-white rounded-2xl p-3 flex flex-col gap-1">
              <div className="text-[10px] font-bold text-dark/60 uppercase tracking-wide font-sans">💵 Pemasukan</div>
              <div className="text-base font-bold font-sans text-green-700">{formatRupiah(stats.income)}</div>
            </div>
            <div className="bg-white rounded-2xl p-3 flex flex-col gap-1">
              <div className="text-[10px] font-bold text-dark/60 uppercase tracking-wide font-sans">💸 Pengeluaran</div>
              <div className="text-base font-bold font-sans text-red-600">{formatRupiah(stats.expense)}</div>
            </div>
            <div className="bg-white rounded-2xl p-3 flex flex-col gap-1">
              <div className="text-[10px] font-bold text-dark/60 uppercase tracking-wide font-sans">🏦 Saldo Bersih</div>
              <div className={`text-base font-bold font-sans ${saldo >= 0 ? 'text-green-700' : 'text-red-600'}`}>{formatRupiah(saldo)}</div>
            </div>
          </div>
          <Link href="/admin/keuangan" className="text-xs text-white/50 hover:text-white mt-auto text-right font-sans transition-colors">Lihat detail laporan →</Link>
        </Card>

        {/* Jadwal Terdekat */}
        <Card className="lg:col-span-2 animate-fade-in-up">
          <h2 className="font-bold font-sans text-dark text-lg mb-4">📅 Jadwal Terdekat</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border-2 border-dark bg-background flex flex-col gap-1">
              <div className="text-sm text-dark/60 font-bold font-sans">Ujian Kenaikan Sabuk</div>
              {ujianMendatang ? (
                <>
                  <div className="text-xl font-bold font-sans text-dark">
                    {new Date(ujianMendatang.tgl_ujian).toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'})}
                  </div>
                  <Link href="/admin/ujian" className="text-xs font-bold text-primary hover:underline mt-2">Kelola Ujian →</Link>
                </>
              ) : (
                <div className="text-dark/50 italic text-sm mt-1">Belum ada jadwal</div>
              )}
            </div>

            <div className="p-4 rounded-xl border-2 border-dark bg-background flex flex-col gap-1">
              <div className="text-sm text-dark/60 font-bold font-sans">Event / Kompetisi</div>
              {eventMendatang ? (
                <>
                  <div className="text-lg font-bold font-sans text-dark leading-tight">{eventMendatang.nama}</div>
                  <div className="text-sm text-dark/70 font-sans mt-1">
                    {new Date(eventMendatang.tgl).toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'})}
                  </div>
                  <Link href="/admin/event" className="text-xs font-bold text-primary hover:underline mt-2">Lihat Detail →</Link>
                </>
              ) : (
                <div className="text-dark/50 italic text-sm mt-1">Belum ada event mendatang</div>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* ALERT STOK KRITIS */}
      {stokKritis.length > 0 && (
        <Card className="border-4 border-dark bg-accent shadow-brutal p-6 animate-fade-in-up">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl animate-wiggle">⚠️</span>
            <h3 className="font-bold text-dark text-lg">Peringatan: Stok Produk Hampir Habis!</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {stokKritis.map((item, idx) => (
              <div key={idx} className="bg-white border-2 border-dark rounded-xl p-3 flex justify-between items-center">
                <div>
                  <p className="font-bold text-dark text-sm truncate max-w-[150px]">{(item.produk_merchant as any)?.nama}</p>
                  <p className="text-dark/60 text-xs">Varian: {item.ukuran}</p>
                </div>
                <Badge color="dark" className="text-xs">{item.stok} Tersisa</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
