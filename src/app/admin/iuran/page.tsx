'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
const supabase = createClient()
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import type { Iuran } from '@/lib/types'

type StatusBayar = 'belum_bayar' | 'menunggu_verifikasi' | 'lunas' | 'ditolak'
type IuranWithSiswa = Iuran & {
  siswa: {
    id: string
    nama: string
    program_kelas_id?: string
    program_kelas?: {
      nama_program: string
      biaya_bulanan: number
    }
  }
}

const STATUS_CONFIG: Record<StatusBayar, { label: string; color: 'primary' | 'secondary' | 'accent' | 'dark'; icon: string }> = {
  belum_bayar:          { label: 'Belum Bayar',    color: 'accent',    icon: '⏳' },
  menunggu_verifikasi:  { label: 'Menunggu Verif', color: 'secondary', icon: '🔍' },
  lunas:                { label: 'Lunas',           color: 'primary',   icon: '✅' },
  ditolak:              { label: 'Ditolak',          color: 'dark',      icon: '❌' },
}

const BULAN_NAMES = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

function formatRupiah(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
}

export default function AdminIuranPage() {
  const now = new Date()

  const [filterBulan, setFilterBulan] = useState(String(now.getMonth() + 1).padStart(2, '0'))
  const [filterTahun, setFilterTahun] = useState(String(now.getFullYear()))
  const [filterStatus, setFilterStatus] = useState<string>('semua')

  const [iuranList, setIuranList] = useState<IuranWithSiswa[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [buktiUrl, setBuktiUrl] = useState<Record<string, string>>({})
  const [catatan, setCatatan] = useState<Record<string, string>>({})

  // Edit nominal state
  const [editingNominalId, setEditingNominalId] = useState<string | null>(null)
  const [editingNominalVal, setEditingNominalVal] = useState<string>('')
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 4000)
  }

  const fetchIuran = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('iuran')
      .select('*, siswa:siswa_id(id, nama, program_kelas_id, program_kelas:program_kelas_id(nama_program, biaya_bulanan))')
      .eq('bulan', parseInt(filterBulan))
      .eq('tahun', parseInt(filterTahun))
      .order('created_at', { ascending: false })

    if (filterStatus !== 'semua') {
      query = query.eq('status_bayar', filterStatus)
    }

    const { data } = await query
    setIuranList((data || []) as unknown as IuranWithSiswa[])
    setLoading(false)
  }, [filterBulan, filterTahun, filterStatus])

  useEffect(() => { fetchIuran() }, [fetchIuran])

  // Get signed URL for bukti transfer
  const getBuktiUrl = async (iuranId: string, path: string) => {
    if (buktiUrl[iuranId]) return
    const { data } = await supabase.storage
      .from('bukti-transfer')
      .createSignedUrl(path, 60 * 10) // 10 menit
    if (data?.signedUrl) {
      setBuktiUrl(prev => ({ ...prev, [iuranId]: data.signedUrl }))
    }
  }

  const handleTandaiLunas = async (id: string) => {
    setActionLoading(id)
    await supabase.from('iuran').update({
      status_bayar: 'lunas',
      tgl_bayar: new Date().toISOString(),
      metode: 'tunai',
    }).eq('id', id)
    await fetchIuran()
    setActionLoading(null)
  }

  const handleApprove = async (id: string) => {
    setActionLoading(id)
    await supabase.from('iuran').update({
      status_bayar: 'lunas',
      tgl_bayar: new Date().toISOString(),
    }).eq('id', id)
    await fetchIuran()
    setActionLoading(null)
  }

  const handleReject = async (id: string) => {
    setActionLoading(id)
    await supabase.from('iuran').update({
      status_bayar: 'ditolak',
      catatan: catatan[id] || 'Bukti transfer tidak valid',
    }).eq('id', id)
    await fetchIuran()
    setActionLoading(null)
  }

  const handleSyncSingleNominal = async (id: string, newNominal: number) => {
    setActionLoading(id)
    const { error } = await supabase.from('iuran').update({ nominal: newNominal }).eq('id', id)
    if (error) {
      alert('Gagal menyesuaikan nominal: ' + error.message)
    } else {
      showToast(`✅ Nominal tagihan berhasil disesuaikan ke ${formatRupiah(newNominal)}`)
      await fetchIuran()
    }
    setActionLoading(null)
  }

  const handleSaveCustomNominal = async (id: string) => {
    const num = parseInt(editingNominalVal.replace(/\D/g, ''))
    if (isNaN(num) || num < 0) {
      alert('Masukkan nominal yang valid')
      return
    }
    setActionLoading(id)
    const { error } = await supabase.from('iuran').update({ nominal: num }).eq('id', id)
    if (error) {
      alert('Gagal mengubah nominal: ' + error.message)
    } else {
      showToast(`✅ Nominal tagihan berhasil diperbarui ke ${formatRupiah(num)}`)
      setEditingNominalId(null)
      await fetchIuran()
    }
    setActionLoading(null)
  }

  // Mismatched items (unpaid bills where nominal doesn't match active program tariff)
  const mismatchedItems = iuranList.filter(i => {
    if (i.status_bayar === 'lunas') return false
    const expected = Number(i.siswa?.program_kelas?.biaya_bulanan || 0)
    return expected > 0 && Number(i.nominal) !== expected
  })

  const handleSyncAllMismatched = async () => {
    if (mismatchedItems.length === 0) return
    setActionLoading('sync-all')
    try {
      for (const item of mismatchedItems) {
        const expected = Number(item.siswa?.program_kelas?.biaya_bulanan || 100000)
        await supabase.from('iuran').update({ nominal: expected }).eq('id', item.id)
      }
      showToast(`✅ Berhasil menyinkronkan ${mismatchedItems.length} tagihan dengan tarif kelas saat ini!`)
      await fetchIuran()
    } catch (err: any) {
      alert('Gagal menyinkronkan: ' + err.message)
    } finally {
      setActionLoading(null)
    }
  }

  // Summary stats
  const totalTagihan = iuranList.length
  const totalLunas = iuranList.filter(i => i.status_bayar === 'lunas').length
  const totalNominalLunas = iuranList.filter(i => i.status_bayar === 'lunas').reduce((s, i) => s + Number(i.nominal), 0)
  const totalMenunggu = iuranList.filter(i => i.status_bayar === 'menunggu_verifikasi').length

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-8">
      {/* Toast Alert */}
      {toastMsg && (
        <div className="fixed top-5 right-5 z-50 p-4 bg-primary text-dark font-bold font-sans rounded-2xl border-2 border-dark shadow-brutal animate-bounce">
          {toastMsg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold font-sans text-dark">Kelola Iuran</h1>
          <p className="text-dark/60 font-sans mt-1">Pantau dan verifikasi pembayaran iuran bulanan</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {mismatchedItems.length > 0 && (
            <Button
              variant="accent"
              onClick={handleSyncAllMismatched}
              disabled={actionLoading === 'sync-all' || loading}
              className="text-sm font-bold animate-pulse"
            >
              {actionLoading === 'sync-all' ? '⏳ Menyinkronkan...' : `🔄 Sinkronkan ${mismatchedItems.length} Tarif Beda`}
            </Button>
          )}
          <a href="/admin/iuran/generate">
            <Button variant="primary">⚡ Generate Tagihan</Button>
          </a>
        </div>
      </div>

      {/* Warning banner jika ada perbedaan tarif kelas */}
      {mismatchedItems.length > 0 && (
        <div className="p-4 bg-accent/15 border-2 border-accent rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-dark">
          <div>
            <p className="font-bold font-sans text-sm text-accent">
              ⚠️ Terdeteksi {mismatchedItems.length} Tagihan Belum Sesuai dengan Kelas Siswa
            </p>
            <p className="text-xs text-dark/70 font-sans mt-0.5">
              Siswa mungkin berpindah kelas dari Umum ke Prestasi (atau sebaliknya) setelah tagihan dibuat. Klik tombol untuk menyesuaikan otomatis.
            </p>
          </div>
          <Button
            variant="accent"
            onClick={handleSyncAllMismatched}
            disabled={actionLoading === 'sync-all'}
            className="text-xs py-2 px-3 whitespace-nowrap"
          >
            🔄 Sinkronkan Sekarang
          </Button>
        </div>
      )}

      {/* Filter */}
      <Card>
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex flex-col gap-2">
            <label className="font-bold text-dark">Bulan</label>
            <select value={filterBulan} onChange={e => setFilterBulan(e.target.value)}
              className="border-2 border-dark rounded-2xl px-4 py-3 bg-white text-dark focus:outline-none focus:ring-2 focus:ring-primary font-sans min-w-[140px]">
              {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map(m => (
                <option key={m} value={m}>{BULAN_NAMES[parseInt(m)]}</option>
              ))}
            </select>
          </div>
          <Input label="Tahun" type="number" value={filterTahun}
            onChange={e => setFilterTahun(e.target.value)} className="max-w-[120px]" />
          <div className="flex flex-col gap-2">
            <label className="font-bold text-dark">Status</label>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="border-2 border-dark rounded-2xl px-4 py-3 bg-white text-dark focus:outline-none focus:ring-2 focus:ring-primary font-sans min-w-[180px]">
              <option value="semua">Semua Status</option>
              <option value="belum_bayar">Belum Bayar</option>
              <option value="menunggu_verifikasi">Menunggu Verifikasi</option>
              <option value="lunas">Lunas</option>
              <option value="ditolak">Ditolak</option>
            </select>
          </div>
          <Button variant="secondary" onClick={fetchIuran} disabled={loading}>
            {loading ? 'Memuat...' : '🔍 Terapkan'}
          </Button>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Tagihan', val: totalTagihan, bg: 'bg-white' },
          { label: '✅ Lunas', val: totalLunas, bg: 'bg-primary/20' },
          { label: '🔍 Menunggu Verif', val: totalMenunggu, bg: 'bg-secondary/20' },
          { label: '💵 Total Terkumpul', val: formatRupiah(totalNominalLunas), bg: 'bg-yellow-100' },
        ].map(s => (
          <Card key={s.label} className={`${s.bg} text-center p-4`}>
            <div className="text-xl font-bold font-sans text-dark">{s.val}</div>
            <div className="text-xs text-dark/60 font-sans mt-1">{s.label}</div>
          </Card>
        ))}
      </div>

      {/* Tabel Iuran */}
      <div className="flex flex-col gap-4">
        {loading ? (
          <Card className="text-center py-16 text-dark/50 font-sans">Memuat data...</Card>
        ) : iuranList.length === 0 ? (
          <Card className="text-center py-16 text-dark/50 font-sans">
            <div className="text-4xl mb-3">💰</div>
            <p>Tidak ada tagihan untuk periode ini.</p>
          </Card>
        ) : (
          iuranList.map(iuran => {
            const cfg = STATUS_CONFIG[iuran.status_bayar]
            const isLoading = actionLoading === iuran.id
            const buktiPath = iuran.bukti_transfer_url
            const programName = iuran.siswa?.program_kelas?.nama_program || 'Umum'
            const expectedNominal = Number(iuran.siswa?.program_kelas?.biaya_bulanan || 100000)
            const isNominalMismatch = iuran.status_bayar !== 'lunas' && Number(iuran.nominal) !== expectedNominal

            return (
              <Card key={iuran.id} className={`flex flex-col gap-4 ${isNominalMismatch ? 'border-2 border-accent/80' : ''}`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold font-sans text-dark text-lg">{iuran.siswa?.nama || '-'}</h3>
                      <Badge color="dark">{programName}</Badge>
                      <Badge color={cfg.color}>{cfg.icon} {cfg.label}</Badge>
                    </div>

                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      {editingNominalId === iuran.id ? (
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-sm font-bold text-dark font-sans">Rp</span>
                          <input
                            type="number"
                            value={editingNominalVal}
                            onChange={e => setEditingNominalVal(e.target.value)}
                            className="border-2 border-dark rounded-xl px-3 py-1 text-sm font-sans w-32 focus:outline-none focus:ring-2 focus:ring-primary"
                            placeholder="Nominal"
                            autoFocus
                          />
                          <Button
                            variant="primary"
                            onClick={() => handleSaveCustomNominal(iuran.id)}
                            disabled={isLoading}
                            className="text-xs py-1 px-2.5"
                          >
                            Simpan
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={() => setEditingNominalId(null)}
                            className="text-xs py-1 px-2.5"
                          >
                            Batal
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm text-dark/70 font-sans">
                            {BULAN_NAMES[iuran.bulan]} {iuran.tahun} · <strong className="text-dark font-mono text-base">{formatRupiah(iuran.nominal)}</strong>
                            {iuran.tgl_bayar && ` · Dibayar ${new Date(iuran.tgl_bayar).toLocaleDateString('id-ID')}`}
                            {iuran.metode && ` (${iuran.metode})`}
                          </p>
                          {iuran.status_bayar !== 'lunas' && (
                            <button
                              onClick={() => {
                                setEditingNominalId(iuran.id)
                                setEditingNominalVal(String(iuran.nominal))
                              }}
                              className="text-xs text-dark/50 hover:text-dark font-sans underline"
                              title="Ubah nominal tagihan ini secara manual"
                            >
                              ✏️ Edit
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {isNominalMismatch && (
                      <div className="mt-2 p-2 bg-accent/10 border border-accent rounded-xl flex items-center justify-between flex-wrap gap-2">
                        <span className="text-xs text-accent font-bold font-sans">
                          ⚠️ Tarif tagihan ({formatRupiah(iuran.nominal)}) ≠ Kelas saat ini ({programName}: {formatRupiah(expectedNominal)})
                        </span>
                        <Button
                          variant="accent"
                          onClick={() => handleSyncSingleNominal(iuran.id, expectedNominal)}
                          disabled={isLoading}
                          className="text-xs py-1 px-2.5"
                        >
                          {isLoading ? '⏳' : `⚡ Sesuaikan ke ${formatRupiah(expectedNominal)}`}
                        </Button>
                      </div>
                    )}

                    {iuran.catatan && (
                      <p className="text-sm text-accent font-sans mt-1">📝 {iuran.catatan}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 min-w-max">
                    {iuran.status_bayar === 'belum_bayar' && (
                      <Button variant="primary" onClick={() => handleTandaiLunas(iuran.id)} disabled={isLoading} className="text-sm py-2 px-4">
                        {isLoading ? '⏳' : '✅ Tandai Lunas (Tunai)'}
                      </Button>
                    )}

                    {iuran.status_bayar === 'menunggu_verifikasi' && (
                      <div className="flex flex-col gap-2">
                        {buktiPath && !buktiUrl[iuran.id] && (
                          <Button variant="secondary" onClick={() => getBuktiUrl(iuran.id, buktiPath)} className="text-sm py-2 px-4">
                            🖼️ Lihat Bukti Transfer
                          </Button>
                        )}
                        {buktiUrl[iuran.id] && (
                          <a href={buktiUrl[iuran.id]} target="_blank" rel="noopener noreferrer"
                            className="text-sm font-bold text-dark underline font-sans">
                            📎 Buka Bukti Transfer ↗
                          </a>
                        )}
                        <div className="flex gap-2">
                          <Button variant="primary" onClick={() => handleApprove(iuran.id)} disabled={isLoading} className="text-sm py-2 px-3">
                            {isLoading ? '⏳' : '✅ Approve'}
                          </Button>
                          <Button variant="accent" onClick={() => handleReject(iuran.id)} disabled={isLoading} className="text-sm py-2 px-3">
                            {isLoading ? '⏳' : '❌ Tolak'}
                          </Button>
                        </div>
                        <input
                          type="text"
                          placeholder="Alasan penolakan (opsional)"
                          value={catatan[iuran.id] || ''}
                          onChange={e => setCatatan(prev => ({ ...prev, [iuran.id]: e.target.value }))}
                          className="border border-dark/30 rounded-xl px-3 py-2 text-sm font-sans text-dark"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}

