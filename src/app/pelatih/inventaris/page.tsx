'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { formatRupiah, formatTanggal } from '@/lib/utils'
import type {
  InventarisBarang,
  InventarisPeminjaman,
  InventarisPengajuan,
  KategoriInventaris,
  Profile,
} from '@/lib/types'
import {
  getPelatihInventarisData,
  ajukanPinjamPelatih,
  ajukanKebutuhanAlat,
} from './actions'

const supabase = createClient()

const KATEGORI_OPTIONS: KategoriInventaris[] = [
  'Target & Kicking',
  'Proteksi & Sparring',
  'Fasilitas Dojang',
  'Elektronik & Scoring',
  'Lainnya',
]

type PelatihTab = 'katalog' | 'pinjaman' | 'usulan'

export default function PelatihInventarisPage() {
  const [activeTab, setActiveTab] = useState<PelatihTab>('katalog')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Auth & Profile
  const [pelatihId, setPelatihId] = useState<string | null>(null)
  const [coachName, setCoachName] = useState<string>('Pelatih')

  // Data states
  const [barangList, setBarangList] = useState<InventarisBarang[]>([])
  const [peminjamanList, setPeminjamanList] = useState<InventarisPeminjaman[]>([])
  const [pengajuanList, setPengajuanList] = useState<InventarisPengajuan[]>([])

  // Filters
  const [filterKategori, setFilterKategori] = useState<string>('Semua')
  const [searchKatalog, setSearchKatalog] = useState('')

  // Modals
  const [showModalPinjam, setShowModalPinjam] = useState(false)
  const [showModalUsulan, setShowModalUsulan] = useState(false)

  // Form: Pinjam
  const [pinjamForm, setPinjamForm] = useState({
    barang_id: '',
    jumlah: 1,
    tgl_pinjam: new Date().toISOString().split('T')[0],
    tgl_rencana_kembali: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    keperluan: '',
  })

  // Form: Usulan
  const [usulanForm, setUsulanForm] = useState({
    nama_barang: '',
    kategori: 'Target & Kicking' as KategoriInventaris,
    jumlah: 1,
    estimasi_harga: 0,
    alasan: '',
  })

  // Initialize Auth & Data
  const loadInitialData = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      let currentPelatihId: string | null = null

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('nama, pelatih_id')
          .eq('id', user.id)
          .single()

        if (profile) {
          if (profile.nama) setCoachName(profile.nama)
          if (profile.pelatih_id) {
            currentPelatihId = profile.pelatih_id
            setPelatihId(profile.pelatih_id)
          }
        }
      }

      const res = await getPelatihInventarisData(currentPelatihId)
      if (res.success && res.data) {
        setBarangList(res.data.barang || [])
        setPeminjamanList(res.data.peminjaman || [])
        setPengajuanList(res.data.pengajuan || [])
      } else {
        setMessage({ type: 'error', text: res.message || res.error || 'Gagal memuat inventaris' })
      }
    } catch (err: any) {
      console.error(err)
      setMessage({ type: 'error', text: 'Terjadi kesalahan memuat data' })
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadInitialData()
  }, [loadInitialData])

  // Filtered Barang
  const filteredBarang = useMemo(() => {
    return barangList.filter((b) => {
      const matchKategori = filterKategori === 'Semua' || b.kategori === filterKategori
      const matchSearch =
        b.nama_barang.toLowerCase().includes(searchKatalog.toLowerCase()) ||
        b.kode_barang.toLowerCase().includes(searchKatalog.toLowerCase()) ||
        (b.lokasi_penyimpanan && b.lokasi_penyimpanan.toLowerCase().includes(searchKatalog.toLowerCase()))
      return matchKategori && matchSearch
    })
  }, [barangList, filterKategori, searchKatalog])

  // Quick Open Pinjam with Selected Item
  const handleOpenPinjam = (barangId?: string) => {
    setPinjamForm({
      barang_id: barangId || barangList[0]?.id || '',
      jumlah: 1,
      tgl_pinjam: new Date().toISOString().split('T')[0],
      tgl_rencana_kembali: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      keperluan: '',
    })
    setShowModalPinjam(true)
  }

  // Submit: Pinjam
  const handleSubmitPinjam = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pelatihId) {
      setMessage({ type: 'error', text: 'Profil pelatih tidak terdeteksi. Silakan login kembali.' })
      return
    }

    setSaving(true)
    setMessage(null)

    const res = await ajukanPinjamPelatih({
      barang_id: pinjamForm.barang_id,
      pelatih_id: pelatihId,
      nama_peminjam: coachName,
      jumlah: Number(pinjamForm.jumlah),
      tgl_pinjam: pinjamForm.tgl_pinjam,
      tgl_rencana_kembali: pinjamForm.tgl_rencana_kembali,
      keperluan: pinjamForm.keperluan,
    })

    if (res.success) {
      setMessage({ type: 'success', text: 'Peminjaman alat berhasil dicatat! Harap kembalikan tepat waktu.' })
      setShowModalPinjam(false)
      await loadInitialData()
    } else {
      setMessage({ type: 'error', text: res.message || 'Gagal meminjam alat' })
    }
    setSaving(false)
  }

  // Submit: Usulan Kebutuhan
  const handleSubmitUsulan = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pelatihId) {
      setMessage({ type: 'error', text: 'Profil pelatih tidak terdeteksi. Silakan login kembali.' })
      return
    }

    setSaving(true)
    setMessage(null)

    const res = await ajukanKebutuhanAlat({
      pelatih_id: pelatihId,
      nama_barang: usulanForm.nama_barang,
      kategori: usulanForm.kategori,
      jumlah: Number(usulanForm.jumlah),
      estimasi_harga: Number(usulanForm.estimasi_harga) || 0,
      alasan: usulanForm.alasan,
    })

    if (res.success) {
      setMessage({ type: 'success', text: 'Usulan pengadaan alat berhasil dikirim ke Admin Club' })
      setShowModalUsulan(false)
      setUsulanForm({
        nama_barang: '',
        kategori: 'Target & Kicking',
        jumlah: 1,
        estimasi_harga: 0,
        alasan: '',
      })
      await loadInitialData()
    } else {
      setMessage({ type: 'error', text: res.message || 'Gagal mengirim usulan' })
    }
    setSaving(false)
  }

  const pinjamanAktifCount = peminjamanList.filter((p) => p.status === 'dipinjam').length

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-[4px] border-dark pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🥋</span>
            <h1 className="text-2xl md:text-3xl font-pixel text-dark">Inventaris & Alat Dojang</h1>
          </div>
          <p className="text-xs md:text-sm text-dark/70 font-sans mt-1">
            Cek ketersediaan alat latihan fisik, pinjam perlengkapan untuk event/latihan luar, dan ajukan usulan alat baru.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            className="text-xs py-2 px-3 flex items-center gap-1.5"
            onClick={() => handleOpenPinjam()}
          >
            <span>🔄</span> Pinjam Alat
          </Button>

          <Button
            variant="secondary"
            className="text-xs py-2 px-3 flex items-center gap-1.5"
            onClick={() => setShowModalUsulan(true)}
          >
            <span>💡</span> Usulkan Alat Baru
          </Button>
        </div>
      </div>

      {/* ALERT MESSAGE */}
      {message && (
        <div
          className={`p-3 border-[3px] border-dark font-sans text-xs flex items-center justify-between shadow-[3px_3px_0px_#1E2A38] ${
            message.type === 'success' ? 'bg-primary/20 text-dark' : 'bg-accent/20 text-dark'
          }`}
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="font-pixel text-xs px-2 hover:opacity-70">
            ✕
          </button>
        </div>
      )}

      {/* TAB NAVIGATION */}
      <div className="flex border-b-[3px] border-dark gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab('katalog')}
          className={`px-4 py-2 font-pixel text-xs border-[2px] transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'katalog'
              ? 'bg-secondary text-dark border-dark shadow-[3px_3px_0px_#1E2A38] translate-y-[-2px]'
              : 'bg-white border-dark/30 hover:border-dark'
          }`}
        >
          📦 Katalog Alat Siap Pakai ({barangList.length})
        </button>

        <button
          onClick={() => setActiveTab('pinjaman')}
          className={`px-4 py-2 font-pixel text-xs border-[2px] transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'pinjaman'
              ? 'bg-secondary text-dark border-dark shadow-[3px_3px_0px_#1E2A38] translate-y-[-2px]'
              : 'bg-white border-dark/30 hover:border-dark'
          }`}
        >
          <span>📋 Peminjaman Saya</span>
          {pinjamanAktifCount > 0 && (
            <span className="w-5 h-5 bg-accent text-white rounded-full text-[10px] flex items-center justify-center font-sans font-bold">
              {pinjamanAktifCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('usulan')}
          className={`px-4 py-2 font-pixel text-xs border-[2px] transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'usulan'
              ? 'bg-secondary text-dark border-dark shadow-[3px_3px_0px_#1E2A38] translate-y-[-2px]'
              : 'bg-white border-dark/30 hover:border-dark'
          }`}
        >
          💡 Usulan Saya ({pengajuanList.length})
        </button>
      </div>

      {loading ? (
        <div className="p-12 text-center">
          <div className="w-10 h-10 border-[4px] border-dark/20 border-t-secondary animate-spin mx-auto mb-3" />
          <p className="font-pixel text-xs text-dark/60">Memuat katalog alat...</p>
        </div>
      ) : (
        <>
          {/* ======================================================== */}
          {/* TAB 1: KATALOG ALAT SIAP PAKAI */}
          {/* ======================================================== */}
          {activeTab === 'katalog' && (
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {['Semua', ...KATEGORI_OPTIONS].map((kat) => (
                    <button
                      key={kat}
                      onClick={() => setFilterKategori(kat)}
                      className={`px-3 py-1 text-[11px] font-pixel border-[2px] border-dark transition-all whitespace-nowrap ${
                        filterKategori === kat ? 'bg-secondary text-dark shadow-[2px_2px_0px_#1E2A38]' : 'bg-white hover:bg-neutral-100'
                      }`}
                    >
                      {kat}
                    </button>
                  ))}
                </div>

                <div className="w-full md:w-64">
                  <Input
                    placeholder="Cari alat / kode / lokasi..."
                    value={searchKatalog}
                    onChange={(e) => setSearchKatalog(e.target.value)}
                    className="text-xs py-1.5"
                  />
                </div>
              </div>

              {filteredBarang.length === 0 ? (
                <div className="p-8 text-center bg-white border-[3px] border-dark shadow-[3px_3px_0px_#1E2A38]">
                  <p className="font-pixel text-xs text-dark/50">Tidak ada alat yang cocok dengan pencarian.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredBarang.map((item) => {
                    const siapPakai = item.kondisi_baik
                    const tersediaDojang = Math.max(0, item.kondisi_baik + item.kondisi_rusak_ringan - item.stok_dipinjam)

                    return (
                      <Card
                        key={item.id}
                        className="p-4 bg-white border-[3px] border-dark shadow-[3px_3px_0px_#1E2A38] flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div>
                              <span className="text-[10px] font-mono px-1.5 py-0.5 bg-neutral-100 border border-dark/30 rounded">
                                {item.kode_barang}
                              </span>
                              <h3 className="font-pixel text-sm text-dark mt-1">{item.nama_barang}</h3>
                              <p className="text-[11px] text-dark/60 font-sans">{item.kategori}</p>
                            </div>
                            <span className="text-xl">
                              {item.kategori.includes('Target')
                                ? '🎯'
                                : item.kategori.includes('Proteksi')
                                ? '🛡️'
                                : item.kategori.includes('Fasilitas')
                                ? '🥋'
                                : item.kategori.includes('Elektronik')
                                ? '⏱️'
                                : '📦'}
                            </span>
                          </div>

                          <div className="p-2.5 bg-neutral-50 border border-dark/20 text-xs font-sans space-y-1 my-2">
                            <div className="flex justify-between items-center">
                              <span className="text-dark/70">Kondisi Baik:</span>
                              <strong className="text-secondary-dark font-pixel">{siapPakai} unit</strong>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-dark/70">Sedang Dipinjam:</span>
                              <strong className="text-dark/80 font-pixel">{item.stok_dipinjam} unit</strong>
                            </div>
                            <div className="flex justify-between items-center pt-1 border-t border-dark/10">
                              <span className="font-bold text-dark">Siap Digunakan:</span>
                              <strong className="text-dark font-pixel text-sm">{tersediaDojang} unit</strong>
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-dark/60 font-sans">
                            <span>📍 {item.lokasi_penyimpanan || 'Dojang'}</span>
                            {item.keterangan && <span className="italic line-clamp-1">{item.keterangan}</span>}
                          </div>
                        </div>

                        <div className="mt-4 pt-3 border-t-[2px] border-dark/10 flex justify-end">
                          <Button
                            variant="primary"
                            disabled={tersediaDojang <= 0}
                            className="text-[10px] py-1.5 px-3 flex items-center gap-1"
                            onClick={() => handleOpenPinjam(item.id)}
                          >
                            <span>🔄</span> {tersediaDojang > 0 ? 'Pinjam Alat' : 'Stok Kosong'}
                          </Button>
                        </div>
                      </Card>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 2: PEMINJAMAN SAYA */}
          {/* ======================================================== */}
          {activeTab === 'pinjaman' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-pixel text-sm text-dark">Daftar Peminjaman Alat Oleh Saya</h3>
                <Button
                  variant="primary"
                  className="text-xs py-1.5 px-3 flex items-center gap-1.5"
                  onClick={() => handleOpenPinjam()}
                >
                  <span>➕</span> Pinjam Alat Baru
                </Button>
              </div>

              {peminjamanList.length === 0 ? (
                <div className="p-8 text-center bg-white border-[3px] border-dark shadow-[3px_3px_0px_#1E2A38]">
                  <p className="font-pixel text-xs text-dark/50">Belum ada riwayat peminjaman alat yang Anda catat.</p>
                </div>
              ) : (
                <div className="bg-white border-[3px] border-dark shadow-[3px_3px_0px_#1E2A38] overflow-x-auto">
                  <table className="w-full text-left text-xs font-sans">
                    <thead className="bg-neutral-100 border-b-[2px] border-dark font-pixel text-[10px] text-dark">
                      <tr>
                        <th className="p-3">Nama Alat</th>
                        <th className="p-3 text-center">Jumlah</th>
                        <th className="p-3">Tanggal Pinjam</th>
                        <th className="p-3">Batas Kembali</th>
                        <th className="p-3">Keperluan</th>
                        <th className="p-3 text-center">Status</th>
                        <th className="p-3">Catatan Kembali</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-dark/10">
                      {peminjamanList.map((p) => {
                        const isOverdue = p.status === 'dipinjam' && new Date(p.tgl_rencana_kembali) < new Date()

                        return (
                          <tr key={p.id} className="hover:bg-neutral-50">
                            <td className="p-3 font-semibold text-dark">
                              {p.inventaris_barang?.nama_barang || 'Alat'}
                              <span className="block text-[10px] font-mono text-dark/50">
                                {p.inventaris_barang?.kode_barang}
                              </span>
                            </td>
                            <td className="p-3 text-center font-pixel">{p.jumlah}</td>
                            <td className="p-3 whitespace-nowrap">{formatTanggal(p.tgl_pinjam)}</td>
                            <td className="p-3 whitespace-nowrap">
                              <span className={isOverdue ? 'text-accent font-bold' : ''}>
                                {formatTanggal(p.tgl_rencana_kembali)}
                              </span>
                            </td>
                            <td className="p-3 text-dark/70 max-w-xs">{p.keperluan}</td>
                            <td className="p-3 text-center">
                              {p.status === 'kembali' ? (
                                <Badge color="secondary" className="text-[9px]">
                                  Sudah Kembali
                                </Badge>
                              ) : isOverdue ? (
                                <Badge color="accent" className="text-[9px]">
                                  Terlambat
                                </Badge>
                              ) : (
                                <Badge color="primary" className="text-[9px]">
                                  Sedang Dipinjam
                                </Badge>
                              )}
                            </td>
                            <td className="p-3 text-dark/60 text-[11px]">
                              {p.catatan_kondisi_kembali || (p.status === 'dipinjam' ? 'Sedang dibawa' : '-')}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 3: USULAN KEBUTUHAN */}
          {/* ======================================================== */}
          {activeTab === 'usulan' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-pixel text-sm text-dark">Usulan Kebutuhan Alat Baru Saya</h3>
                <Button
                  variant="secondary"
                  className="text-xs py-1.5 px-3 flex items-center gap-1.5"
                  onClick={() => setShowModalUsulan(true)}
                >
                  <span>💡</span> Usulkan Alat Baru
                </Button>
              </div>

              {pengajuanList.length === 0 ? (
                <div className="p-8 text-center bg-white border-[3px] border-dark shadow-[3px_3px_0px_#1E2A38]">
                  <p className="font-pixel text-xs text-dark/50">Belum ada usulan alat yang Anda ajukan.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pengajuanList.map((item) => (
                    <Card
                      key={item.id}
                      className="p-4 bg-white border-[3px] border-dark shadow-[3px_3px_0px_#1E2A38] flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-[10px] font-mono text-dark/50">
                              {formatTanggal(item.created_at)}
                            </span>
                            <h4 className="font-pixel text-sm text-dark mt-0.5">{item.nama_barang}</h4>
                            <p className="text-[11px] text-dark/60 font-sans">{item.kategori}</p>
                          </div>

                          {item.status === 'menunggu' && (
                            <Badge color="primary" className="text-[10px]">
                              Menunggu
                            </Badge>
                          )}
                          {item.status === 'disetujui' && (
                            <Badge color="secondary" className="text-[10px]">
                              Disetujui
                            </Badge>
                          )}
                          {item.status === 'ditolak' && (
                            <Badge color="accent" className="text-[10px]">
                              Ditolak
                            </Badge>
                          )}
                        </div>

                        <div className="my-3 p-2 bg-neutral-50 border border-dark/15 text-xs font-sans space-y-1">
                          <div>
                            <strong>Jumlah:</strong> {item.jumlah} unit
                          </div>
                          {item.estimasi_harga ? (
                            <div>
                              <strong>Estimasi Biaya:</strong> {formatRupiah(item.estimasi_harga)}
                            </div>
                          ) : null}
                          <div>
                            <strong>Alasan Kebutuhan:</strong> {item.alasan}
                          </div>
                          {item.catatan_admin && (
                            <div className="text-secondary-dark text-[11px] pt-1 border-t border-dark/10">
                              <strong>Tanggapan Admin:</strong> {item.catatan_admin}
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ======================================================== */}
      {/* MODAL: PINJAM ALAT */}
      {/* ======================================================== */}
      {showModalPinjam && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border-[4px] border-dark shadow-[6px_6px_0px_#1E2A38] w-full max-w-lg p-5 animate-fade-in my-8">
            <div className="flex justify-between items-center pb-3 border-b-[3px] border-dark mb-4">
              <h3 className="font-pixel text-base text-dark">Formulir Peminjaman Alat</h3>
              <button onClick={() => setShowModalPinjam(false)} className="font-pixel text-sm hover:opacity-70">
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitPinjam} className="space-y-3 font-sans text-xs">
              <div>
                <label className="block font-bold mb-1">Pilih Alat</label>
                <select
                  required
                  value={pinjamForm.barang_id}
                  onChange={(e) => setPinjamForm({ ...pinjamForm, barang_id: e.target.value })}
                  className="w-full border-[2px] border-dark p-2 bg-white font-sans text-xs"
                >
                  <option value="">-- Pilih Alat --</option>
                  {barangList.map((b) => {
                    const sTersedia = Math.max(0, b.kondisi_baik + b.kondisi_rusak_ringan - b.stok_dipinjam)
                    return (
                      <option key={b.id} value={b.id} disabled={sTersedia <= 0}>
                        {b.nama_barang} (Tersedia: {sTersedia} unit)
                      </option>
                    )
                  })}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-bold mb-1">Jumlah</label>
                  <Input
                    type="number"
                    min="1"
                    required
                    value={pinjamForm.jumlah}
                    onChange={(e) => setPinjamForm({ ...pinjamForm, jumlah: parseInt(e.target.value) || 1 })}
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Tgl Pinjam</label>
                  <Input
                    type="date"
                    required
                    value={pinjamForm.tgl_pinjam}
                    onChange={(e) => setPinjamForm({ ...pinjamForm, tgl_pinjam: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Batas Kembali</label>
                  <Input
                    type="date"
                    required
                    value={pinjamForm.tgl_rencana_kembali}
                    onChange={(e) => setPinjamForm({ ...pinjamForm, tgl_rencana_kembali: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1">Keperluan Peminjaman</label>
                <textarea
                  rows={2}
                  required
                  value={pinjamForm.keperluan}
                  onChange={(e) => setPinjamForm({ ...pinjamForm, keperluan: e.target.value })}
                  className="w-full border-[2px] border-dark p-2 bg-white font-sans text-xs"
                  placeholder="Misal: Latihan tanding atlet prestasi di GOR Saburai"
                />
              </div>

              <div className="pt-3 border-t-[2px] border-dark/15 flex justify-end gap-2">
                <Button type="button" variant="accent" onClick={() => setShowModalPinjam(false)}>
                  Batal
                </Button>
                <Button type="submit" variant="primary" disabled={saving}>
                  {saving ? 'Menyimpan...' : 'Ajukan Pinjam'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: USULKAN ALAT BARU */}
      {/* ======================================================== */}
      {showModalUsulan && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border-[4px] border-dark shadow-[6px_6px_0px_#1E2A38] w-full max-w-lg p-5 animate-fade-in my-8">
            <div className="flex justify-between items-center pb-3 border-b-[3px] border-dark mb-4">
              <h3 className="font-pixel text-base text-dark">Usulkan Kebutuhan Alat Baru</h3>
              <button onClick={() => setShowModalUsulan(false)} className="font-pixel text-sm hover:opacity-70">
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitUsulan} className="space-y-3 font-sans text-xs">
              <div>
                <label className="block font-bold mb-1">Nama Alat yang Diusulkan</label>
                <Input
                  required
                  placeholder="Misal: Cone Latihan Agility / Speed Ladder"
                  value={usulanForm.nama_barang}
                  onChange={(e) => setUsulanForm({ ...usulanForm, nama_barang: e.target.value })}
                />
              </div>

              <div>
                <label className="block font-bold mb-1">Kategori</label>
                <select
                  value={usulanForm.kategori}
                  onChange={(e) => setUsulanForm({ ...usulanForm, kategori: e.target.value as KategoriInventaris })}
                  className="w-full border-[2px] border-dark p-2 bg-white font-sans text-xs"
                >
                  {KATEGORI_OPTIONS.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold mb-1">Perkiraan Jumlah Unit</label>
                  <Input
                    type="number"
                    min="1"
                    required
                    value={usulanForm.jumlah}
                    onChange={(e) => setUsulanForm({ ...usulanForm, jumlah: parseInt(e.target.value) || 1 })}
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Estimasi Total Harga (Rp, Opsional)</label>
                  <Input
                    type="number"
                    min="0"
                    value={usulanForm.estimasi_harga}
                    onChange={(e) => setUsulanForm({ ...usulanForm, estimasi_harga: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1">Alasan / Urgensi Kebutuhan</label>
                <textarea
                  rows={3}
                  required
                  value={usulanForm.alasan}
                  onChange={(e) => setUsulanForm({ ...usulanForm, alasan: e.target.value })}
                  className="w-full border-[2px] border-dark p-2 bg-white font-sans text-xs"
                  placeholder="Misal: Kicking pad yang ada saat ini sudah banyak robek dan atlet bertambah banyak..."
                />
              </div>

              <div className="pt-3 border-t-[2px] border-dark/15 flex justify-end gap-2">
                <Button type="button" variant="accent" onClick={() => setShowModalUsulan(false)}>
                  Batal
                </Button>
                <Button type="submit" variant="secondary" disabled={saving}>
                  {saving ? 'Mengirim...' : 'Kirim Usulan'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

