'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { formatRupiah, formatTanggal } from '@/lib/utils'
import type {
  InventarisBarang,
  InventarisPembelian,
  InventarisPeminjaman,
  InventarisPengajuan,
  KategoriInventaris,
  Pelatih,
} from '@/lib/types'
import {
  getAdminInventarisData,
  tambahBarangMaster,
  updateKondisiBarang,
  catatPembelianBaru,
  hapusPembelian,
  catatPeminjamanAdmin,
  kembalikanPeminjaman,
  updateStatusPengajuan,
} from './actions'

const KATEGORI_OPTIONS: KategoriInventaris[] = [
  'Target & Kicking',
  'Proteksi & Sparring',
  'Fasilitas Dojang',
  'Elektronik & Scoring',
  'Lainnya',
]

type TabActive = 'katalog' | 'pembelian' | 'peminjaman' | 'pengajuan'

export default function AdminInventarisPage() {
  const [activeTab, setActiveTab] = useState<TabActive>('katalog')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Data states
  const [barangList, setBarangList] = useState<InventarisBarang[]>([])
  const [pembelianList, setPembelianList] = useState<InventarisPembelian[]>([])
  const [peminjamanList, setPeminjamanList] = useState<InventarisPeminjaman[]>([])
  const [pengajuanList, setPengajuanList] = useState<InventarisPengajuan[]>([])
  const [pelatihList, setPelatihList] = useState<Pelatih[]>([])

  // Filters
  const [searchKatalog, setSearchKatalog] = useState('')
  const [filterKategori, setFilterKategori] = useState<string>('Semua')
  const [filterPeminjamanStatus, setFilterPeminjamanStatus] = useState<string>('Semua')

  // Modals
  const [showModalMaster, setShowModalMaster] = useState(false)
  const [showModalKondisi, setShowModalKondisi] = useState(false)
  const [showModalPembelian, setShowModalPembelian] = useState(false)
  const [showModalPinjam, setShowModalPinjam] = useState(false)
  const [showModalKembali, setShowModalKembali] = useState(false)
  const [showModalTolak, setShowModalTolak] = useState(false)

  // Form States
  const [masterForm, setMasterForm] = useState({
    nama_barang: '',
    kategori: 'Target & Kicking' as KategoriInventaris,
    kondisi_baik: 1,
    kondisi_rusak_ringan: 0,
    kondisi_rusak_berat: 0,
    lokasi_penyimpanan: 'Dojang Utama',
    keterangan: '',
  })

  const [selectedBarangKondisi, setSelectedBarangKondisi] = useState<InventarisBarang | null>(null)
  const [kondisiForm, setKondisiForm] = useState({
    kondisi_baik: 0,
    kondisi_rusak_ringan: 0,
    kondisi_rusak_berat: 0,
    lokasi_penyimpanan: '',
    keterangan: '',
  })

  const [pembelianForm, setPembelianForm] = useState({
    mode: 'existing' as 'existing' | 'new',
    barang_id: '',
    nama_barang: '',
    kategori: 'Target & Kicking' as KategoriInventaris,
    tgl_beli: new Date().toISOString().split('T')[0],
    jumlah: 1,
    harga_satuan: 0,
    toko_vendor: '',
    catat_ke_kas: true,
  })

  const [pinjamForm, setPinjamForm] = useState({
    barang_id: '',
    pelatih_id: '',
    nama_peminjam: '',
    jumlah: 1,
    tgl_pinjam: new Date().toISOString().split('T')[0],
    tgl_rencana_kembali: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    keperluan: '',
  })

  const [selectedPinjamKembali, setSelectedPinjamKembali] = useState<InventarisPeminjaman | null>(null)
  const [kembaliForm, setKembaliForm] = useState({
    catatan_kondisi_kembali: '',
    rusak_ringan_tambah: 0,
    rusak_berat_tambah: 0,
  })

  const [selectedPengajuanTolak, setSelectedPengajuanTolak] = useState<InventarisPengajuan | null>(null)
  const [catatanTolak, setCatatanTolak] = useState('')

  // Load Data
  const fetchData = useCallback(async () => {
    setLoading(true)
    const res = await getAdminInventarisData()
    if (res.success && res.data) {
      setBarangList(res.data.barang || [])
      setPembelianList(res.data.pembelian || [])
      setPeminjamanList(res.data.peminjaman || [])
      setPengajuanList(res.data.pengajuan || [])
      setPelatihList(res.data.pelatihList || [])
    } else {
      setMessage({ type: 'error', text: res.message || res.error || 'Gagal memuat data' })
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // KPI Calculations
  const stats = useMemo(() => {
    const totalAset = barangList.reduce((acc, b) => acc + (b.total_stok || 0), 0)
    const totalBaik = barangList.reduce((acc, b) => acc + (b.kondisi_baik || 0), 0)
    const totalRusak = barangList.reduce((acc, b) => acc + (b.kondisi_rusak_ringan || 0) + (b.kondisi_rusak_berat || 0), 0)
    const totalDipinjam = barangList.reduce((acc, b) => acc + (b.stok_dipinjam || 0), 0)
    const totalPendingPengajuan = pengajuanList.filter((p) => p.status === 'menunggu').length
    return { totalAset, totalBaik, totalRusak, totalDipinjam, totalPendingPengajuan }
  }, [barangList, pengajuanList])

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

  // Filtered Peminjaman
  const filteredPeminjaman = useMemo(() => {
    return peminjamanList.filter((p) => {
      if (filterPeminjamanStatus === 'Semua') return true
      return p.status === filterPeminjamanStatus
    })
  }, [peminjamanList, filterPeminjamanStatus])

  // Handler: Tambah Master
  const handleSimpanMaster = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage(null)
    const res = await tambahBarangMaster(masterForm)
    if (res.success) {
      setMessage({ type: 'success', text: 'Alat baru berhasil ditambahkan ke katalog' })
      setShowModalMaster(false)
      setMasterForm({
        nama_barang: '',
        kategori: 'Target & Kicking',
        kondisi_baik: 1,
        kondisi_rusak_ringan: 0,
        kondisi_rusak_berat: 0,
        lokasi_penyimpanan: 'Dojang Utama',
        keterangan: '',
      })
      await fetchData()
    } else {
      setMessage({ type: 'error', text: res.message || 'Gagal menambahkan alat' })
    }
    setSaving(false)
  }

  // Handler: Update Kondisi
  const openEditKondisi = (b: InventarisBarang) => {
    setSelectedBarangKondisi(b)
    setKondisiForm({
      kondisi_baik: b.kondisi_baik,
      kondisi_rusak_ringan: b.kondisi_rusak_ringan,
      kondisi_rusak_berat: b.kondisi_rusak_berat,
      lokasi_penyimpanan: b.lokasi_penyimpanan || 'Dojang Utama',
      keterangan: b.keterangan || '',
    })
    setShowModalKondisi(true)
  }

  const handleSimpanKondisi = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedBarangKondisi) return
    setSaving(true)
    setMessage(null)
    const res = await updateKondisiBarang(selectedBarangKondisi.id, kondisiForm)
    if (res.success) {
      setMessage({ type: 'success', text: 'Kondisi fisik alat berhasil diperbarui' })
      setShowModalKondisi(false)
      await fetchData()
    } else {
      setMessage({ type: 'error', text: res.message || 'Gagal memperbarui kondisi' })
    }
    setSaving(false)
  }

  // Handler: Catat Pembelian
  const handleSimpanPembelian = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage(null)

    const payload = {
      barang_id: pembelianForm.mode === 'existing' ? pembelianForm.barang_id : null,
      nama_barang:
        pembelianForm.mode === 'existing'
          ? barangList.find((b) => b.id === pembelianForm.barang_id)?.nama_barang || ''
          : pembelianForm.nama_barang,
      kategori:
        pembelianForm.mode === 'existing'
          ? barangList.find((b) => b.id === pembelianForm.barang_id)?.kategori || 'Target & Kicking'
          : pembelianForm.kategori,
      tgl_beli: pembelianForm.tgl_beli,
      jumlah: Number(pembelianForm.jumlah),
      harga_satuan: Number(pembelianForm.harga_satuan),
      toko_vendor: pembelianForm.toko_vendor,
      catat_ke_kas: pembelianForm.catat_ke_kas,
    }

    const res = await catatPembelianBaru(payload)
    if (res.success) {
      setMessage({ type: 'success', text: res.message || 'Pembelian berhasil dicatat' })
      setShowModalPembelian(false)
      setPembelianForm({
        mode: 'existing',
        barang_id: '',
        nama_barang: '',
        kategori: 'Target & Kicking',
        tgl_beli: new Date().toISOString().split('T')[0],
        jumlah: 1,
        harga_satuan: 0,
        toko_vendor: '',
        catat_ke_kas: true,
      })
      await fetchData()
    } else {
      setMessage({ type: 'error', text: res.message || 'Gagal mencatat pembelian' })
    }
    setSaving(false)
  }

  // Handler: Hapus Pembelian
  const handleHapusPembelian = async (id: string) => {
    if (!confirm('Hapus transaksi pembelian ini? Stok barang akan dikurangi dan catatan kas terkait akan dibatalkan.')) {
      return
    }
    setSaving(true)
    setMessage(null)
    const res = await hapusPembelian(id)
    if (res.success) {
      setMessage({ type: 'success', text: 'Pembelian berhasil dihapus dan kas telah disinkronkan' })
      await fetchData()
    } else {
      setMessage({ type: 'error', text: res.message || 'Gagal menghapus pembelian' })
    }
    setSaving(false)
  }

  // Handler: Catat Peminjaman
  const handleSimpanPinjam = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage(null)

    // Jika pelatih dipilih, auto isi nama peminjam jika kosong
    let namaPeminjam = pinjamForm.nama_peminjam.trim()
    if (!namaPeminjam && pinjamForm.pelatih_id) {
      const p = pelatihList.find((x) => x.id === pinjamForm.pelatih_id)
      if (p) namaPeminjam = p.nama
    }

    if (!namaPeminjam) {
      setMessage({ type: 'error', text: 'Nama peminjam wajib diisi' })
      setSaving(false)
      return
    }

    const res = await catatPeminjamanAdmin({
      barang_id: pinjamForm.barang_id,
      pelatih_id: pinjamForm.pelatih_id || null,
      nama_peminjam: namaPeminjam,
      jumlah: Number(pinjamForm.jumlah),
      tgl_pinjam: pinjamForm.tgl_pinjam,
      tgl_rencana_kembali: pinjamForm.tgl_rencana_kembali,
      keperluan: pinjamForm.keperluan,
    })

    if (res.success) {
      setMessage({ type: 'success', text: 'Peminjaman alat berhasil dicatat' })
      setShowModalPinjam(false)
      setPinjamForm({
        barang_id: '',
        pelatih_id: '',
        nama_peminjam: '',
        jumlah: 1,
        tgl_pinjam: new Date().toISOString().split('T')[0],
        tgl_rencana_kembali: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        keperluan: '',
      })
      await fetchData()
    } else {
      setMessage({ type: 'error', text: res.message || 'Gagal mencatat peminjaman' })
    }
    setSaving(false)
  }

  // Handler: Pengembalian
  const openModalKembali = (p: InventarisPeminjaman) => {
    setSelectedPinjamKembali(p)
    setKembaliForm({
      catatan_kondisi_kembali: '',
      rusak_ringan_tambah: 0,
      rusak_berat_tambah: 0,
    })
    setShowModalKembali(true)
  }

  const handleSimpanKembali = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPinjamKembali) return
    setSaving(true)
    setMessage(null)

    const res = await kembalikanPeminjaman(selectedPinjamKembali.id, kembaliForm)
    if (res.success) {
      setMessage({ type: 'success', text: 'Alat berhasil dikonfirmasi telah kembali ke dojang' })
      setShowModalKembali(false)
      await fetchData()
    } else {
      setMessage({ type: 'error', text: res.message || 'Gagal mengembalikan peminjaman' })
    }
    setSaving(false)
  }

  // Handler: Realisasikan Pengajuan Menjadi Pembelian
  const handleRealisasiPengajuan = (item: InventarisPengajuan) => {
    setPembelianForm({
      mode: 'new',
      barang_id: '',
      nama_barang: item.nama_barang,
      kategori: (item.kategori as KategoriInventaris) || 'Target & Kicking',
      tgl_beli: new Date().toISOString().split('T')[0],
      jumlah: item.jumlah,
      harga_satuan: item.estimasi_harga && item.jumlah > 0 ? Math.round(item.estimasi_harga / item.jumlah) : 0,
      toko_vendor: '',
      catat_ke_kas: true,
    })
    // Auto update status pengajuan jadi disetujui
    updateStatusPengajuan(item.id, 'disetujui', 'Disetujui untuk realisasi pengadaan').then(() => {
      fetchData()
    })
    setShowModalPembelian(true)
  }

  const openModalTolak = (item: InventarisPengajuan) => {
    setSelectedPengajuanTolak(item)
    setCatatanTolak('')
    setShowModalTolak(true)
  }

  const handleSimpanTolak = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPengajuanTolak) return
    setSaving(true)
    const res = await updateStatusPengajuan(selectedPengajuanTolak.id, 'ditolak', catatanTolak)
    if (res.success) {
      setMessage({ type: 'success', text: 'Pengajuan telah ditandai ditolak' })
      setShowModalTolak(false)
      await fetchData()
    } else {
      setMessage({ type: 'error', text: res.message || 'Gagal menolak pengajuan' })
    }
    setSaving(false)
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-[4px] border-dark pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">📦</span>
            <h1 className="text-2xl md:text-3xl font-pixel text-dark">Inventaris & Aset Club</h1>
          </div>
          <p className="text-xs md:text-sm text-dark/70 font-sans mt-1">
            Pencatatan alat latihan fisik, riwayat pembelian dengan sinkronisasi kas club, dan sirkulasi peminjaman.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="secondary"
            className="text-xs py-2 px-3 flex items-center gap-1.5"
            onClick={() => {
              setMasterForm({
                nama_barang: '',
                kategori: 'Target & Kicking',
                kondisi_baik: 1,
                kondisi_rusak_ringan: 0,
                kondisi_rusak_berat: 0,
                lokasi_penyimpanan: 'Dojang Utama',
                keterangan: '',
              })
              setShowModalMaster(true)
            }}
          >
            <span>➕</span> Tambah Alat
          </Button>

          <Button
            variant="primary"
            className="text-xs py-2 px-3 flex items-center gap-1.5"
            onClick={() => {
              setPembelianForm({
                mode: 'existing',
                barang_id: barangList[0]?.id || '',
                nama_barang: '',
                kategori: 'Target & Kicking',
                tgl_beli: new Date().toISOString().split('T')[0],
                jumlah: 1,
                harga_satuan: 0,
                toko_vendor: '',
                catat_ke_kas: true,
              })
              setShowModalPembelian(true)
            }}
          >
            <span>🛒</span> Catat Pembelian
          </Button>

          <Button
            variant="accent"
            className="text-xs py-2 px-3 flex items-center gap-1.5"
            onClick={() => {
              setPinjamForm({
                barang_id: barangList[0]?.id || '',
                pelatih_id: pelatihList[0]?.id || '',
                nama_peminjam: pelatihList[0]?.nama || '',
                jumlah: 1,
                tgl_pinjam: new Date().toISOString().split('T')[0],
                tgl_rencana_kembali: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                keperluan: '',
              })
              setShowModalPinjam(true)
            }}
          >
            <span>🔄</span> Catat Pinjam
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

      {/* KPI SUMMARY CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-white border-[3px] border-dark shadow-[3px_3px_0px_#1E2A38]">
          <div className="text-[10px] md:text-xs font-pixel text-dark/60 uppercase">Total Unit Alat</div>
          <div className="text-2xl md:text-3xl font-pixel text-dark mt-1">{stats.totalAset}</div>
          <div className="text-[10px] text-dark/70 font-sans mt-1">{barangList.length} jenis alat terdaftar</div>
        </Card>

        <Card className="p-4 bg-primary/20 border-[3px] border-dark shadow-[3px_3px_0px_#1E2A38]">
          <div className="text-[10px] md:text-xs font-pixel text-dark/60 uppercase">Siap Pakai (Baik)</div>
          <div className="text-2xl md:text-3xl font-pixel text-dark mt-1">{stats.totalBaik}</div>
          <div className="text-[10px] text-dark/70 font-sans mt-1">
            {stats.totalAset > 0 ? Math.round((stats.totalBaik / stats.totalAset) * 100) : 0}% kelayakan fisik
          </div>
        </Card>

        <Card className="p-4 bg-accent/20 border-[3px] border-dark shadow-[3px_3px_0px_#1E2A38]">
          <div className="text-[10px] md:text-xs font-pixel text-dark/60 uppercase">Perlu Servis / Rusak</div>
          <div className="text-2xl md:text-3xl font-pixel text-dark mt-1">{stats.totalRusak}</div>
          <div className="text-[10px] text-dark/70 font-sans mt-1">Ringan & rusak berat/afkir</div>
        </Card>

        <Card className="p-4 bg-secondary/30 border-[3px] border-dark shadow-[3px_3px_0px_#1E2A38]">
          <div className="text-[10px] md:text-xs font-pixel text-dark/60 uppercase">Sedang Dipinjam</div>
          <div className="text-2xl md:text-3xl font-pixel text-dark mt-1">{stats.totalDipinjam}</div>
          <div className="text-[10px] text-dark/70 font-sans mt-1">Latihan luar / event</div>
        </Card>
      </div>

      {/* TAB NAVIGATION */}
      <div className="flex border-b-[3px] border-dark gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab('katalog')}
          className={`px-4 py-2 font-pixel text-xs border-[2px] transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'katalog'
              ? 'bg-primary border-dark shadow-[3px_3px_0px_#1E2A38] translate-y-[-2px]'
              : 'bg-white border-dark/30 hover:border-dark'
          }`}
        >
          📦 Katalog Alat ({barangList.length})
        </button>

        <button
          onClick={() => setActiveTab('pembelian')}
          className={`px-4 py-2 font-pixel text-xs border-[2px] transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'pembelian'
              ? 'bg-primary border-dark shadow-[3px_3px_0px_#1E2A38] translate-y-[-2px]'
              : 'bg-white border-dark/30 hover:border-dark'
          }`}
        >
          🛒 Pengadaan & Kas ({pembelianList.length})
        </button>

        <button
          onClick={() => setActiveTab('peminjaman')}
          className={`px-4 py-2 font-pixel text-xs border-[2px] transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'peminjaman'
              ? 'bg-primary border-dark shadow-[3px_3px_0px_#1E2A38] translate-y-[-2px]'
              : 'bg-white border-dark/30 hover:border-dark'
          }`}
        >
          🔄 Sirkulasi Pinjam ({peminjamanList.filter((x) => x.status === 'dipinjam').length} Aktif)
        </button>

        <button
          onClick={() => setActiveTab('pengajuan')}
          className={`px-4 py-2 font-pixel text-xs border-[2px] transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'pengajuan'
              ? 'bg-primary border-dark shadow-[3px_3px_0px_#1E2A38] translate-y-[-2px]'
              : 'bg-white border-dark/30 hover:border-dark'
          }`}
        >
          <span>📝 Usulan Pelatih</span>
          {stats.totalPendingPengajuan > 0 && (
            <span className="w-5 h-5 bg-accent text-white rounded-full text-[10px] flex items-center justify-center font-sans font-bold">
              {stats.totalPendingPengajuan}
            </span>
          )}
        </button>
      </div>

      {/* CONTENT TABS */}
      {loading ? (
        <div className="p-12 text-center">
          <div className="w-10 h-10 border-[4px] border-dark/20 border-t-primary animate-spin mx-auto mb-3" />
          <p className="font-pixel text-xs text-dark/60">Memuat data inventaris...</p>
        </div>
      ) : (
        <>
          {/* TAB 1: KATALOG ALAT */}
          {activeTab === 'katalog' && (
            <div className="space-y-4">
              {/* Filter Bar */}
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

              {/* Grid / List of Items */}
              {filteredBarang.length === 0 ? (
                <div className="p-8 text-center bg-white border-[3px] border-dark shadow-[3px_3px_0px_#1E2A38]">
                  <p className="font-pixel text-xs text-dark/50">Tidak ada alat yang cocok dengan filter pencarian.</p>
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

                          {/* Stock Badges */}
                          <div className="grid grid-cols-4 gap-1.5 py-2.5 my-2 border-y-[2px] border-dark/15 text-center">
                            <div className="bg-primary/20 p-1 border border-dark/20">
                              <div className="text-[9px] font-pixel text-dark/60">Baik</div>
                              <div className="font-pixel text-xs text-dark">{item.kondisi_baik}</div>
                            </div>
                            <div className="bg-secondary/30 p-1 border border-dark/20">
                              <div className="text-[9px] font-pixel text-dark/60">R. Ringan</div>
                              <div className="font-pixel text-xs text-dark">{item.kondisi_rusak_ringan}</div>
                            </div>
                            <div className="bg-accent/20 p-1 border border-dark/20">
                              <div className="text-[9px] font-pixel text-dark/60">Afkir</div>
                              <div className="font-pixel text-xs text-dark">{item.kondisi_rusak_berat}</div>
                            </div>
                            <div className="bg-neutral-100 p-1 border border-dark/20">
                              <div className="text-[9px] font-pixel text-dark/60">Dipinjam</div>
                              <div className="font-pixel text-xs text-dark">{item.stok_dipinjam}</div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-dark/70 font-sans">
                            <span>📍 {item.lokasi_penyimpanan || 'Dojang'}</span>
                            <span className="font-medium">
                              Tersedia: <strong className="text-dark font-pixel">{tersediaDojang}</strong> unit
                            </span>
                          </div>

                          {item.keterangan && (
                            <p className="text-[10px] text-dark/50 italic font-sans mt-2 line-clamp-1">
                              Note: {item.keterangan}
                            </p>
                          )}
                        </div>

                        <div className="mt-4 pt-3 border-t-[2px] border-dark/10 flex items-center justify-end gap-2">
                          <Button
                            variant="secondary"
                            className="text-[10px] py-1.5 px-2.5"
                            onClick={() => openEditKondisi(item)}
                          >
                            ⚙️ Sesuaikan Kondisi
                          </Button>
                        </div>
                      </Card>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: PENGADAAN & KAS */}
          {activeTab === 'pembelian' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-pixel text-sm text-dark">Log Pengadaan Alat & Pembukuan Kas</h3>
                <Button
                  variant="primary"
                  className="text-xs py-1.5 px-3 flex items-center gap-1.5"
                  onClick={() => setShowModalPembelian(true)}
                >
                  <span>➕</span> Catat Pembelian
                </Button>
              </div>

              {pembelianList.length === 0 ? (
                <div className="p-8 text-center bg-white border-[3px] border-dark shadow-[3px_3px_0px_#1E2A38]">
                  <p className="font-pixel text-xs text-dark/50">Belum ada riwayat pengadaan alat yang dicatat.</p>
                </div>
              ) : (
                <div className="bg-white border-[3px] border-dark shadow-[3px_3px_0px_#1E2A38] overflow-x-auto">
                  <table className="w-full text-left text-xs font-sans">
                    <thead className="bg-neutral-100 border-b-[2px] border-dark font-pixel text-[10px] text-dark">
                      <tr>
                        <th className="p-3">Tanggal</th>
                        <th className="p-3">Nama Alat</th>
                        <th className="p-3">Kategori</th>
                        <th className="p-3 text-center">Jumlah</th>
                        <th className="p-3 text-right">Harga Satuan</th>
                        <th className="p-3 text-right">Total Biaya</th>
                        <th className="p-3">Vendor / Toko</th>
                        <th className="p-3 text-center">Sinkron Kas</th>
                        <th className="p-3 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-dark/10">
                      {pembelianList.map((item) => (
                        <tr key={item.id} className="hover:bg-neutral-50">
                          <td className="p-3 whitespace-nowrap">{formatTanggal(item.tgl_beli)}</td>
                          <td className="p-3 font-semibold text-dark">{item.nama_barang}</td>
                          <td className="p-3 text-dark/70">{item.kategori}</td>
                          <td className="p-3 text-center font-pixel">{item.jumlah}</td>
                          <td className="p-3 text-right">{formatRupiah(item.harga_satuan)}</td>
                          <td className="p-3 text-right font-bold text-dark">{formatRupiah(item.total_biaya)}</td>
                          <td className="p-3 text-dark/70">{item.toko_vendor || '-'}</td>
                          <td className="p-3 text-center">
                            {item.catat_ke_kas ? (
                              <Badge color="primary" className="text-[9px]">
                                Kas Tercatat
                              </Badge>
                            ) : (
                              <Badge color="secondary" className="text-[9px]">
                                Non-Kas
                              </Badge>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => handleHapusPembelian(item.id)}
                              disabled={saving}
                              className="text-accent hover:underline font-pixel text-[10px]"
                            >
                              Hapus
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: SIRKULASI PEMINJAMAN */}
          {activeTab === 'peminjaman' && (
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
                <div className="flex items-center gap-2">
                  {['Semua', 'dipinjam', 'kembali', 'terlambat'].map((st) => (
                    <button
                      key={st}
                      onClick={() => setFilterPeminjamanStatus(st)}
                      className={`px-3 py-1 text-[11px] font-pixel border-[2px] border-dark capitalize ${
                        filterPeminjamanStatus === st ? 'bg-primary text-dark shadow-[2px_2px_0px_#1E2A38]' : 'bg-white hover:bg-neutral-100'
                      }`}
                    >
                      {st === 'dipinjam' ? 'Sedang Dipinjam' : st === 'kembali' ? 'Sudah Kembali' : st}
                    </button>
                  ))}
                </div>

                <Button
                  variant="accent"
                  className="text-xs py-1.5 px-3 flex items-center gap-1.5 self-start md:self-auto"
                  onClick={() => setShowModalPinjam(true)}
                >
                  <span>➕</span> Catat Pinjam Baru
                </Button>
              </div>

              {filteredPeminjaman.length === 0 ? (
                <div className="p-8 text-center bg-white border-[3px] border-dark shadow-[3px_3px_0px_#1E2A38]">
                  <p className="font-pixel text-xs text-dark/50">Tidak ada riwayat peminjaman.</p>
                </div>
              ) : (
                <div className="bg-white border-[3px] border-dark shadow-[3px_3px_0px_#1E2A38] overflow-x-auto">
                  <table className="w-full text-left text-xs font-sans">
                    <thead className="bg-neutral-100 border-b-[2px] border-dark font-pixel text-[10px] text-dark">
                      <tr>
                        <th className="p-3">Nama Alat</th>
                        <th className="p-3">Peminjam</th>
                        <th className="p-3 text-center">Jumlah</th>
                        <th className="p-3">Tgl Pinjam</th>
                        <th className="p-3">Rencana Kembali</th>
                        <th className="p-3">Keperluan</th>
                        <th className="p-3 text-center">Status</th>
                        <th className="p-3 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-dark/10">
                      {filteredPeminjaman.map((p) => {
                        const isOverdue = p.status === 'dipinjam' && new Date(p.tgl_rencana_kembali) < new Date()
                        return (
                          <tr key={p.id} className="hover:bg-neutral-50">
                            <td className="p-3 font-semibold text-dark">
                              {p.inventaris_barang?.nama_barang || 'Alat'}
                              <span className="block text-[10px] font-mono text-dark/50">
                                {p.inventaris_barang?.kode_barang}
                              </span>
                            </td>
                            <td className="p-3">
                              <span className="font-medium text-dark">{p.nama_peminjam}</span>
                              {p.pelatih_id && (
                                <span className="block text-[10px] text-secondary-dark font-pixel">Pelatih Club</span>
                              )}
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
                                  Kembali
                                </Badge>
                              ) : isOverdue ? (
                                <Badge color="accent" className="text-[9px]">
                                  Terlambat
                                </Badge>
                              ) : (
                                <Badge color="primary" className="text-[9px]">
                                  Dipinjam
                                </Badge>
                              )}
                            </td>
                            <td className="p-3 text-center whitespace-nowrap">
                              {p.status === 'dipinjam' ? (
                                <Button
                                  variant="secondary"
                                  className="text-[10px] py-1 px-2.5"
                                  onClick={() => openModalKembali(p)}
                                >
                                  Konfirmasi Kembali
                                </Button>
                              ) : (
                                <span className="text-[10px] text-dark/40 font-mono">
                                  {p.tgl_kembali ? formatTanggal(p.tgl_kembali) : 'Selesai'}
                                </span>
                              )}
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

          {/* TAB 4: PENGAJUAN PELATIH */}
          {activeTab === 'pengajuan' && (
            <div className="space-y-4">
              <h3 className="font-pixel text-sm text-dark">Usulan Pengadaan Alat dari Pelatih</h3>

              {pengajuanList.length === 0 ? (
                <div className="p-8 text-center bg-white border-[3px] border-dark shadow-[3px_3px_0px_#1E2A38]">
                  <p className="font-pixel text-xs text-dark/50">Belum ada usulan alat dari pelatih.</p>
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
                            <span className="text-[10px] font-pixel text-secondary-dark">
                              Oleh: {item.pelatih?.nama || 'Pelatih'}
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
                            <strong>Jumlah Usulan:</strong> {item.jumlah} unit
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
                            <div className="text-accent text-[11px] pt-1 border-t border-dark/10">
                              <strong>Catatan Admin:</strong> {item.catatan_admin}
                            </div>
                          )}
                        </div>
                      </div>

                      {item.status === 'menunggu' && (
                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-dark/10">
                          <Button
                            variant="primary"
                            className="text-[10px] py-1.5 px-3 flex items-center gap-1"
                            onClick={() => handleRealisasiPengajuan(item)}
                          >
                            <span>✅</span> Setujui & Beli
                          </Button>
                          <Button
                            variant="accent"
                            className="text-[10px] py-1.5 px-3"
                            onClick={() => openModalTolak(item)}
                          >
                            Tolak
                          </Button>
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ======================================================== */}
      {/* MODAL 1: TAMBAH MASTER ALAT */}
      {/* ======================================================== */}
      {showModalMaster && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border-[4px] border-dark shadow-[6px_6px_0px_#1E2A38] w-full max-w-lg p-5 animate-fade-in my-8">
            <div className="flex justify-between items-center pb-3 border-b-[3px] border-dark mb-4">
              <h3 className="font-pixel text-base text-dark">Tambah Master Alat Baru</h3>
              <button onClick={() => setShowModalMaster(false)} className="font-pixel text-sm hover:opacity-70">
                ✕
              </button>
            </div>

            <form onSubmit={handleSimpanMaster} className="space-y-3 font-sans text-xs">
              <div>
                <label className="block font-bold mb-1">Nama Alat</label>
                <Input
                  required
                  placeholder="Misal: Target Pad Double Adidas"
                  value={masterForm.nama_barang}
                  onChange={(e) => setMasterForm({ ...masterForm, nama_barang: e.target.value })}
                />
              </div>

              <div>
                <label className="block font-bold mb-1">Kategori</label>
                <select
                  value={masterForm.kategori}
                  onChange={(e) => setMasterForm({ ...masterForm, kategori: e.target.value as KategoriInventaris })}
                  className="w-full border-[2px] border-dark p-2 bg-white font-sans text-xs"
                >
                  {KATEGORI_OPTIONS.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-bold mb-1 text-secondary-dark">Kondisi Baik</label>
                  <Input
                    type="number"
                    min="0"
                    required
                    value={masterForm.kondisi_baik}
                    onChange={(e) => setMasterForm({ ...masterForm, kondisi_baik: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1 text-primary-dark">Rusak Ringan</label>
                  <Input
                    type="number"
                    min="0"
                    required
                    value={masterForm.kondisi_rusak_ringan}
                    onChange={(e) =>
                      setMasterForm({ ...masterForm, kondisi_rusak_ringan: parseInt(e.target.value) || 0 })
                    }
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1 text-accent">Rusak Berat</label>
                  <Input
                    type="number"
                    min="0"
                    required
                    value={masterForm.kondisi_rusak_berat}
                    onChange={(e) =>
                      setMasterForm({ ...masterForm, kondisi_rusak_berat: parseInt(e.target.value) || 0 })
                    }
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1">Lokasi Penyimpanan di Dojang</label>
                <Input
                  placeholder="Misal: Rak Matras, Lemari Alat A"
                  value={masterForm.lokasi_penyimpanan}
                  onChange={(e) => setMasterForm({ ...masterForm, lokasi_penyimpanan: e.target.value })}
                />
              </div>

              <div>
                <label className="block font-bold mb-1">Keterangan / Catatan Tambahan (Opsional)</label>
                <textarea
                  rows={2}
                  value={masterForm.keterangan}
                  onChange={(e) => setMasterForm({ ...masterForm, keterangan: e.target.value })}
                  className="w-full border-[2px] border-dark p-2 bg-white font-sans text-xs"
                  placeholder="Keterangan merk, ukuran, atau spesifikasi..."
                />
              </div>

              <div className="pt-3 border-t-[2px] border-dark/15 flex justify-end gap-2">
                <Button type="button" variant="accent" onClick={() => setShowModalMaster(false)}>
                  Batal
                </Button>
                <Button type="submit" variant="primary" disabled={saving}>
                  {saving ? 'Menyimpan...' : 'Simpan Alat'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: SESUAIKAN KONDISI FISIK */}
      {/* ======================================================== */}
      {showModalKondisi && selectedBarangKondisi && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border-[4px] border-dark shadow-[6px_6px_0px_#1E2A38] w-full max-w-md p-5 animate-fade-in my-8">
            <div className="flex justify-between items-center pb-3 border-b-[3px] border-dark mb-4">
              <div>
                <h3 className="font-pixel text-base text-dark">Sesuaikan Kondisi Fisik</h3>
                <p className="text-[11px] text-dark/70 font-sans mt-0.5">{selectedBarangKondisi.nama_barang}</p>
              </div>
              <button onClick={() => setShowModalKondisi(false)} className="font-pixel text-sm hover:opacity-70">
                ✕
              </button>
            </div>

            <form onSubmit={handleSimpanKondisi} className="space-y-3 font-sans text-xs">
              <div className="p-2.5 bg-neutral-100 border border-dark/20 text-[11px]">
                Sedang dipinjam saat ini: <strong className="font-pixel">{selectedBarangKondisi.stok_dipinjam}</strong> unit.
                Total stok fisik tidak boleh kurang dari jumlah yang dipinjam.
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-bold mb-1 text-secondary-dark">Kondisi Baik</label>
                  <Input
                    type="number"
                    min="0"
                    required
                    value={kondisiForm.kondisi_baik}
                    onChange={(e) => setKondisiForm({ ...kondisiForm, kondisi_baik: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1 text-primary-dark">Rusak Ringan</label>
                  <Input
                    type="number"
                    min="0"
                    required
                    value={kondisiForm.kondisi_rusak_ringan}
                    onChange={(e) =>
                      setKondisiForm({ ...kondisiForm, kondisi_rusak_ringan: parseInt(e.target.value) || 0 })
                    }
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1 text-accent">Rusak Berat</label>
                  <Input
                    type="number"
                    min="0"
                    required
                    value={kondisiForm.kondisi_rusak_berat}
                    onChange={(e) =>
                      setKondisiForm({ ...kondisiForm, kondisi_rusak_berat: parseInt(e.target.value) || 0 })
                    }
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1">Lokasi Penyimpanan</label>
                <Input
                  value={kondisiForm.lokasi_penyimpanan}
                  onChange={(e) => setKondisiForm({ ...kondisiForm, lokasi_penyimpanan: e.target.value })}
                />
              </div>

              <div>
                <label className="block font-bold mb-1">Keterangan / Alasan Perubahan</label>
                <textarea
                  rows={2}
                  value={kondisiForm.keterangan}
                  onChange={(e) => setKondisiForm({ ...kondisiForm, keterangan: e.target.value })}
                  className="w-full border-[2px] border-dark p-2 bg-white font-sans text-xs"
                  placeholder="Misal: 1 target pad robek setelah dipakai simulasi tanding"
                />
              </div>

              <div className="pt-3 border-t-[2px] border-dark/15 flex justify-end gap-2">
                <Button type="button" variant="accent" onClick={() => setShowModalKondisi(false)}>
                  Batal
                </Button>
                <Button type="submit" variant="primary" disabled={saving}>
                  {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: CATAT PEMBELIAN BARU (+ SINKRON KAS) */}
      {/* ======================================================== */}
      {showModalPembelian && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border-[4px] border-dark shadow-[6px_6px_0px_#1E2A38] w-full max-w-lg p-5 animate-fade-in my-8">
            <div className="flex justify-between items-center pb-3 border-b-[3px] border-dark mb-4">
              <div>
                <h3 className="font-pixel text-base text-dark">Catat Pengadaan / Pembelian</h3>
                <p className="text-[11px] text-dark/70 font-sans mt-0.5">
                  Input pembelian alat baru untuk otomatis menambah stok dan kas club.
                </p>
              </div>
              <button onClick={() => setShowModalPembelian(false)} className="font-pixel text-sm hover:opacity-70">
                ✕
              </button>
            </div>

            <form onSubmit={handleSimpanPembelian} className="space-y-3 font-sans text-xs">
              {/* Pilihan: Barang Eksisting vs Barang Baru */}
              <div className="flex border-[2px] border-dark p-1 bg-neutral-100 gap-1">
                <button
                  type="button"
                  onClick={() => setPembelianForm({ ...pembelianForm, mode: 'existing' })}
                  className={`flex-1 py-1 font-pixel text-xs text-center ${
                    pembelianForm.mode === 'existing' ? 'bg-primary border border-dark' : 'bg-transparent'
                  }`}
                >
                  Pilih Alat Eksisting
                </button>
                <button
                  type="button"
                  onClick={() => setPembelianForm({ ...pembelianForm, mode: 'new' })}
                  className={`flex-1 py-1 font-pixel text-xs text-center ${
                    pembelianForm.mode === 'new' ? 'bg-primary border border-dark' : 'bg-transparent'
                  }`}
                >
                  Alat Baru (Buat Master)
                </button>
              </div>

              {pembelianForm.mode === 'existing' ? (
                <div>
                  <label className="block font-bold mb-1">Pilih Alat</label>
                  <select
                    required
                    value={pembelianForm.barang_id}
                    onChange={(e) => setPembelianForm({ ...pembelianForm, barang_id: e.target.value })}
                    className="w-full border-[2px] border-dark p-2 bg-white font-sans text-xs"
                  >
                    <option value="">-- Pilih Alat Dari Katalog --</option>
                    {barangList.map((b) => (
                      <option key={b.id} value={b.id}>
                        [{b.kode_barang}] {b.nama_barang} (Stok Saat Ini: {b.total_stok})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block font-bold mb-1">Nama Alat Baru</label>
                    <Input
                      required
                      placeholder="Misal: Head Guard Kadet Daedo Merah"
                      value={pembelianForm.nama_barang}
                      onChange={(e) => setPembelianForm({ ...pembelianForm, nama_barang: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block font-bold mb-1">Kategori</label>
                    <select
                      value={pembelianForm.kategori}
                      onChange={(e) =>
                        setPembelianForm({ ...pembelianForm, kategori: e.target.value as KategoriInventaris })
                      }
                      className="w-full border-[2px] border-dark p-2 bg-white font-sans text-xs"
                    >
                      {KATEGORI_OPTIONS.map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold mb-1">Tanggal Pembelian</label>
                  <Input
                    type="date"
                    required
                    value={pembelianForm.tgl_beli}
                    onChange={(e) => setPembelianForm({ ...pembelianForm, tgl_beli: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Jumlah Unit</label>
                  <Input
                    type="number"
                    min="1"
                    required
                    value={pembelianForm.jumlah}
                    onChange={(e) => setPembelianForm({ ...pembelianForm, jumlah: parseInt(e.target.value) || 1 })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold mb-1">Harga Satuan (Rp)</label>
                  <Input
                    type="number"
                    min="0"
                    required
                    value={pembelianForm.harga_satuan}
                    onChange={(e) => setPembelianForm({ ...pembelianForm, harga_satuan: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Total Biaya</label>
                  <div className="p-2 border-[2px] border-dark bg-neutral-100 font-pixel text-xs text-dark mt-0.5">
                    {formatRupiah(pembelianForm.jumlah * pembelianForm.harga_satuan)}
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1">Vendor / Toko Tempat Pembelian</label>
                <Input
                  placeholder="Misal: Toko Beladiri Jakarta, Tokopedia, etc."
                  value={pembelianForm.toko_vendor}
                  onChange={(e) => setPembelianForm({ ...pembelianForm, toko_vendor: e.target.value })}
                />
              </div>

              {/* SINKRONISASI KAS CHECKBOX */}
              <div className="p-3 border-[2px] border-dark bg-primary/20 flex items-start gap-2.5">
                <input
                  type="checkbox"
                  id="catat_ke_kas"
                  checked={pembelianForm.catat_ke_kas}
                  onChange={(e) => setPembelianForm({ ...pembelianForm, catat_ke_kas: e.target.checked })}
                  className="w-4 h-4 mt-0.5 accent-dark cursor-pointer"
                />
                <label htmlFor="catat_ke_kas" className="cursor-pointer">
                  <strong className="font-pixel text-[11px] block text-dark">Otomatis Catat ke Kas Keluar Club</strong>
                  <span className="text-[10px] text-dark/70 font-sans">
                    Transaksi sebesar{' '}
                    <strong>{formatRupiah(pembelianForm.jumlah * pembelianForm.harga_satuan)}</strong> akan langsung dibukukan
                    di modul Keuangan Club sebagai pengeluaran pengadaan alat.
                  </span>
                </label>
              </div>

              <div className="pt-3 border-t-[2px] border-dark/15 flex justify-end gap-2">
                <Button type="button" variant="accent" onClick={() => setShowModalPembelian(false)}>
                  Batal
                </Button>
                <Button type="submit" variant="primary" disabled={saving}>
                  {saving ? 'Menyimpan...' : 'Catat Pengadaan'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 4: CATAT PEMINJAMAN ADMIN */}
      {/* ======================================================== */}
      {showModalPinjam && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border-[4px] border-dark shadow-[6px_6px_0px_#1E2A38] w-full max-w-lg p-5 animate-fade-in my-8">
            <div className="flex justify-between items-center pb-3 border-b-[3px] border-dark mb-4">
              <h3 className="font-pixel text-base text-dark">Catat Peminjaman Alat</h3>
              <button onClick={() => setShowModalPinjam(false)} className="font-pixel text-sm hover:opacity-70">
                ✕
              </button>
            </div>

            <form onSubmit={handleSimpanPinjam} className="space-y-3 font-sans text-xs">
              <div>
                <label className="block font-bold mb-1">Pilih Alat yang Dipinjam</label>
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

              <div>
                <label className="block font-bold mb-1">Pelatih Peminjam (Jika Pelatih)</label>
                <select
                  value={pinjamForm.pelatih_id}
                  onChange={(e) => {
                    const pId = e.target.value
                    const p = pelatihList.find((x) => x.id === pId)
                    setPinjamForm({
                      ...pinjamForm,
                      pelatih_id: pId,
                      nama_peminjam: p ? p.nama : pinjamForm.nama_peminjam,
                    })
                  }}
                  className="w-full border-[2px] border-dark p-2 bg-white font-sans text-xs"
                >
                  <option value="">-- Peminjam Bukan Pelatih Terdaftar --</option>
                  {pelatihList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nama} ({p.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold mb-1">Nama Peminjam</label>
                <Input
                  required
                  placeholder="Nama pelatih atau atlet"
                  value={pinjamForm.nama_peminjam}
                  onChange={(e) => setPinjamForm({ ...pinjamForm, nama_peminjam: e.target.value })}
                />
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
                  <label className="block font-bold mb-1">Tgl Kembali</label>
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
                  placeholder="Misal: Latihan intensif kejuaraan Walikota Cup di GOR"
                />
              </div>

              <div className="pt-3 border-t-[2px] border-dark/15 flex justify-end gap-2">
                <Button type="button" variant="accent" onClick={() => setShowModalPinjam(false)}>
                  Batal
                </Button>
                <Button type="submit" variant="primary" disabled={saving}>
                  {saving ? 'Menyimpan...' : 'Simpan Peminjaman'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 5: KONFIRMASI PENGEMBALIAN ALAT */}
      {/* ======================================================== */}
      {showModalKembali && selectedPinjamKembali && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border-[4px] border-dark shadow-[6px_6px_0px_#1E2A38] w-full max-w-md p-5 animate-fade-in my-8">
            <div className="flex justify-between items-center pb-3 border-b-[3px] border-dark mb-4">
              <div>
                <h3 className="font-pixel text-base text-dark">Konfirmasi Pengembalian</h3>
                <p className="text-[11px] text-dark/70 font-sans mt-0.5">
                  {selectedPinjamKembali.inventaris_barang?.nama_barang} ({selectedPinjamKembali.jumlah} unit)
                </p>
              </div>
              <button onClick={() => setShowModalKembali(false)} className="font-pixel text-sm hover:opacity-70">
                ✕
              </button>
            </div>

            <form onSubmit={handleSimpanKembali} className="space-y-3 font-sans text-xs">
              <div className="p-2.5 bg-neutral-100 border border-dark/20 text-xs font-sans">
                <div>
                  <strong>Peminjam:</strong> {selectedPinjamKembali.nama_peminjam}
                </div>
                <div>
                  <strong>Keperluan:</strong> {selectedPinjamKembali.keperluan}
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1">Pemeriksaan Kondisi Saat Kembali (Opsional)</label>
                <p className="text-[10px] text-dark/60 mb-2">
                  Jika seluruh alat kembali dalam keadaan baik, biarkan angka 0.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-primary-dark">Ada Rusak Ringan</label>
                    <Input
                      type="number"
                      min="0"
                      max={selectedPinjamKembali.jumlah}
                      value={kembaliForm.rusak_ringan_tambah}
                      onChange={(e) =>
                        setKembaliForm({ ...kembaliForm, rusak_ringan_tambah: parseInt(e.target.value) || 0 })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-accent">Ada Rusak Berat / Rusak Total</label>
                    <Input
                      type="number"
                      min="0"
                      max={selectedPinjamKembali.jumlah}
                      value={kembaliForm.rusak_berat_tambah}
                      onChange={(e) =>
                        setKembaliForm({ ...kembaliForm, rusak_berat_tambah: parseInt(e.target.value) || 0 })
                      }
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1">Catatan Pengembalian (Opsional)</label>
                <textarea
                  rows={2}
                  value={kembaliForm.catatan_kondisi_kembali}
                  onChange={(e) => setKembaliForm({ ...kembaliForm, catatan_kondisi_kembali: e.target.value })}
                  className="w-full border-[2px] border-dark p-2 bg-white font-sans text-xs"
                  placeholder="Misal: Dikembalikan lengkap, tali pengikat sedikit kendur"
                />
              </div>

              <div className="pt-3 border-t-[2px] border-dark/15 flex justify-end gap-2">
                <Button type="button" variant="accent" onClick={() => setShowModalKembali(false)}>
                  Batal
                </Button>
                <Button type="submit" variant="primary" disabled={saving}>
                  {saving ? 'Memproses...' : 'Konfirmasi Kembali'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 6: TOLAK PENGAJUAN PELATIH */}
      {/* ======================================================== */}
      {showModalTolak && selectedPengajuanTolak && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white border-[4px] border-dark shadow-[6px_6px_0px_#1E2A38] w-full max-w-md p-5 animate-fade-in">
            <div className="flex justify-between items-center pb-3 border-b-[3px] border-dark mb-4">
              <h3 className="font-pixel text-base text-dark">Tolak Usulan Pengadaan</h3>
              <button onClick={() => setShowModalTolak(false)} className="font-pixel text-sm hover:opacity-70">
                ✕
              </button>
            </div>

            <form onSubmit={handleSimpanTolak} className="space-y-3 font-sans text-xs">
              <p>
                Anda akan menolak usulan alat <strong>{selectedPengajuanTolak.nama_barang}</strong> dari{' '}
                {selectedPengajuanTolak.pelatih?.nama}.
              </p>

              <div>
                <label className="block font-bold mb-1">Alasan Penolakan</label>
                <textarea
                  rows={3}
                  required
                  value={catatanTolak}
                  onChange={(e) => setCatatanTolak(e.target.value)}
                  className="w-full border-[2px] border-dark p-2 bg-white font-sans text-xs"
                  placeholder="Misal: Stok di dojang masih memadai atau anggaran kas diprioritaskan untuk kejuaraan."
                />
              </div>

              <div className="pt-3 border-t-[2px] border-dark/15 flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setShowModalTolak(false)}>
                  Batal
                </Button>
                <Button type="submit" variant="accent" disabled={saving}>
                  {saving ? 'Memproses...' : 'Tolak Usulan'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
