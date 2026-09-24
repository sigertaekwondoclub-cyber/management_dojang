'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import type { PayrollRun, PayrollDetail, KasbonPelatih, PembayaranKasbon, Pelatih } from '@/lib/types'
import {
  generatePayroll,
  updateDetailStatusDibayar,
  tambahKasbon,
  hapusKasbon,
  catatPembayaranTunai,
  updatePotonganKasbon,
} from './actions'

import { formatRupiah } from '@/lib/utils'

const supabase = createClient()

const BULAN_NAMES = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

type DetailWithPelatih = PayrollDetail & { 
  pelatih: { nama: string; role: 'head_coach' | 'core_coach' | 'assistant_coach'; is_founder: boolean } 
}

type KasbonWithPelatih = KasbonPelatih & {
  pelatih?: { nama: string; role: 'head_coach' | 'core_coach' | 'assistant_coach' }
}

export default function AdminHonorPage() {
  const now = new Date()

  // ── Tab State
  const [activeTab, setActiveTab] = useState<'payroll' | 'kasbon'>('payroll')

  // ── Payroll States
  const [filterBulan, setFilterBulan] = useState(String(now.getMonth() + 1).padStart(2, '0'))
  const [filterTahun, setFilterTahun] = useState(String(now.getFullYear()))
  const [payrollRun, setPayrollRun] = useState<PayrollRun | null>(null)
  const [details, setDetails] = useState<DetailWithPelatih[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // ── Kasbon States
  const [kasbonList, setKasbonList] = useState<KasbonWithPelatih[]>([])
  const [kasbonStatusFilter, setKasbonStatusFilter] = useState<'semua' | 'belum_lunas' | 'lunas'>('semua')
  const [loadingKasbon, setLoadingKasbon] = useState(false)
  const [allCoaches, setAllCoaches] = useState<Pelatih[]>([])

  // Modal Kasbon Baru
  const [modalKasbonOpen, setModalKasbonOpen] = useState(false)
  const [formKasbon, setFormKasbon] = useState({
    pelatihId: '',
    nominal: '',
    tglPinjam: now.toISOString().split('T')[0],
    keterangan: '',
  })
  const [savingKasbon, setSavingKasbon] = useState(false)

  // Modal Bayar Tunai
  const [modalBayarOpen, setModalBayarOpen] = useState(false)
  const [formBayar, setFormBayar] = useState({
    kasbonId: '',
    nominal: '',
    tglBayar: now.toISOString().split('T')[0],
    catatan: '',
  })
  const [savingBayar, setSavingBayar] = useState(false)

  // Modal Riwayat Pembayaran
  const [modalHistoryOpen, setModalHistoryOpen] = useState(false)
  const [selectedKasbon, setSelectedKasbon] = useState<KasbonWithPelatih | null>(null)
  const [historyList, setHistoryList] = useState<PembayaranKasbon[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  // Modal Edit Potongan Payroll
  const [modalEditPotonganOpen, setModalEditPotonganOpen] = useState(false)
  const [editingDetail, setEditingDetail] = useState<DetailWithPelatih | null>(null)
  const [inputPotongan, setInputPotongan] = useState('')
  const [coachDebtBalance, setCoachDebtBalance] = useState(0)
  const [savingPotongan, setSavingPotongan] = useState(false)

  // ──────────────────────────────────────────
  // Fetch Payroll Data
  // ──────────────────────────────────────────
  const fetchPayroll = useCallback(async () => {
    setLoading(true)
    setError(null)
    setSuccess(null)

    const bul = parseInt(filterBulan)
    const tah = parseInt(filterTahun)

    const { data: runData, error: runErr } = await supabase
      .from('payroll_runs')
      .select('*')
      .eq('bulan', bul)
      .eq('tahun', tah)
      .maybeSingle()

    if (runErr) {
      setError('Gagal memuat payroll: ' + runErr.message)
      setLoading(false)
      return
    }

    if (runData) {
      setPayrollRun(runData as PayrollRun)
      
      const { data: detailsData, error: detailsErr } = await supabase
        .from('payroll_details')
        .select('*, pelatih:pelatih_id(nama, role, is_founder)')
        .eq('payroll_run_id', runData.id)
        .order('total_payout', { ascending: false })

      if (detailsErr) {
        setError('Gagal memuat rincian pelatih: ' + detailsErr.message)
      } else {
        setDetails((detailsData || []) as DetailWithPelatih[])
      }
    } else {
      setPayrollRun(null)
      setDetails([])
    }

    setLoading(false)
  }, [filterBulan, filterTahun])

  // ──────────────────────────────────────────
  // Fetch Kasbon Data & Pelatih
  // ──────────────────────────────────────────
  const fetchKasbonData = useCallback(async () => {
    setLoadingKasbon(true)
    try {
      // 1. Ambil semua pelatih aktif
      const { data: coachData } = await supabase
        .from('pelatih')
        .select('*')
        .eq('status_aktif', true)
        .order('nama', { ascending: true })

      setAllCoaches((coachData || []) as Pelatih[])

      // 2. Ambil list kasbon
      const { data: kbData, error: kbErr } = await supabase
        .from('kasbon_pelatih')
        .select('*, pelatih:pelatih_id(nama, role)')
        .order('tgl_pinjam', { ascending: false })

      if (kbErr) {
        console.error('Error fetching kasbon:', kbErr)
      } else {
        setKasbonList((kbData || []) as KasbonWithPelatih[])
      }
    } finally {
      setLoadingKasbon(false)
    }
  }, [])

  useEffect(() => {
    fetchPayroll()
    fetchKasbonData()
  }, [fetchPayroll, fetchKasbonData])

  // ──────────────────────────────────────────
  // Actions: Payroll
  // ──────────────────────────────────────────
  const handleGenerate = async () => {
    setGenerating(true)
    setError(null)
    setSuccess(null)

    const bul = parseInt(filterBulan)
    const tah = parseInt(filterTahun)

    const res = await generatePayroll(bul, tah)
    if (res.success) {
      setSuccess(res.message)
      await fetchPayroll()
      await fetchKasbonData()
    } else {
      setError(res.message)
    }
    setGenerating(false)
  }

  const handleTandaiDibayar = async (detailId: string, currentStatus: boolean) => {
    setActionLoading(detailId)
    const res = await updateDetailStatusDibayar(detailId, !currentStatus)
    if (res.success) {
      await fetchPayroll()
      await fetchKasbonData()
    } else {
      alert(res.message)
    }
    setActionLoading(null)
  }

  // Buka modal edit potongan kasbon untuk baris payroll tertentu
  const handleOpenEditPotongan = async (item: DetailWithPelatih) => {
    setEditingDetail(item)
    setInputPotongan(String(item.potongan_kasbon ?? 0))

    // Ambil sisa hutang pelatih saat ini
    const { data: loans } = await supabase
      .from('kasbon_pelatih')
      .select('sisa_hutang')
      .eq('pelatih_id', item.pelatih_id)
      .eq('status', 'belum_lunas')

    const totalHutang = (loans || []).reduce((acc, curr) => acc + Number(curr.sisa_hutang || 0), 0)
    setCoachDebtBalance(totalHutang)
    setModalEditPotonganOpen(true)
  }

  const handleSavePotongan = async () => {
    if (!editingDetail) return
    const pot = Number(inputPotongan) || 0
    if (pot < 0) {
      alert('Potongan tidak boleh negatif')
      return
    }
    if (pot > editingDetail.total_payout) {
      alert(`Potongan tidak boleh melebihi honor kotor (${formatRupiah(editingDetail.total_payout)})`)
      return
    }

    setSavingPotongan(true)
    const res = await updatePotonganKasbon(editingDetail.id, pot)
    if (res.success) {
      setModalEditPotonganOpen(false)
      await fetchPayroll()
    } else {
      alert(res.message)
    }
    setSavingPotongan(false)
  }

  // ──────────────────────────────────────────
  // Actions: Kasbon
  // ──────────────────────────────────────────
  const handleSaveKasbonBaru = async () => {
    if (!formKasbon.pelatihId) { alert('Pilih pelatih terlebih dahulu!'); return }
    const nom = Number(formKasbon.nominal)
    if (isNaN(nom) || nom <= 0) { alert('Nominal pinjaman harus lebih dari 0'); return }
    if (!formKasbon.keterangan.trim()) { alert('Keterangan pinjaman harus diisi!'); return }

    setSavingKasbon(true)
    const res = await tambahKasbon(
      formKasbon.pelatihId,
      nom,
      formKasbon.tglPinjam,
      formKasbon.keterangan
    )

    if (res.success) {
      alert(res.message)
      setModalKasbonOpen(false)
      setFormKasbon({
        pelatihId: '',
        nominal: '',
        tglPinjam: now.toISOString().split('T')[0],
        keterangan: '',
      })
      await fetchKasbonData()
    } else {
      alert(res.message)
    }
    setSavingKasbon(false)
  }

  const handleSaveBayarTunai = async () => {
    if (!formBayar.kasbonId) { alert('Pilih kasbon yang akan dibayar!'); return }
    const nom = Number(formBayar.nominal)
    if (isNaN(nom) || nom <= 0) { alert('Nominal pembayaran harus lebih dari 0'); return }

    setSavingBayar(true)
    const res = await catatPembayaranTunai(
      formBayar.kasbonId,
      nom,
      formBayar.tglBayar,
      formBayar.catatan
    )

    if (res.success) {
      alert(res.message)
      setModalBayarOpen(false)
      setFormBayar({
        kasbonId: '',
        nominal: '',
        tglBayar: now.toISOString().split('T')[0],
        catatan: '',
      })
      await fetchKasbonData()
    } else {
      alert(res.message)
    }
    setSavingBayar(false)
  }

  const handleHapusKasbon = async (kb: KasbonWithPelatih) => {
    if (!confirm(`Hapus kasbon sebesar ${formatRupiah(kb.nominal_pinjaman)} untuk ${kb.pelatih?.nama || 'Pelatih'}?\n\nPengeluaran kas klub yang terkait juga akan otomatis dibatalkan.`)) {
      return
    }

    const res = await hapusKasbon(kb.id)
    if (res.success) {
      alert(res.message)
      await fetchKasbonData()
    } else {
      alert(res.message)
    }
  }

  const handleOpenHistory = async (kb: KasbonWithPelatih) => {
    setSelectedKasbon(kb)
    setModalHistoryOpen(true)
    setLoadingHistory(true)

    const { data } = await supabase
      .from('pembayaran_kasbon')
      .select('*')
      .eq('kasbon_id', kb.id)
      .order('tgl_bayar', { ascending: false })

    setHistoryList((data || []) as PembayaranKasbon[])
    setLoadingHistory(false)
  }

  // ──────────────────────────────────────────
  // Computed Kasbon Stats
  // ──────────────────────────────────────────
  const kasbonStats = useMemo(() => {
    let totalAktif = 0
    let totalLunas = 0
    const coachesWithDebt = new Set<string>()

    kasbonList.forEach(kb => {
      if (kb.status === 'belum_lunas') {
        totalAktif += Number(kb.sisa_hutang || 0)
        coachesWithDebt.add(kb.pelatih_id)
      } else {
        totalLunas += Number(kb.nominal_pinjaman || 0)
      }
    })

    return {
      totalAktif,
      totalLunas,
      pelatihBerhutangCount: coachesWithDebt.size,
    }
  }, [kasbonList])

  const filteredKasbonList = useMemo(() => {
    if (kasbonStatusFilter === 'semua') return kasbonList
    return kasbonList.filter(k => k.status === kasbonStatusFilter)
  }, [kasbonList, kasbonStatusFilter])

  const activeKasbonOnly = useMemo(() => {
    return kasbonList.filter(k => k.status === 'belum_lunas')
  }, [kasbonList])

  const getRoleBadgeColor = (role: string) => {
    if (role === 'head_coach') return 'primary'
    if (role === 'core_coach') return 'dark'
    return 'secondary'
  }

  const getRoleLabel = (role: string) => {
    if (role === 'head_coach') return 'Head Coach'
    if (role === 'core_coach') return 'Core Coach'
    return 'Assistant Coach'
  }

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-6 pb-12">
      {/* Header Halaman */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold font-sans text-dark flex items-center gap-3">
            <span>🏆 Honor & Kasbon Pelatih</span>
          </h1>
          <p className="text-dark/60 font-sans mt-1">Kelola pembagian iuran bulanan, kasbon hutang pelatih, dan pembayaran honor bersih</p>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-2 p-1.5 bg-white border-2 border-dark rounded-2xl shadow-brutal w-fit flex-wrap">
        <button
          onClick={() => setActiveTab('payroll')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold font-sans text-sm transition-all ${
            activeTab === 'payroll'
              ? 'bg-primary text-dark border-2 border-dark shadow-sm'
              : 'text-dark/60 hover:text-dark hover:bg-background'
          }`}
        >
          <span>🏆 Payroll Bulanan</span>
        </button>

        <button
          onClick={() => setActiveTab('kasbon')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold font-sans text-sm transition-all ${
            activeTab === 'kasbon'
              ? 'bg-primary text-dark border-2 border-dark shadow-sm'
              : 'text-dark/60 hover:text-dark hover:bg-background'
          }`}
        >
          <span>💳 Kelola Kasbon / Hutang Pelatih</span>
          {kasbonStats.pelatihBerhutangCount > 0 && (
            <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
              {kasbonStats.pelatihBerhutangCount}
            </span>
          )}
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* TAB 1: PAYROLL BULANAN */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'payroll' && (
        <div className="flex flex-col gap-6 animate-fade-in">
          {/* Filter & Action */}
          <Card>
            <div className="flex gap-4 flex-wrap items-end justify-between w-full">
              <div className="flex gap-4 flex-wrap items-end">
                <div className="flex flex-col gap-2">
                  <label className="font-bold text-dark text-sm">Bulan</label>
                  <select value={filterBulan} onChange={e => setFilterBulan(e.target.value)}
                    className="border-2 border-dark rounded-2xl px-4 py-3 bg-white text-dark focus:outline-none focus:ring-2 focus:ring-primary font-sans min-w-[150px]">
                    {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map(m => (
                      <option key={m} value={m}>{BULAN_NAMES[parseInt(m)]}</option>
                    ))}
                  </select>
                </div>
                <Input label="Tahun" type="number" value={filterTahun}
                  onChange={e => setFilterTahun(e.target.value)} className="max-w-[120px]" />
                <Button variant="secondary" onClick={fetchPayroll} disabled={loading}>
                  🔍 Tampilkan
                </Button>
              </div>
              
              <Button variant="primary" onClick={handleGenerate} disabled={generating || loading} className="mb-0">
                {generating ? '⏳ Memproses...' : '⚡ Hitung & Generate Payroll'}
              </Button>
            </div>
          </Card>

          {error && <div className="bg-accent/20 border-2 border-accent rounded-xl p-4 text-dark font-bold text-sm">⚠️ {error}</div>}
          {success && <div className="bg-primary/20 border-2 border-primary rounded-xl p-4 text-dark font-bold text-sm">✅ {success}</div>}

          {loading ? (
            <Card className="text-center py-16 text-dark/50 font-sans">Memuat data payroll...</Card>
          ) : !payrollRun ? (
            <Card className="text-center py-16 text-dark/50 font-sans border-dashed border-4 border-dark/20 bg-transparent">
              <div className="text-5xl mb-3">📭</div>
              <p className="font-bold text-lg text-dark/70">Payroll Belum Di-generate</p>
              <p className="text-sm mt-1 max-w-md mx-auto">
                Belum ada data snapshot payroll untuk bulan {BULAN_NAMES[parseInt(filterBulan)]} {filterTahun}. 
                Klik tombol <strong>Generate Payroll</strong> di atas untuk menghitung otomatis berdasarkan iuran terbayar.
              </p>
            </Card>
          ) : (
            <div className="flex flex-col gap-6">
              {/* Ringkasan Alokasi Budget */}
              <Card className="bg-dark text-white border-dark">
                <h2 className="font-bold font-sans text-xl mb-4 border-b border-white/20 pb-3 flex justify-between items-center">
                  <span>📊 Alokasi Finansial Club</span>
                  <span className="text-sm font-normal text-white/50">Periode: {BULAN_NAMES[payrollRun.bulan]} {payrollRun.tahun}</span>
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-white rounded-2xl border border-white/20 flex flex-col gap-1">
                    <div className="text-[10px] text-dark/60 uppercase font-bold tracking-wider">💰 Total Income Iuran</div>
                    <div className="text-xl font-bold font-sans text-green-700">{formatRupiah(payrollRun.total_income)}</div>
                  </div>
                  <div className="p-4 bg-white rounded-2xl border border-white/20 flex flex-col gap-1">
                    <div className="text-[10px] text-dark/60 uppercase font-bold tracking-wider">🏆 Coach Pool (Honor)</div>
                    <div className="text-xl font-bold font-sans text-blue-600">{formatRupiah(payrollRun.coach_pool_amount)}</div>
                  </div>
                  <div className="p-4 bg-white rounded-2xl border border-white/20 flex flex-col gap-1">
                    <div className="text-[10px] text-dark/60 uppercase font-bold tracking-wider">⚙️ Operasional</div>
                    <div className="text-xl font-bold font-sans text-dark">{formatRupiah(payrollRun.operational_amount)}</div>
                  </div>
                  <div className="p-4 bg-white rounded-2xl border border-white/20 flex flex-col gap-1">
                    <div className="text-[10px] text-dark/60 uppercase font-bold tracking-wider">🏦 Dana Cadangan</div>
                    <div className="text-xl font-bold font-sans text-dark">{formatRupiah(payrollRun.reserve_amount)}</div>
                  </div>
                  <div className="p-4 bg-white rounded-2xl border border-white/20 flex flex-col gap-1">
                    <div className="text-[10px] text-dark/60 uppercase font-bold tracking-wider">📈 Pengembangan Club</div>
                    <div className="text-xl font-bold font-sans text-dark">{formatRupiah(payrollRun.development_amount)}</div>
                  </div>
                  <div className="p-4 bg-white rounded-2xl border border-white/20 flex flex-col gap-1">
                    <div className="text-[10px] text-dark/60 uppercase font-bold tracking-wider">👑 Founder Margin</div>
                    <div className="text-xl font-bold font-sans text-dark">{formatRupiah(payrollRun.founder_margin_amount)}</div>
                  </div>
                </div>
              </Card>

              {/* Rincian Honor Pelatih */}
              <Card className="border-2 border-dark">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <h2 className="font-bold font-sans text-dark text-lg">🥋 Rincian Pembayaran Honor Pelatih</h2>
                  <span className="text-xs text-dark/60 font-sans">
                    * Pengeluaran kas riil yang tercatat di Keuangan Club adalah <strong>Honor Bersih</strong> (setelah dipotong kasbon).
                  </span>
                </div>

                <div className="flex flex-col gap-4">
                  {details.map(item => {
                    const honorKotor = Number(item.total_payout || 0)
                    const potongan = Number(item.potongan_kasbon || 0)
                    const honorBersih = Number(item.honor_bersih ?? (honorKotor - potongan))

                    return (
                      <div key={item.id} className="p-4 bg-background border-2 border-dark rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <span className="font-bold text-dark text-lg">{item.pelatih?.nama || '-'}</span>
                            <Badge color={getRoleBadgeColor(item.pelatih?.role || '')}>{getRoleLabel(item.pelatih?.role || '')}</Badge>
                            {item.pelatih?.is_founder && <Badge color="primary">⭐ Founder</Badge>}
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 mt-3 text-xs text-dark/70 font-sans">
                            <div>Sesi Mengajar: <strong className="text-dark font-mono text-sm">{item.sessions_taught} kali</strong></div>
                            <div>Honor Mengajar: <strong className="text-dark">{formatRupiah(item.teaching_honor)}</strong></div>
                            <div>Margin Founder: <strong className="text-dark">{formatRupiah(item.founder_margin_share)}</strong></div>
                            {item.tgl_dibayar && <div>Tgl Dibayar: <strong className="text-dark">{new Date(item.tgl_dibayar + 'T00:00:00').toLocaleDateString('id-ID')}</strong></div>}
                          </div>

                          {/* Breakdown Potongan Kasbon */}
                          <div className="mt-3 pt-2.5 border-t border-dark/10 flex items-center gap-3 flex-wrap text-xs">
                            <span className="text-dark/60">Honor Kotor: <b className="text-dark">{formatRupiah(honorKotor)}</b></span>
                            {potongan > 0 ? (
                              <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-lg border border-red-300 font-bold">
                                ✂️ Potong Kasbon: -{formatRupiah(potongan)}
                              </span>
                            ) : (
                              <span className="text-dark/40 italic">Tidak ada potongan kasbon</span>
                            )}

                            {!item.status_dibayar && (
                              <button
                                onClick={() => handleOpenEditPotongan(item)}
                                className="text-primary hover:underline font-bold text-xs flex items-center gap-1"
                              >
                                ✏️ Atur Potongan
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-4 shrink-0 justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0">
                          <div className="text-right">
                            <div className="text-xl font-bold font-sans text-green-700">{formatRupiah(honorBersih)}</div>
                            <div className="text-[10px] uppercase tracking-wider text-dark/50 font-bold">Honor Bersih Ditransfer</div>
                          </div>

                          <Button
                            variant={item.status_dibayar ? 'secondary' : 'primary'}
                            onClick={() => handleTandaiDibayar(item.id, item.status_dibayar)}
                            disabled={actionLoading === item.id}
                            className="text-xs py-2 px-3 mb-0"
                          >
                            {actionLoading === item.id ? '⏳' : item.status_dibayar ? '✅ Dibayar' : '💳 Bayar'}
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                  {details.length === 0 && (
                    <div className="text-center py-6 text-dark/50">Belum ada rincian honor untuk pelatih aktif.</div>
                  )}
                </div>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* TAB 2: KELOLA KASBON / HUTANG PELATIH */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'kasbon' && (
        <div className="flex flex-col gap-6 animate-fade-in">
          {/* Ringkasan Statistik Kasbon */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="border-2 border-dark bg-[#FEE2E2]">
              <div className="text-xs font-bold text-dark/60 uppercase tracking-wide">💳 Total Kasbon Aktif (Tanggungan)</div>
              <div className="text-2xl font-bold font-sans text-red-600 mt-1">{formatRupiah(kasbonStats.totalAktif)}</div>
              <div className="text-[11px] text-dark/60 mt-1">Uang klub yang sedang dipinjam pelatih</div>
            </Card>

            <Card className="border-2 border-dark bg-[#FEF3C7]">
              <div className="text-xs font-bold text-dark/60 uppercase tracking-wide">👥 Pelatih Berhutang</div>
              <div className="text-2xl font-bold font-sans text-dark mt-1">{kasbonStats.pelatihBerhutangCount} Orang</div>
              <div className="text-[11px] text-dark/60 mt-1">Pelatih yang memiliki tanggungan kasbon aktif</div>
            </Card>

            <Card className="border-2 border-dark bg-[#DCFCE7]">
              <div className="text-xs font-bold text-dark/60 uppercase tracking-wide">✅ Total Kasbon Dilunasi</div>
              <div className="text-2xl font-bold font-sans text-green-700 mt-1">{formatRupiah(kasbonStats.totalLunas)}</div>
              <div className="text-[11px] text-dark/60 mt-1">Akumulasi kasbon yang telah selesai lunas</div>
            </Card>
          </div>

          {/* Action Bar & Filter */}
          <Card>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold text-dark">Filter Status:</span>
                {(['semua', 'belum_lunas', 'lunas'] as const).map(st => (
                  <button
                    key={st}
                    onClick={() => setKasbonStatusFilter(st)}
                    className={`px-3 py-1.5 rounded-xl border-2 text-xs font-bold font-sans transition-all ${
                      kasbonStatusFilter === st
                        ? 'bg-primary border-dark shadow-sm'
                        : 'bg-white border-dark/20 text-dark/60 hover:text-dark hover:border-dark'
                    }`}
                  >
                    {st === 'semua' ? 'Semua' : st === 'belum_lunas' ? '⚠️ Belum Lunas' : '✅ Lunas'}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-3">
                <Button variant="secondary" onClick={() => setModalBayarOpen(true)}>
                  💵 Catat Bayar Tunai
                </Button>
                <Button variant="primary" onClick={() => setModalKasbonOpen(true)}>
                  ➕ Kasbon Baru
                </Button>
              </div>
            </div>
          </Card>

          {/* Tabel Daftar Kasbon */}
          <Card className="border-2 border-dark p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm font-sans">
                <thead className="bg-background border-b-2 border-dark text-xs uppercase tracking-wider text-dark/70">
                  <tr>
                    <th className="py-3.5 px-4 font-bold">Tgl Pinjam</th>
                    <th className="py-3.5 px-4 font-bold">Pelatih</th>
                    <th className="py-3.5 px-4 font-bold">Nominal Pokok</th>
                    <th className="py-3.5 px-4 font-bold">Sisa Hutang</th>
                    <th className="py-3.5 px-4 font-bold">Status</th>
                    <th className="py-3.5 px-4 font-bold hidden md:table-cell">Keterangan</th>
                    <th className="py-3.5 px-4 font-bold text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark/10">
                  {loadingKasbon ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-dark/50 font-sans">Memuat data kasbon...</td>
                    </tr>
                  ) : filteredKasbonList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-dark/50 font-sans">
                        Tidak ada data kasbon ditemukan.
                      </td>
                    </tr>
                  ) : (
                    filteredKasbonList.map(kb => (
                      <tr key={kb.id} className="hover:bg-background/60 transition-colors">
                        <td className="py-3.5 px-4 text-dark font-medium whitespace-nowrap">
                          {new Date(kb.tgl_pinjam + 'T00:00:00').toLocaleDateString('id-ID', {
                            day: 'numeric', month: 'short', year: 'numeric'
                          })}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-dark">{kb.pelatih?.nama || 'Pelatih'}</div>
                          <div className="text-[10px] text-dark/60">{getRoleLabel(kb.pelatih?.role || '')}</div>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-dark whitespace-nowrap">
                          {formatRupiah(Number(kb.nominal_pinjaman))}
                        </td>
                        <td className="py-3.5 px-4 font-bold whitespace-nowrap">
                          <span className={Number(kb.sisa_hutang) > 0 ? 'text-red-600' : 'text-green-700'}>
                            {formatRupiah(Number(kb.sisa_hutang))}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <Badge color={kb.status === 'lunas' ? 'primary' : 'accent'}>
                            {kb.status === 'lunas' ? '✅ Lunas' : '⏳ Belum Lunas'}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-4 text-dark/80 text-xs hidden md:table-cell max-w-xs truncate">
                          {kb.keterangan}
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenHistory(kb)}
                              title="Lihat riwayat pembayaran"
                              className="px-2.5 py-1.5 bg-[#BFDBFE] text-dark hover:bg-blue-200 border border-dark rounded-xl text-xs font-bold transition-all"
                            >
                              📜 Riwayat
                            </button>
                            {kb.sisa_hutang === kb.nominal_pinjaman && (
                              <button
                                onClick={() => handleHapusKasbon(kb)}
                                title="Hapus kasbon (karena belum ada pembayaran)"
                                className="px-2 py-1.5 bg-red-100 text-red-700 hover:bg-red-200 border border-red-300 rounded-xl text-xs font-bold transition-all"
                              >
                                🗑️
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* MODAL: TAMBAH KASBON BARU */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {modalKasbonOpen && (
        <div className="fixed inset-0 bg-dark/50 flex items-center justify-center p-4 z-50 animate-fade-in">
          <Card className="w-full max-w-lg shadow-2xl border-4 border-dark">
            <h3 className="font-bold text-dark text-xl font-sans mb-1 flex items-center gap-2">
              <span>💳 Catat Kasbon / Hutang Pelatih</span>
            </h3>
            <p className="text-xs text-dark/60 font-sans mb-4">
              Uang kasbon akan otomatis dicatat sebagai <strong>Pengeluaran Kas Club</strong> sehingga saldo kas riil langsung sinkron.
            </p>

            <div className="flex flex-col gap-4 font-sans">
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-dark text-xs">Pilih Pelatih *</label>
                <select
                  value={formKasbon.pelatihId}
                  onChange={e => setFormKasbon({ ...formKasbon, pelatihId: e.target.value })}
                  className="border-2 border-dark rounded-2xl px-4 py-3 bg-white text-dark focus:outline-none focus:ring-2 focus:ring-primary font-sans text-sm"
                >
                  <option value="">-- Pilih Pelatih --</option>
                  {allCoaches.map(c => (
                    <option key={c.id} value={c.id}>{c.nama} ({getRoleLabel(c.role)})</option>
                  ))}
                </select>
              </div>

              <Input
                label="Nominal Pinjaman (Rp) *"
                type="number"
                placeholder="Misal: 500000"
                value={formKasbon.nominal}
                onChange={e => setFormKasbon({ ...formKasbon, nominal: e.target.value })}
              />

              <Input
                label="Tanggal Penyerahan Uang *"
                type="date"
                value={formKasbon.tglPinjam}
                onChange={e => setFormKasbon({ ...formKasbon, tglPinjam: e.target.value })}
              />

              <Input
                label="Keterangan / Keperluan *"
                type="text"
                placeholder="Misal: Pinjaman keperluan medis darurat"
                value={formKasbon.keterangan}
                onChange={e => setFormKasbon({ ...formKasbon, keterangan: e.target.value })}
              />

              <div className="bg-[#FEF3C7] border-2 border-dark/30 rounded-xl p-3 text-xs text-dark/80">
                💡 <strong>Catatan:</strong> Setelah disimpan, pelatih ini akan otomatis memiliki opsi pemotongan saat Anda generate payroll bulanan.
              </div>

              <div className="flex gap-2 justify-end mt-2">
                <Button variant="secondary" onClick={() => setModalKasbonOpen(false)} disabled={savingKasbon}>
                  Batal
                </Button>
                <Button variant="primary" onClick={handleSaveKasbonBaru} disabled={savingKasbon}>
                  {savingKasbon ? 'Menyimpan...' : 'Simpan Kasbon'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* MODAL: CATAT BAYAR TUNAI */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {modalBayarOpen && (
        <div className="fixed inset-0 bg-dark/50 flex items-center justify-center p-4 z-50 animate-fade-in">
          <Card className="w-full max-w-lg shadow-2xl border-4 border-dark">
            <h3 className="font-bold text-dark text-xl font-sans mb-1 flex items-center gap-2">
              <span>💵 Catat Pembayaran Tunai / Manual</span>
            </h3>
            <p className="text-xs text-dark/60 font-sans mb-4">
              Pembayaran tunai ini akan otomatis dicatat sebagai <strong>Pemasukan Kas Club</strong> sehingga saldo kas riil bertambah kembali.
            </p>

            <div className="flex flex-col gap-4 font-sans">
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-dark text-xs">Pilih Kasbon yang Dibayar *</label>
                <select
                  value={formBayar.kasbonId}
                  onChange={e => {
                    const kbId = e.target.value
                    const targetKb = activeKasbonOnly.find(k => k.id === kbId)
                    setFormBayar({
                      ...formBayar,
                      kasbonId: kbId,
                      nominal: targetKb ? String(targetKb.sisa_hutang) : '',
                    })
                  }}
                  className="border-2 border-dark rounded-2xl px-4 py-3 bg-white text-dark focus:outline-none focus:ring-2 focus:ring-primary font-sans text-sm"
                >
                  <option value="">-- Pilih Kasbon Aktif --</option>
                  {activeKasbonOnly.map(k => (
                    <option key={k.id} value={k.id}>
                      {k.pelatih?.nama || 'Pelatih'} — Sisa: {formatRupiah(Number(k.sisa_hutang))} ({k.keterangan})
                    </option>
                  ))}
                </select>
              </div>

              <Input
                label="Nominal Pembayaran (Rp) *"
                type="number"
                placeholder="Nominal uang yang disetor"
                value={formBayar.nominal}
                onChange={e => setFormBayar({ ...formBayar, nominal: e.target.value })}
              />

              <Input
                label="Tanggal Pembayaran *"
                type="date"
                value={formBayar.tglBayar}
                onChange={e => setFormBayar({ ...formBayar, tglBayar: e.target.value })}
              />

              <Input
                label="Catatan Pembayaran (Opsional)"
                type="text"
                placeholder="Misal: Cicilan tunai bulan September via transfer BCA"
                value={formBayar.catatan}
                onChange={e => setFormBayar({ ...formBayar, catatan: e.target.value })}
              />

              <div className="flex gap-2 justify-end mt-2">
                <Button variant="secondary" onClick={() => setModalBayarOpen(false)} disabled={savingBayar}>
                  Batal
                </Button>
                <Button variant="primary" onClick={handleSaveBayarTunai} disabled={savingBayar}>
                  {savingBayar ? 'Memproses...' : 'Catat Pembayaran'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* MODAL: RIWAYAT PEMBAYARAN KASBON */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {modalHistoryOpen && selectedKasbon && (
        <div className="fixed inset-0 bg-dark/50 flex items-center justify-center p-4 z-50 animate-fade-in">
          <Card className="w-full max-w-lg shadow-2xl border-4 border-dark">
            <div className="flex items-center justify-between mb-4 border-b-2 border-dark pb-3">
              <div>
                <h3 className="font-bold text-dark text-lg font-sans">📜 Riwayat Pembayaran Kasbon</h3>
                <p className="text-xs text-dark/60 font-sans">
                  {selectedKasbon.pelatih?.nama} — Pokok: {formatRupiah(Number(selectedKasbon.nominal_pinjaman))}
                </p>
              </div>
              <Badge color={selectedKasbon.status === 'lunas' ? 'primary' : 'accent'}>
                Sisa: {formatRupiah(Number(selectedKasbon.sisa_hutang))}
              </Badge>
            </div>

            <div className="flex flex-col gap-3 font-sans max-h-80 overflow-y-auto">
              {loadingHistory ? (
                <div className="text-center py-6 text-dark/50">Memuat riwayat...</div>
              ) : historyList.length === 0 ? (
                <div className="text-center py-6 text-dark/50 italic">
                  Belum ada pembayaran atau cicilan untuk kasbon ini.
                </div>
              ) : (
                historyList.map(h => (
                  <div key={h.id} className="p-3 bg-background border border-dark/30 rounded-xl flex items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="font-bold text-dark">
                        {new Date(h.tgl_bayar + 'T00:00:00').toLocaleDateString('id-ID', {
                          day: 'numeric', month: 'long', year: 'numeric'
                        })}
                      </div>
                      <div className="text-dark/60 mt-0.5 flex items-center gap-1.5">
                        <span className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${
                          h.metode === 'potong_honor' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'
                        }`}>
                          {h.metode === 'potong_honor' ? '✂️ Potong Payroll' : '💵 Tunai/Manual'}
                        </span>
                        {h.catatan && <span>— {h.catatan}</span>}
                      </div>
                    </div>
                    <div className="text-right font-bold text-sm text-green-700 font-sans">
                      +{formatRupiah(Number(h.nominal))}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end mt-4 pt-3 border-t border-dark/20">
              <Button variant="secondary" onClick={() => setModalHistoryOpen(false)}>
                Tutup
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* MODAL: EDIT POTONGAN KASBON PAYROLL */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {modalEditPotonganOpen && editingDetail && (
        <div className="fixed inset-0 bg-dark/50 flex items-center justify-center p-4 z-50 animate-fade-in">
          <Card className="w-full max-w-md shadow-2xl border-4 border-dark">
            <h3 className="font-bold text-dark text-lg font-sans mb-1">
              ✏️ Atur Potongan Kasbon
            </h3>
            <p className="text-xs text-dark/60 font-sans mb-4">
              Pelatih: <strong>{editingDetail.pelatih?.nama}</strong>
            </p>

            <div className="flex flex-col gap-3 font-sans text-xs">
              <div className="p-3 bg-background border border-dark/20 rounded-xl flex justify-between">
                <span>Honor Kotor Periode Ini:</span>
                <span className="font-bold text-dark">{formatRupiah(editingDetail.total_payout)}</span>
              </div>

              <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex justify-between text-red-700">
                <span>Total Sisa Kasbon Aktif:</span>
                <span className="font-bold">{formatRupiah(coachDebtBalance)}</span>
              </div>

              <Input
                label="Nominal yang Dipotong Bulan Ini (Rp)"
                type="number"
                placeholder="0"
                value={inputPotongan}
                onChange={e => setInputPotongan(e.target.value)}
              />

              <div className="p-3 bg-green-50 border border-green-200 rounded-xl flex justify-between text-green-800 font-bold">
                <span>Honor Bersih yang Diterima:</span>
                <span>{formatRupiah(Math.max(0, editingDetail.total_payout - (Number(inputPotongan) || 0)))}</span>
              </div>

              <div className="flex gap-2 justify-end mt-2">
                <Button variant="secondary" onClick={() => setModalEditPotonganOpen(false)} disabled={savingPotongan}>
                  Batal
                </Button>
                <Button variant="primary" onClick={handleSavePotongan} disabled={savingPotongan}>
                  {savingPotongan ? 'Menyimpan...' : 'Simpan Potongan'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
