'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
const supabase = createClient()
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import type { KeuanganClub } from '@/lib/types'

// ──────────────────────────────────────────
// Constants
// ──────────────────────────────────────────
const BULAN_NAMES = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const BULAN_FULL = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

const KATEGORI_INCOME = ['Iuran Bulanan', 'Daftar Ulang', 'Donasi', 'Lainnya']
const KATEGORI_EXPENSE = ['Honor Pelatih', 'Perlengkapan', 'Sewa Tempat', 'Administrasi', 'Lainnya']

// ──────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────
function formatRupiah(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
}

function formatRupiahShort(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}jt`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}rb`
  return String(n)
}

function formatTgl(tgl: string) {
  return new Date(tgl + 'T00:00:00').toLocaleDateString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric'
  })
}

// ──────────────────────────────────────────
// Types
// ──────────────────────────────────────────
type Sumber = 'manual' | 'iuran' | 'honor'

interface TransaksiUnified {
  id: string
  tgl: string          // YYYY-MM-DD
  bulan: number
  tahun: number
  jenis: 'income' | 'expense'
  kategori: string
  keterangan: string
  nominal: number
  sumber: Sumber
  canEdit: boolean
  canDelete: boolean
}

interface EditForm {
  id: string
  tgl: string
  jenis: 'income' | 'expense'
  kategori: string
  nominal: string
  keterangan: string
}

// ──────────────────────────────────────────
// Badge sumber config
// ──────────────────────────────────────────
const SUMBER_CONFIG: Record<Sumber, { label: string; color: 'primary' | 'secondary' | 'dark' | 'accent' }> = {
  manual:  { label: '✏️ Manual',        color: 'secondary' },
  iuran:   { label: '💰 Iuran',         color: 'primary'   },
  honor:   { label: '🏆 Honor Pelatih', color: 'dark'      },
}

// ──────────────────────────────────────────
// Main Component
// ──────────────────────────────────────────
export default function AdminKeuanganPage() {
  const now = new Date()

  // ── Filter state
  const [tahunFilter, setTahunFilter] = useState(String(now.getFullYear()))
  const [bulanFilter, setBulanFilter] = useState('0') // '0' = Semua Bulan
  const [jenisFilter, setJenisFilter] = useState('semua') // semua | income | expense
  const [sumberFilter, setSumberFilter] = useState('semua') // semua | manual | iuran | honor

  // ── Data state
  const [manualList, setManualList] = useState<KeuanganClub[]>([])
  const [iuranLunas, setIuranLunas] = useState<{ bulan: number; tahun: number; total: number; keterangan: string; tgl: string; id: string; nominal: number; siswa_nama: string }[]>([])
  const [honorDibayar, setHonorDibayar] = useState<{ bulan: number; tahun: number; total: number; tgl: string; id: string; pelatih_nama: string }[]>([])
  const [loading, setLoading] = useState(true)

  // ── Add form state
  const [formOpen, setFormOpen] = useState(false)
  const [formJenis, setFormJenis] = useState<'income' | 'expense'>('income')
  const [formKategori, setFormKategori] = useState('Lainnya')
  const [formNominal, setFormNominal] = useState('')
  const [formKeterangan, setFormKeterangan] = useState('')
  const [formTgl, setFormTgl] = useState(now.toISOString().split('T')[0])
  const [formSaving, setFormSaving] = useState(false)
  const [formSuccess, setFormSuccess] = useState(false)

  // ── Edit modal state
  const [editForm, setEditForm] = useState<EditForm | null>(null)
  const [editSaving, setEditSaving] = useState(false)

  // ── Delete confirm state
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // ──────────────────────────────────────────
  // Fetch Data
  // ──────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true)
    const tahun = parseInt(tahunFilter)

    // 1. Transaksi manual
    const { data: txData } = await supabase
      .from('keuangan_club')
      .select('*')
      .gte('tgl', `${tahun}-01-01`)
      .lte('tgl', `${tahun}-12-31`)
      .order('tgl', { ascending: false })
    setManualList((txData || []) as KeuanganClub[])

    // 2. Iuran lunas — per-record (untuk riwayat detail)
    const { data: iuranData } = await supabase
      .from('iuran')
      .select('id, bulan, tahun, nominal, tgl_bayar, siswa:siswa_id(nama)')
      .eq('tahun', tahun)
      .eq('status_bayar', 'lunas')
      .order('tgl_bayar', { ascending: false })

    const iuranMapped = (iuranData || []).map((i: any) => ({
      id: i.id,
      bulan: i.bulan,
      tahun: i.tahun,
      nominal: Number(i.nominal),
      tgl: i.tgl_bayar ? i.tgl_bayar.split('T')[0] : `${i.tahun}-${String(i.bulan).padStart(2, '0')}-01`,
      keterangan: `Iuran ${BULAN_FULL[i.bulan]} ${i.tahun}`,
      total: Number(i.nominal),
      siswa_nama: i.siswa?.nama || 'Siswa',
    }))
    setIuranLunas(iuranMapped)

    // 3. Honor dibayar — dari payroll_details + payroll_runs (sistem payroll baru)
    const { data: honorData } = await supabase
      .from('payroll_details')
      .select('id, total_payout, tgl_dibayar, pelatih:pelatih_id(nama), payroll_run:payroll_run_id(bulan, tahun)')
      .eq('status_dibayar', true)
      .order('tgl_dibayar', { ascending: false })

    const honorMapped = (honorData || [])
      .filter((h: any) => h.payroll_run?.tahun === tahun)
      .map((h: any) => ({
        id: h.id,
        bulan: h.payroll_run?.bulan || 1,
        tahun: h.payroll_run?.tahun || tahun,
        total: Number(h.total_payout),
        tgl: h.tgl_dibayar || `${h.payroll_run?.tahun}-${String(h.payroll_run?.bulan).padStart(2, '0')}-01`,
        pelatih_nama: h.pelatih?.nama || 'Pelatih',
      }))
    setHonorDibayar(honorMapped)

    setLoading(false)
  }, [tahunFilter])

  useEffect(() => { fetchData() }, [fetchData])

  // ──────────────────────────────────────────
  // Unified Transactions
  // ──────────────────────────────────────────
  const allTransaksi = useMemo<TransaksiUnified[]>(() => {
    const list: TransaksiUnified[] = []

    // Manual transactions
    for (const tx of manualList) {
      const d = new Date(tx.tgl + 'T00:00:00')
      list.push({
        id: tx.id,
        tgl: tx.tgl,
        bulan: d.getMonth() + 1,
        tahun: d.getFullYear(),
        jenis: tx.jenis,
        kategori: tx.kategori,
        keterangan: tx.keterangan,
        nominal: Number(tx.nominal),
        sumber: 'manual',
        canEdit: true,
        canDelete: true,
      })
    }

    // Iuran lunas
    for (const i of iuranLunas) {
      list.push({
        id: `iuran_${i.id}`,
        tgl: i.tgl,
        bulan: i.bulan,
        tahun: i.tahun,
        jenis: 'income',
        kategori: 'Iuran Bulanan',
        keterangan: `${i.keterangan} — ${i.siswa_nama}`,
        nominal: i.total,
        sumber: 'iuran',
        canEdit: false,
        canDelete: false,
      })
    }

    // Honor dibayar
    for (const h of honorDibayar) {
      list.push({
        id: `honor_${h.id}`,
        tgl: h.tgl,
        bulan: h.bulan,
        tahun: h.tahun,
        jenis: 'expense',
        kategori: 'Honor Pelatih',
        keterangan: `Honor ${BULAN_FULL[h.bulan]} ${h.tahun} — ${h.pelatih_nama}`,
        nominal: h.total,
        sumber: 'honor',
        canEdit: false,
        canDelete: false,
      })
    }

    // Sort by tanggal descending
    return list.sort((a, b) => b.tgl.localeCompare(a.tgl))
  }, [manualList, iuranLunas, honorDibayar])

  // ── Filtered transactions
  const filteredTransaksi = useMemo(() => {
    return allTransaksi.filter(tx => {
      if (bulanFilter !== '0' && tx.bulan !== parseInt(bulanFilter)) return false
      if (jenisFilter !== 'semua' && tx.jenis !== jenisFilter) return false
      if (sumberFilter !== 'semua' && tx.sumber !== sumberFilter) return false
      return true
    })
  }, [allTransaksi, bulanFilter, jenisFilter, sumberFilter])

  // ──────────────────────────────────────────
  // Cashflow Chart Data (full year, all sources)
  // ──────────────────────────────────────────
  const cashflowData = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const bulan = i + 1
      const txBulan = allTransaksi.filter(t => t.bulan === bulan)
      const income = txBulan.filter(t => t.jenis === 'income').reduce((s, t) => s + t.nominal, 0)
      const expense = txBulan.filter(t => t.jenis === 'expense').reduce((s, t) => s + t.nominal, 0)
      return {
        name: BULAN_NAMES[bulan],
        Income: income,
        Expense: expense,
        Saldo: income - expense,
      }
    })
  }, [allTransaksi])

  // ── Summary totals
  const totalIncome = useMemo(() => allTransaksi.filter(t => t.jenis === 'income').reduce((s, t) => s + t.nominal, 0), [allTransaksi])
  const totalExpense = useMemo(() => allTransaksi.filter(t => t.jenis === 'expense').reduce((s, t) => s + t.nominal, 0), [allTransaksi])
  const saldoBersih = totalIncome - totalExpense

  // ── Income breakdown
  const incomeFromIuran = useMemo(() => allTransaksi.filter(t => t.sumber === 'iuran').reduce((s, t) => s + t.nominal, 0), [allTransaksi])
  const incomeFromManual = useMemo(() => allTransaksi.filter(t => t.sumber === 'manual' && t.jenis === 'income').reduce((s, t) => s + t.nominal, 0), [allTransaksi])
  const expenseFromHonor = useMemo(() => allTransaksi.filter(t => t.sumber === 'honor').reduce((s, t) => s + t.nominal, 0), [allTransaksi])
  const expenseFromManual = useMemo(() => allTransaksi.filter(t => t.sumber === 'manual' && t.jenis === 'expense').reduce((s, t) => s + t.nominal, 0), [allTransaksi])

  // ──────────────────────────────────────────
  // Handlers: Add
  // ──────────────────────────────────────────
  const handleAddTransaksi = async () => {
    const nominal = parseFloat(formNominal)
    if (isNaN(nominal) || nominal <= 0 || !formKeterangan.trim()) return
    setFormSaving(true)
    await supabase.from('keuangan_club').insert({
      tgl: formTgl,
      jenis: formJenis,
      kategori: formKategori,
      nominal,
      keterangan: formKeterangan,
    })
    setFormNominal('')
    setFormKeterangan('')
    setFormSuccess(true)
    setFormSaving(false)
    await fetchData()
    setTimeout(() => setFormSuccess(false), 3000)
  }

  // ──────────────────────────────────────────
  // Handlers: Edit
  // ──────────────────────────────────────────
  const openEdit = (tx: TransaksiUnified) => {
    setEditForm({
      id: tx.id,
      tgl: tx.tgl,
      jenis: tx.jenis,
      kategori: tx.kategori,
      nominal: String(tx.nominal),
      keterangan: tx.keterangan,
    })
  }

  const handleSaveEdit = async () => {
    if (!editForm) return
    const nominal = parseFloat(editForm.nominal)
    if (isNaN(nominal) || nominal <= 0 || !editForm.keterangan.trim()) return
    setEditSaving(true)
    const { error } = await supabase.from('keuangan_club').update({
      tgl: editForm.tgl,
      jenis: editForm.jenis,
      kategori: editForm.kategori,
      nominal,
      keterangan: editForm.keterangan,
    }).eq('id', editForm.id)
    setEditSaving(false)
    if (!error) {
      setEditForm(null)
      await fetchData()
    } else {
      alert('Gagal menyimpan: ' + error.message)
    }
  }

  // ──────────────────────────────────────────
  // Handlers: Delete
  // ──────────────────────────────────────────
  const handleDelete = async (id: string) => {
    setDeleteLoading(true)
    const { error } = await supabase.from('keuangan_club').delete().eq('id', id)
    if (error) alert('Gagal menghapus: ' + error.message)
    else {
      setDeleteConfirmId(null)
      await fetchData()
    }
    setDeleteLoading(false)
  }

  // ──────────────────────────────────────────
  // Export CSV (all unified transactions)
  // ──────────────────────────────────────────
  const handleExportCSV = () => {
    const headers = ['Tanggal', 'Bulan', 'Tahun', 'Jenis', 'Sumber', 'Kategori', 'Keterangan', 'Nominal']
    const rows = filteredTransaksi.map(tx => [
      tx.tgl,
      BULAN_FULL[tx.bulan],
      tx.tahun,
      tx.jenis === 'income' ? 'Income' : 'Expense',
      tx.sumber === 'manual' ? 'Manual' : tx.sumber === 'iuran' ? 'Iuran Siswa' : 'Honor Pelatih',
      tx.kategori,
      tx.keterangan,
      tx.nominal,
    ])
    const csv = 'data:text/csv;charset=utf-8,'
      + [headers.join(','), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n')
    const link = document.createElement('a')
    link.setAttribute('href', encodeURI(csv))
    link.setAttribute('download', `keuangan_${tahunFilter}_${bulanFilter !== '0' ? `bulan${bulanFilter}_` : ''}${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // ──────────────────────────────────────────
  // Grouping per bulan for display
  // ──────────────────────────────────────────
  const groupedByBulan = useMemo(() => {
    if (bulanFilter !== '0') return null // Single month — no grouping needed

    const groups: Record<string, TransaksiUnified[]> = {}
    for (const tx of filteredTransaksi) {
      const key = `${tx.tahun}-${String(tx.bulan).padStart(2, '0')}`
      if (!groups[key]) groups[key] = []
      groups[key].push(tx)
    }
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a))
  }, [filteredTransaksi, bulanFilter])

  const kategoriOptions = formJenis === 'income' ? KATEGORI_INCOME : KATEGORI_EXPENSE
  const editKategoriOptions = editForm ? (editForm.jenis === 'income' ? KATEGORI_INCOME : KATEGORI_EXPENSE) : []

  // ──────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-8">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold font-sans text-dark">📊 Keuangan Club</h1>
          <p className="text-dark/60 font-sans mt-1">
            Laporan cashflow terpadu — iuran siswa, honor pelatih, dan transaksi manual
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Input
            label="" type="number" value={tahunFilter}
            onChange={e => setTahunFilter(e.target.value)}
            className="max-w-[100px]"
          />
          <Button variant="secondary" onClick={fetchData} disabled={loading}>
            {loading ? '⏳' : '🔍'}
          </Button>
        </div>
      </div>

      {/* ── Summary 3 Kartu Utama ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-2 border-dark p-6">
          <div className="text-sm text-dark/60 font-sans mb-1">💵 Total Income</div>
          <div className="text-2xl font-bold font-sans text-green-700">{formatRupiah(totalIncome)}</div>
          <div className="mt-3 flex flex-col gap-1">
            <div className="flex justify-between text-xs text-dark/50 font-sans">
              <span>💰 Iuran Siswa</span>
              <span className="font-bold text-dark/70">{formatRupiah(incomeFromIuran)}</span>
            </div>
            <div className="flex justify-between text-xs text-dark/50 font-sans">
              <span>✏️ Manual</span>
              <span className="font-bold text-dark/70">{formatRupiah(incomeFromManual)}</span>
            </div>
          </div>
        </Card>

        <Card className="border-2 border-dark p-6">
          <div className="text-sm text-dark/60 font-sans mb-1">💸 Total Expense</div>
          <div className="text-2xl font-bold font-sans text-red-600">{formatRupiah(totalExpense)}</div>
          <div className="mt-3 flex flex-col gap-1">
            <div className="flex justify-between text-xs text-dark/50 font-sans">
              <span>🏆 Honor Pelatih</span>
              <span className="font-bold text-dark/70">{formatRupiah(expenseFromHonor)}</span>
            </div>
            <div className="flex justify-between text-xs text-dark/50 font-sans">
              <span>✏️ Manual</span>
              <span className="font-bold text-dark/70">{formatRupiah(expenseFromManual)}</span>
            </div>
          </div>
        </Card>

        <Card className={`border-2 text-center p-6 ${saldoBersih >= 0 ? 'bg-primary/10 border-primary' : 'bg-accent/10 border-accent'}`}>
          <div className="text-sm text-dark/60 font-sans mb-1">🏦 Saldo Bersih</div>
          <div className={`text-2xl font-bold font-sans ${saldoBersih >= 0 ? 'text-green-700' : 'text-red-600'}`}>
            {formatRupiah(saldoBersih)}
          </div>
          <div className="text-xs text-dark/40 font-sans mt-2">Tahun {tahunFilter}</div>
        </Card>
      </div>

      {/* ── Grafik Cashflow ── */}
      <Card>
        <h2 className="font-bold font-sans text-dark mb-6 text-lg">📈 Cashflow {tahunFilter}</h2>
        <div style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={cashflowData} margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E2A3820" />
              <XAxis dataKey="name" tick={{ fontFamily: 'Inter', fontSize: 12, fill: '#1E2A38' }} />
              <YAxis tickFormatter={formatRupiahShort} tick={{ fontFamily: 'Inter', fontSize: 11, fill: '#1E2A3870' }} />
              <Tooltip
                formatter={(value: any) => formatRupiah(Number(value || 0))}
                labelStyle={{ fontFamily: 'Inter', fontWeight: 'bold' }}
                contentStyle={{ borderRadius: 12, border: '2px solid #1E2A38', fontFamily: 'Inter' }}
              />
              <Legend wrapperStyle={{ fontFamily: 'Inter', fontSize: 13 }} />
              <Bar dataKey="Income" fill="#22C55E" radius={[6, 6, 0, 0]} />
              <Bar dataKey="Expense" fill="#F87171" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* ── Form Tambah Transaksi Manual ── */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold font-sans text-dark text-lg">➕ Tambah Transaksi Manual</h2>
          <button onClick={() => setFormOpen(!formOpen)}
            className="text-sm font-bold text-dark/50 hover:text-dark font-sans">
            {formOpen ? '▲ Tutup' : '▼ Buka Form'}
          </button>
        </div>
        {formOpen && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="font-bold text-dark text-sm">Jenis</label>
                <div className="flex gap-2">
                  {(['income', 'expense'] as const).map(j => (
                    <button key={j} onClick={() => { setFormJenis(j); setFormKategori('Lainnya') }}
                      className={`flex-1 py-3 rounded-2xl border-2 font-bold font-sans capitalize transition-all ${
                        formJenis === j ? 'bg-primary border-dark shadow-brutal' : 'bg-white border-dark/30 hover:border-dark'
                      }`}>
                      {j === 'income' ? '💵 Income' : '💸 Expense'}
                    </button>
                  ))}
                </div>
              </div>
              <Input label="Tanggal" type="date" value={formTgl} onChange={e => setFormTgl(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="font-bold text-dark text-sm">Kategori</label>
                <select value={formKategori} onChange={e => setFormKategori(e.target.value)}
                  className="border-2 border-dark rounded-2xl px-4 py-3 bg-white text-dark focus:outline-none focus:ring-2 focus:ring-primary font-sans">
                  {kategoriOptions.map(k => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>
              <Input label="Nominal (Rp)" type="number" placeholder="500000"
                value={formNominal} onChange={e => setFormNominal(e.target.value)} />
            </div>
            <Input label="Keterangan" type="text" placeholder="Deskripsi transaksi..."
              value={formKeterangan} onChange={e => setFormKeterangan(e.target.value)} />
            <Button variant="primary" onClick={handleAddTransaksi}
              disabled={formSaving || !formNominal || !formKeterangan.trim()}>
              {formSaving ? '⏳ Menyimpan...' : '💾 Simpan Transaksi'}
            </Button>
            {formSuccess && <p className="text-green-700 font-bold font-sans text-sm">✅ Transaksi berhasil disimpan!</p>}
          </div>
        )}
      </Card>

      {/* ── Filter Riwayat ── */}
      <Card>
        <div className="flex flex-wrap gap-4 items-end justify-between">
          <div className="flex flex-wrap gap-4 items-end">
            {/* Filter Bulan */}
            <div className="flex flex-col gap-2">
              <label className="font-bold text-dark text-sm">Bulan</label>
              <select value={bulanFilter} onChange={e => setBulanFilter(e.target.value)}
                className="border-2 border-dark rounded-2xl px-4 py-3 bg-white text-dark focus:outline-none focus:ring-2 focus:ring-primary font-sans min-w-[150px]">
                <option value="0">Semua Bulan</option>
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <option key={m} value={String(m)}>{BULAN_FULL[m]}</option>
                ))}
              </select>
            </div>

            {/* Filter Jenis */}
            <div className="flex flex-col gap-2">
              <label className="font-bold text-dark text-sm">Jenis</label>
              <select value={jenisFilter} onChange={e => setJenisFilter(e.target.value)}
                className="border-2 border-dark rounded-2xl px-4 py-3 bg-white text-dark focus:outline-none focus:ring-2 focus:ring-primary font-sans min-w-[140px]">
                <option value="semua">Semua</option>
                <option value="income">💵 Income</option>
                <option value="expense">💸 Expense</option>
              </select>
            </div>

            {/* Filter Sumber */}
            <div className="flex flex-col gap-2">
              <label className="font-bold text-dark text-sm">Sumber</label>
              <select value={sumberFilter} onChange={e => setSumberFilter(e.target.value)}
                className="border-2 border-dark rounded-2xl px-4 py-3 bg-white text-dark focus:outline-none focus:ring-2 focus:ring-primary font-sans min-w-[160px]">
                <option value="semua">Semua Sumber</option>
                <option value="manual">✏️ Manual</option>
                <option value="iuran">💰 Iuran Siswa</option>
                <option value="honor">🏆 Honor Pelatih</option>
              </select>
            </div>
          </div>

          <Button variant="secondary" onClick={handleExportCSV} disabled={filteredTransaksi.length === 0}>
            📤 Export CSV
          </Button>
        </div>

        {/* Stats filter hasil */}
        <div className="flex gap-4 mt-4 flex-wrap">
          {[
            { label: 'Total Entri', val: filteredTransaksi.length, bg: 'bg-white border-dark/20' },
            {
              label: '💵 Total Income', 
              val: formatRupiah(filteredTransaksi.filter(t => t.jenis === 'income').reduce((s, t) => s + t.nominal, 0)),
              bg: 'bg-green-50 border-green-200'
            },
            {
              label: '💸 Total Expense',
              val: formatRupiah(filteredTransaksi.filter(t => t.jenis === 'expense').reduce((s, t) => s + t.nominal, 0)),
              bg: 'bg-red-50 border-red-200'
            },
          ].map(s => (
            <div key={s.label} className={`flex-1 min-w-[120px] border-2 rounded-xl px-4 py-3 ${s.bg}`}>
              <div className="text-xs text-dark/50 font-sans">{s.label}</div>
              <div className="font-bold text-dark text-sm font-sans">{s.val}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* ── Tabel Riwayat Terpadu ── */}
      <Card>
        <h2 className="font-bold font-sans text-dark text-lg mb-4">
          Riwayat Transaksi {tahunFilter}
          {bulanFilter !== '0' && ` — ${BULAN_FULL[parseInt(bulanFilter)]}`}
          <span className="ml-2 font-normal text-sm text-dark/50">({filteredTransaksi.length} entri)</span>
        </h2>

        {loading ? (
          <div className="text-center py-10 text-dark/50 font-sans">Memuat...</div>
        ) : filteredTransaksi.length === 0 ? (
          <div className="text-center py-10 text-dark/50 font-sans">
            <div className="text-4xl mb-3">📭</div>
            <p>Belum ada transaksi untuk filter ini.</p>
          </div>
        ) : groupedByBulan ? (
          // Grouped by bulan (when filter = semua bulan)
          <div className="flex flex-col gap-6">
            {groupedByBulan.map(([key, txs]) => {
              const [tYear, tMon] = key.split('-')
              const bulanIncome = txs.filter(t => t.jenis === 'income').reduce((s, t) => s + t.nominal, 0)
              const bulanExpense = txs.filter(t => t.jenis === 'expense').reduce((s, t) => s + t.nominal, 0)
              return (
                <div key={key}>
                  {/* Bulan header */}
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-dark font-sans">
                      📅 {BULAN_FULL[parseInt(tMon)]} {tYear}
                    </h3>
                    <div className="flex flex-wrap gap-3 text-sm font-sans items-center">
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] uppercase tracking-wider text-dark/40 font-bold">💵 Income</span>
                        <span className="text-green-700 font-bold">{formatRupiah(bulanIncome)}</span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] uppercase tracking-wider text-dark/40 font-bold">💸 Expense</span>
                        <span className="text-red-600 font-bold">{formatRupiah(bulanExpense)}</span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] uppercase tracking-wider text-dark/40 font-bold">🏦 Saldo</span>
                        <span className={`font-bold ${(bulanIncome - bulanExpense) >= 0 ? 'text-dark' : 'text-red-700'}`}>
                          {formatRupiah(bulanIncome - bulanExpense)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <TransaksiTable
                    transaksiList={txs}
                    onEdit={openEdit}
                    onDeleteRequest={setDeleteConfirmId}
                    deleteConfirmId={deleteConfirmId}
                    deleteLoading={deleteLoading}
                    onDeleteConfirm={handleDelete}
                    onDeleteCancel={() => setDeleteConfirmId(null)}
                  />
                </div>
              )
            })}
          </div>
        ) : (
          // Single month — no grouping
          <TransaksiTable
            transaksiList={filteredTransaksi}
            onEdit={openEdit}
            onDeleteRequest={setDeleteConfirmId}
            deleteConfirmId={deleteConfirmId}
            deleteLoading={deleteLoading}
            onDeleteConfirm={handleDelete}
            onDeleteCancel={() => setDeleteConfirmId(null)}
          />
        )}
      </Card>

      {/* ── Edit Modal ── */}
      {editForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-dark/40 px-4">
          <div className="bg-white border-4 border-dark rounded-3xl shadow-brutal p-6 w-full max-w-lg flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-dark text-xl font-sans">✏️ Edit Transaksi</h3>
              <button onClick={() => setEditForm(null)}
                className="w-8 h-8 rounded-full border-2 border-dark font-bold flex items-center justify-center hover:bg-background">✕</button>
            </div>

            <div className="flex flex-col gap-4">
              {/* Jenis */}
              <div className="flex flex-col gap-2">
                <label className="font-bold text-dark text-sm">Jenis</label>
                <div className="flex gap-2">
                  {(['income', 'expense'] as const).map(j => (
                    <button key={j}
                      onClick={() => setEditForm(f => f ? { ...f, jenis: j, kategori: 'Lainnya' } : f)}
                      className={`flex-1 py-3 rounded-2xl border-2 font-bold font-sans capitalize transition-all ${
                        editForm.jenis === j ? 'bg-primary border-dark shadow-brutal' : 'bg-white border-dark/30 hover:border-dark'
                      }`}>
                      {j === 'income' ? '💵 Income' : '💸 Expense'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Input label="Tanggal" type="date" value={editForm.tgl}
                  onChange={e => setEditForm(f => f ? { ...f, tgl: e.target.value } : f)} />
                <Input label="Nominal (Rp)" type="number" value={editForm.nominal}
                  onChange={e => setEditForm(f => f ? { ...f, nominal: e.target.value } : f)} />
              </div>

              {/* Kategori */}
              <div className="flex flex-col gap-2">
                <label className="font-bold text-dark text-sm">Kategori</label>
                <select value={editForm.kategori}
                  onChange={e => setEditForm(f => f ? { ...f, kategori: e.target.value } : f)}
                  className="border-2 border-dark rounded-2xl px-4 py-3 bg-white text-dark focus:outline-none focus:ring-2 focus:ring-primary font-sans">
                  {editKategoriOptions.map(k => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>

              <Input label="Keterangan" type="text" value={editForm.keterangan}
                onChange={e => setEditForm(f => f ? { ...f, keterangan: e.target.value } : f)} />

              <div className="flex gap-3">
                <Button variant="primary" onClick={handleSaveEdit}
                  disabled={editSaving || !editForm.nominal || !editForm.keterangan.trim()}
                  className="flex-1">
                  {editSaving ? '⏳ Menyimpan...' : '💾 Simpan Perubahan'}
                </Button>
                <Button variant="secondary" onClick={() => setEditForm(null)} className="flex-1">
                  Batal
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ──────────────────────────────────────────
// Sub-component: Transaksi Table
// ──────────────────────────────────────────
function TransaksiTable({
  transaksiList,
  onEdit,
  onDeleteRequest,
  deleteConfirmId,
  deleteLoading,
  onDeleteConfirm,
  onDeleteCancel,
}: {
  transaksiList: TransaksiUnified[]
  onEdit: (tx: TransaksiUnified) => void
  onDeleteRequest: (id: string) => void
  deleteConfirmId: string | null
  deleteLoading: boolean
  onDeleteConfirm: (id: string) => void
  onDeleteCancel: () => void
}) {
  function formatRupiah(n: number) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
  }
  function formatTgl(tgl: string) {
    return new Date(tgl + 'T00:00:00').toLocaleDateString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric'
    })
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm font-sans">
        <thead>
          <tr className="border-b-2 border-dark">
            <th className="text-left py-2 px-3 font-bold text-dark">Tanggal</th>
            <th className="text-left py-2 px-3 font-bold text-dark">Jenis</th>
            <th className="text-left py-2 px-3 font-bold text-dark">Sumber</th>
            <th className="text-left py-2 px-3 font-bold text-dark">Kategori</th>
            <th className="text-left py-2 px-3 font-bold text-dark hidden md:table-cell">Keterangan</th>
            <th className="text-right py-2 px-3 font-bold text-dark">Nominal</th>
            <th className="text-right py-2 px-3 font-bold text-dark">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {transaksiList.map(tx => (
            <tr key={tx.id} className="border-b border-dark/10 hover:bg-background transition-colors">
              <td className="py-3 px-3 text-dark/70 whitespace-nowrap">{formatTgl(tx.tgl)}</td>
              <td className="py-3 px-3">
                <Badge color={tx.jenis === 'income' ? 'primary' : 'accent'}>
                  {tx.jenis === 'income' ? '💵 Income' : '💸 Expense'}
                </Badge>
              </td>
              <td className="py-3 px-3">
                <Badge color={SUMBER_CONFIG[tx.sumber].color}>
                  {SUMBER_CONFIG[tx.sumber].label}
                </Badge>
              </td>
              <td className="py-3 px-3 text-dark/70">{tx.kategori}</td>
              <td className="py-3 px-3 text-dark hidden md:table-cell max-w-[200px] truncate">{tx.keterangan}</td>
              <td className={`py-3 px-3 text-right font-bold whitespace-nowrap ${tx.jenis === 'income' ? 'text-green-700' : 'text-red-600'}`}>
                {tx.jenis === 'income' ? '+' : '-'}{formatRupiah(tx.nominal)}
              </td>
              <td className="py-3 px-3 text-right">
                {tx.canEdit ? (
                  deleteConfirmId === tx.id ? (
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => onDeleteConfirm(tx.id)}
                        disabled={deleteLoading}
                        className="bg-red-600 text-white px-2 py-1 rounded-lg text-xs font-bold border border-dark"
                      >
                        {deleteLoading ? '⏳' : '✓ Ya'}
                      </button>
                      <button
                        onClick={onDeleteCancel}
                        className="bg-white text-dark px-2 py-1 rounded-lg text-xs font-bold border border-dark"
                      >
                        Batal
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => onEdit(tx)}
                        className="bg-[#BFDBFE] text-dark hover:bg-blue-200 px-2 py-1.5 rounded-lg text-xs font-bold border border-dark transition-colors"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => onDeleteRequest(tx.id)}
                        className="bg-accent text-white hover:bg-red-700 px-2 py-1.5 rounded-lg text-xs font-bold border border-dark transition-colors"
                      >
                        🗑️
                      </button>
                    </div>
                  )
                ) : (
                  <span className="text-xs text-dark/30 font-sans italic">readonly</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
