'use client'

import { useEffect, useState, useCallback } from 'react'
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

const BULAN_NAMES = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const BULAN_FULL = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

function formatRupiah(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
}

function formatRupiahShort(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}jt`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}rb`
  return String(n)
}

const KATEGORI_INCOME = ['Iuran Bulanan', 'Daftar Ulang', 'Donasi', 'Lainnya']
const KATEGORI_EXPENSE = ['Honor Pelatih', 'Perlengkapan', 'Sewa Tempat', 'Administrasi', 'Lainnya']

export default function AdminKeuanganPage() {
  const now = new Date()

  const [tahunFilter, setTahunFilter] = useState(String(now.getFullYear()))
  const [transaksiList, setTransaksiList] = useState<KeuanganClub[]>([])
  const [iuranLunas, setIuranLunas] = useState<{ bulan: number; tahun: number; total: number }[]>([])
  const [honorDibayar, setHonorDibayar] = useState<{ bulan: number; tahun: number; total: number }[]>([])
  const [loading, setLoading] = useState(true)

  // Form state
  const [formOpen, setFormOpen] = useState(false)
  const [formJenis, setFormJenis] = useState<'income' | 'expense'>('income')
  const [formKategori, setFormKategori] = useState('Lainnya')
  const [formNominal, setFormNominal] = useState('')
  const [formKeterangan, setFormKeterangan] = useState('')
  const [formTgl, setFormTgl] = useState(now.toISOString().split('T')[0])
  const [formSaving, setFormSaving] = useState(false)
  const [formSuccess, setFormSuccess] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const tahun = parseInt(tahunFilter)

    // Transaksi manual
    const { data: txData } = await supabase
      .from('keuangan_club')
      .select('*')
      .gte('tgl', `${tahun}-01-01`)
      .lte('tgl', `${tahun}-12-31`)
      .order('tgl', { ascending: false })
    setTransaksiList((txData || []) as KeuanganClub[])

    // Iuran lunas (aggregated by bulan)
    const { data: iuranData } = await supabase
      .from('iuran')
      .select('bulan, tahun, nominal')
      .eq('tahun', tahun)
      .eq('status_bayar', 'lunas')

    const iuranByBulan: Record<number, number> = {}
    for (const i of iuranData || []) {
      iuranByBulan[i.bulan] = (iuranByBulan[i.bulan] || 0) + Number(i.nominal)
    }
    setIuranLunas(Object.entries(iuranByBulan).map(([b, t]) => ({ bulan: parseInt(b), tahun, total: t })))

    // Honor dibayar (aggregated by bulan)
    const { data: honorData } = await supabase
      .from('honor_pelatih')
      .select('bulan, tahun, honor_diterima')
      .eq('tahun', tahun)
      .eq('status_dibayar', true)

    const honorByBulan: Record<number, number> = {}
    for (const h of honorData || []) {
      honorByBulan[h.bulan] = (honorByBulan[h.bulan] || 0) + Number(h.honor_diterima)
    }
    setHonorDibayar(Object.entries(honorByBulan).map(([b, t]) => ({ bulan: parseInt(b), tahun, total: t })))

    setLoading(false)
  }, [tahunFilter])

  useEffect(() => { fetchData() }, [fetchData])

  // Build cashflow data per bulan for chart
  const cashflowData = Array.from({ length: 12 }, (_, i) => {
    const bulan = i + 1
    const iuranTotal = iuranLunas.find(x => x.bulan === bulan)?.total || 0
    const txIncome = transaksiList.filter(t => t.jenis === 'income' && new Date(t.tgl).getMonth() + 1 === bulan).reduce((s, t) => s + Number(t.nominal), 0)
    const txExpense = transaksiList.filter(t => t.jenis === 'expense' && new Date(t.tgl).getMonth() + 1 === bulan).reduce((s, t) => s + Number(t.nominal), 0)
    const honorTotal = honorDibayar.find(x => x.bulan === bulan)?.total || 0

    const income = iuranTotal + txIncome
    const expense = txExpense + honorTotal
    return {
      name: BULAN_NAMES[bulan],
      Income: income,
      Expense: expense,
      Saldo: income - expense,
    }
  })

  // Summary totals for current filter year
  const totalIncome = cashflowData.reduce((s, d) => s + d.Income, 0)
  const totalExpense = cashflowData.reduce((s, d) => s + d.Expense, 0)
  const saldoBersih = totalIncome - totalExpense

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

  const handleDelete = async (id: string, keterangan: string) => {
    if (!window.confirm(`Hapus transaksi "${keterangan}"?`)) return
    const { error } = await supabase.from('keuangan_club').delete().eq('id', id)
    if (error) alert('Gagal menghapus: ' + error.message)
    else await fetchData()
  }

  const kategoriOptions = formJenis === 'income' ? KATEGORI_INCOME : KATEGORI_EXPENSE

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold font-sans text-dark">📊 Keuangan Club</h1>
          <p className="text-dark/60 font-sans mt-1">Laporan cashflow dan pencatatan transaksi keuangan</p>
        </div>
        <div className="flex items-center gap-3">
          <Input
            label="" type="number" value={tahunFilter}
            onChange={e => setTahunFilter(e.target.value)}
            className="max-w-[100px]"
          />
          <Button variant="secondary" onClick={fetchData} disabled={loading}>
            {loading ? '...' : '🔍'}
          </Button>
        </div>
      </div>

      {/* Summary 3 kartu besar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-primary/10 border-primary border-2 text-center p-6">
          <div className="text-sm text-dark/60 font-sans mb-1">💵 Total Income</div>
          <div className="text-2xl font-bold font-sans text-dark">{formatRupiah(totalIncome)}</div>
          <div className="text-xs text-dark/40 font-sans mt-1">Iuran + transaksi income</div>
        </Card>
        <Card className="bg-accent/10 border-accent border-2 text-center p-6">
          <div className="text-sm text-dark/60 font-sans mb-1">💸 Total Expense</div>
          <div className="text-2xl font-bold font-sans text-dark">{formatRupiah(totalExpense)}</div>
          <div className="text-xs text-dark/40 font-sans mt-1">Honor + transaksi expense</div>
        </Card>
        <Card className={`border-2 text-center p-6 ${saldoBersih >= 0 ? 'bg-primary/20 border-primary' : 'bg-accent/20 border-accent'}`}>
          <div className="text-sm text-dark/60 font-sans mb-1">🏦 Saldo Bersih</div>
          <div className={`text-2xl font-bold font-sans ${saldoBersih >= 0 ? 'text-green-700' : 'text-red-600'}`}>
            {formatRupiah(saldoBersih)}
          </div>
          <div className="text-xs text-dark/40 font-sans mt-1">Tahun {tahunFilter}</div>
        </Card>
      </div>

      {/* Grafik Cashflow */}
      <Card>
        <h2 className="font-bold font-sans text-dark mb-6 text-lg">Grafik Cashflow {tahunFilter}</h2>
        <div style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={cashflowData} margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E2A3820" />
              <XAxis dataKey="name" tick={{ fontFamily: 'Inter', fontSize: 12, fill: '#1E2A38' }} />
              <YAxis tickFormatter={formatRupiahShort} tick={{ fontFamily: 'Inter', fontSize: 11, fill: '#1E2A3870' }} />
              <Tooltip
                formatter={(value: number) => formatRupiah(value)}
                labelStyle={{ fontFamily: 'Inter', fontWeight: 'bold' }}
                contentStyle={{ borderRadius: 12, border: '2px solid #1E2A38', fontFamily: 'Inter' }}
              />
              <Legend wrapperStyle={{ fontFamily: 'Inter', fontSize: 13 }} />
              <Bar dataKey="Income" fill="#22C55E" radius={[6, 6, 0, 0]} />
              <Bar dataKey="Expense" fill="#F4A5A5" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Form Tambah Transaksi */}
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
                <label className="font-bold text-dark">Jenis</label>
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
                <label className="font-bold text-dark">Kategori</label>
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
            {formSuccess && <p className="text-primary font-bold font-sans text-sm">✅ Transaksi berhasil disimpan!</p>}
          </div>
        )}
      </Card>

      {/* Tabel Transaksi */}
      <Card>
        <h2 className="font-bold font-sans text-dark mb-4 text-lg">
          Riwayat Transaksi Manual {tahunFilter}
          <span className="ml-2 font-normal text-sm text-dark/50">({transaksiList.length} entri)</span>
        </h2>
        {loading ? (
          <div className="text-center py-8 text-dark/50 font-sans">Memuat...</div>
        ) : transaksiList.length === 0 ? (
          <div className="text-center py-8 text-dark/50 font-sans">Belum ada transaksi manual.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-sans">
              <thead>
                <tr className="border-b-2 border-dark">
                  <th className="text-left py-2 px-3 font-bold text-dark">Tanggal</th>
                  <th className="text-left py-2 px-3 font-bold text-dark">Jenis</th>
                  <th className="text-left py-2 px-3 font-bold text-dark">Kategori</th>
                  <th className="text-left py-2 px-3 font-bold text-dark">Keterangan</th>
                  <th className="text-right py-2 px-3 font-bold text-dark">Nominal</th>
                  <th className="text-right py-2 px-3 font-bold text-dark">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {transaksiList.map(tx => (
                  <tr key={tx.id} className="border-b border-dark/10 hover:bg-background transition-colors">
                    <td className="py-3 px-3 text-dark/70">
                      {new Date(tx.tgl + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="py-3 px-3">
                      <Badge color={tx.jenis === 'income' ? 'primary' : 'accent'}>
                        {tx.jenis === 'income' ? '💵 Income' : '💸 Expense'}
                      </Badge>
                    </td>
                    <td className="py-3 px-3 text-dark/70">{tx.kategori}</td>
                    <td className="py-3 px-3 text-dark">{tx.keterangan}</td>
                    <td className={`py-3 px-3 text-right font-bold ${tx.jenis === 'income' ? 'text-green-700' : 'text-red-600'}`}>
                      {tx.jenis === 'income' ? '+' : '-'}{formatRupiah(tx.nominal)}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button 
                        onClick={() => handleDelete(tx.id, tx.keterangan)}
                        className="text-white bg-accent hover:bg-red-700 px-3 py-1.5 rounded-lg font-bold text-xs border border-dark transition-colors"
                      >
                        🗑️ Hapus
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
