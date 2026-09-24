'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

const supabase = createClient()

const BULAN_NAMES = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

function formatRupiah(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
}

type Tab = 'keuangan' | 'kehadiran' | 'tagihan_ortu' | 'honor' | 'anggota' | 'prestasi'

interface AbsensiRecord {
  id: string
  tgl: string
  kelas: string
  status_hadir: 'hadir' | 'izin' | 'sakit' | 'alpha'
  pelatih_nama?: string
}

interface KehadiranSiswaRekap {
  siswaId: string
  nama: string
  programKelas: string
  hadir: number
  izin: number
  sakit: number
  alpha: number
  totalSesi: number
  persen: number
  riwayat: AbsensiRecord[]
}

interface SiswaRekapTagihan {
  id: string
  nama: string
  no_hp_ortu: string
  programKelas: string
  hadir: number
  izin: number
  sakit: number
  alpha: number
  totalSesi: number
  persen: number
  statusIuran: string
  nominalIuran: number
  iuranId?: string
  riwayat: AbsensiRecord[]
}

interface ClubSettings {
  nama_club: string | null
  rekening_bank: string | null
  rekening_nomor: string | null
  rekening_atas_nama: string | null
  kontak_wa: string | null
}

export default function AdminLaporanPage() {
  const now = new Date()
  const [activeTab, setActiveTab] = useState<Tab>('keuangan')
  const [filterBulan, setFilterBulan] = useState(String(now.getMonth() + 1).padStart(2, '0'))
  const [filterTahun, setFilterTahun] = useState(String(now.getFullYear()))
  const [loading, setLoading] = useState(false)

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [tagihanStatusFilter, setTagihanStatusFilter] = useState<'semua' | 'belum_bayar' | 'menunggu_verifikasi' | 'lunas'>('belum_bayar')
  const [kelasFilter, setKelasFilter] = useState<string>('semua')

  // Selected student for detail absensi modal
  const [selectedSiswaDetail, setSelectedSiswaDetail] = useState<{
    nama: string
    programKelas: string
    hadir: number
    izin: number
    sakit: number
    alpha: number
    totalSesi: number
    persen: number
    riwayat: AbsensiRecord[]
  } | null>(null)

  // Toast feedback state
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const showToast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 3500)
  }

  // Data states
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [keuanganData, setKeuanganData] = useState<any[]>([])
  const [kehadiranData, setKehadiranData] = useState<KehadiranSiswaRekap[]>([])
  const [tagihanData, setTagihanData] = useState<SiswaRekapTagihan[]>([])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [honorData, setHonorData] = useState<any[]>([])
  const [anggotaData, setAnggotaData] = useState<{ aktif: number; baru: number; nonaktif: number; list: { id: string; nama: string; tgl_gabung: string; status_aktif: boolean }[] }>({ aktif: 0, baru: 0, nonaktif: 0, list: [] })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [prestasiData, setPrestasiData] = useState<any[]>([])
  const [clubSettings, setClubSettings] = useState<ClubSettings | null>(null)

  // Fetch Pengaturan Club
  const fetchSettings = useCallback(async () => {
    const { data } = await supabase.from('pengaturan_club').select('*').limit(1).maybeSingle()
    if (data) setClubSettings(data)
  }, [])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  // 1. Fetch Keuangan
  const fetchKeuangan = useCallback(async () => {
    const bul = parseInt(filterBulan)
    const tah = parseInt(filterTahun)
    const startTgl = `${tah}-${filterBulan}-01`
    const lastDay = new Date(tah, bul, 0).getDate()
    const endTgl = `${tah}-${filterBulan}-${String(lastDay).padStart(2, '0')}`

    const [iuranRes, merchantRes, manualRes, honorRes] = await Promise.all([
      supabase
        .from('iuran')
        .select('nominal, status_bayar, siswa:siswa_id(nama, program_kelas:program_kelas_id(nama_program))')
        .eq('bulan', bul).eq('tahun', tah),
      supabase
        .from('pesanan_merchant')
        .select('id, total_harga, status, created_at, updated_at, siswa:siswa_id(nama)')
        .in('status', ['lunas', 'diproses', 'siap_diambil'])
        .gte('created_at', `${startTgl}T00:00:00`)
        .lte('created_at', `${endTgl}T23:59:59`)
        .order('created_at', { ascending: false }),
      supabase
        .from('keuangan_club')
        .select('*')
        .gte('tgl', startTgl)
        .lte('tgl', endTgl)
        .order('tgl', { ascending: true }),
      supabase
        .from('payroll_runs')
        .select('*, payroll_details(*, pelatih:pelatih_id(nama))')
        .eq('bulan', bul)
        .eq('tahun', tah)
        .maybeSingle(),
    ])

    setKeuanganData([{
      iuranRows: iuranRes.data || [],
      merchantRows: merchantRes.data || [],
      transaksi: manualRes.data || [],
      payrollRun: honorRes.data || null,
    }])
  }, [filterBulan, filterTahun])

  // 2. Fetch Kehadiran (Fixing date range bug + including session details)
  const fetchKehadiran = useCallback(async () => {
    const bul = parseInt(filterBulan)
    const tah = parseInt(filterTahun)
    const lastDay = new Date(tah, bul, 0).getDate()
    const startTgl = `${tah}-${filterBulan}-01`
    const endTgl = `${tah}-${filterBulan}-${String(lastDay).padStart(2, '0')}`

    // Ambil siswa aktif
    const { data: siswaList } = await supabase
      .from('siswa')
      .select('id, nama, program_kelas:program_kelas_id(nama_program)')
      .eq('status_aktif', true)
      .order('nama')

    // Ambil absensi siswa di periode terpilih
    const { data: absensiRows } = await supabase
      .from('absensi_siswa')
      .select('id, tgl, kelas, status_hadir, siswa_id, pelatih:pelatih_id_pengajar(nama)')
      .gte('tgl', startTgl)
      .lte('tgl', endTgl)
      .order('tgl', { ascending: true })

    const rows = absensiRows || []
    const grouped: Record<string, KehadiranSiswaRekap> = {}

    // Inisialisasi data untuk semua siswa aktif
    for (const s of (siswaList || [])) {
      grouped[s.id] = {
        siswaId: s.id,
        nama: s.nama,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        programKelas: (s.program_kelas as any)?.nama_program || 'Umum',
        hadir: 0,
        izin: 0,
        sakit: 0,
        alpha: 0,
        totalSesi: 0,
        persen: 0,
        riwayat: []
      }
    }

    // Masukkan riwayat absensi
    for (const r of rows) {
      if (!grouped[r.siswa_id]) {
        // Jika ada siswa di absensi yang tidak ada di daftar aktif
        grouped[r.siswa_id] = {
          siswaId: r.siswa_id,
          nama: 'Siswa Nonaktif',
          programKelas: 'Umum',
          hadir: 0,
          izin: 0,
          sakit: 0,
          alpha: 0,
          totalSesi: 0,
          persen: 0,
          riwayat: []
        }
      }

      const item = grouped[r.siswa_id]
      const status = r.status_hadir as 'hadir' | 'izin' | 'sakit' | 'alpha'
      if (item[status] !== undefined) {
        item[status]++
      }
      item.totalSesi++
      item.riwayat.push({
        id: r.id,
        tgl: r.tgl,
        kelas: r.kelas,
        status_hadir: status,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        pelatih_nama: (r.pelatih as any)?.nama || 'Pelatih'
      })
    }

    // Hitung persentase
    const result = Object.values(grouped).map(item => ({
      ...item,
      persen: item.totalSesi > 0 ? Math.round((item.hadir / item.totalSesi) * 100) : 0
    }))

    // Sort by hadir terbanyak lalu nama
    setKehadiranData(result.sort((a, b) => b.hadir - a.hadir || a.nama.localeCompare(b.nama)))
  }, [filterBulan, filterTahun])

  // 3. Fetch Tagihan & Ortu
  const fetchTagihan = useCallback(async () => {
    const bul = parseInt(filterBulan)
    const tah = parseInt(filterTahun)
    const lastDay = new Date(tah, bul, 0).getDate()
    const startTgl = `${tah}-${filterBulan}-01`
    const endTgl = `${tah}-${filterBulan}-${String(lastDay).padStart(2, '0')}`

    const [siswaRes, absensiRes, iuranRes] = await Promise.all([
      supabase
        .from('siswa')
        .select('id, nama, no_hp_ortu, program_kelas_id, program_kelas:program_kelas_id(nama_program, biaya_bulanan)')
        .eq('status_aktif', true)
        .order('nama'),
      supabase
        .from('absensi_siswa')
        .select('id, tgl, kelas, status_hadir, siswa_id, pelatih:pelatih_id_pengajar(nama)')
        .gte('tgl', startTgl)
        .lte('tgl', endTgl)
        .order('tgl', { ascending: true }),
      supabase
        .from('iuran')
        .select('id, siswa_id, status_bayar, nominal')
        .eq('bulan', bul)
        .eq('tahun', tah),
    ])

    const siswaList = siswaRes.data || []
    const absensiRows = absensiRes.data || []
    const iuranRows = iuranRes.data || []

    const merged: SiswaRekapTagihan[] = siswaList.map(s => {
      const abs = absensiRows.filter(a => a.siswa_id === s.id)
      const iuran = iuranRows.find(i => i.siswa_id === s.id)
      const hadir = abs.filter(a => a.status_hadir === 'hadir').length
      const total = abs.length
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const prog = s.program_kelas as any
      const defaultBiaya = prog?.biaya_bulanan || 100000

      return {
        id: s.id,
        nama: s.nama,
        no_hp_ortu: s.no_hp_ortu || '',
        programKelas: prog?.nama_program || 'Umum',
        hadir,
        izin: abs.filter(a => a.status_hadir === 'izin').length,
        sakit: abs.filter(a => a.status_hadir === 'sakit').length,
        alpha: abs.filter(a => a.status_hadir === 'alpha').length,
        totalSesi: total,
        persen: total > 0 ? Math.round((hadir / total) * 100) : 0,
        statusIuran: iuran?.status_bayar || 'belum_bayar',
        nominalIuran: iuran ? Number(iuran.nominal) : defaultBiaya,
        iuranId: iuran?.id,
        riwayat: abs.map(a => ({
          id: a.id,
          tgl: a.tgl,
          kelas: a.kelas,
          status_hadir: a.status_hadir as 'hadir' | 'izin' | 'sakit' | 'alpha',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          pelatih_nama: (a.pelatih as any)?.nama || 'Pelatih'
        }))
      }
    })

    setTagihanData(merged)
  }, [filterBulan, filterTahun])

  // 4. Fetch Honor
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

  // 5. Fetch Anggota
  const fetchAnggota = useCallback(async () => {
    const tah = parseInt(filterTahun)
    const { data: all } = await supabase.from('siswa').select('id, nama, tgl_gabung, status_aktif')
    const rows = all || []
    const aktif = rows.filter(s => s.status_aktif)
    const baru = aktif.filter(s => s.tgl_gabung >= `${tah}-01-01` && s.tgl_gabung <= `${tah}-12-31`)
    const nonaktif = rows.filter(s => !s.status_aktif)
    setAnggotaData({ aktif: aktif.length, baru: baru.length, nonaktif: nonaktif.length, list: rows })
  }, [filterTahun])

  // 6. Fetch Prestasi
  const fetchPrestasi = useCallback(async () => {
    const { data } = await supabase
      .from('prestasi')
      .select('*, siswa:siswa_id(nama)')
      .order('tgl_event', { ascending: false })
    setPrestasiData(data || [])
  }, [])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    await Promise.all([
      fetchKeuangan(),
      fetchKehadiran(),
      fetchTagihan(),
      fetchHonor(),
      fetchAnggota(),
      fetchPrestasi()
    ])
    setLoading(false)
  }, [fetchKeuangan, fetchKehadiran, fetchTagihan, fetchHonor, fetchAnggota, fetchPrestasi])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // CSV Download Utility
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
    if (activeTab === 'keuangan') {
      const rows: (string | number)[][] = []
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      iuranRows.filter((r: any) => r.status_bayar === 'lunas').forEach((r: any) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rows.push(['Pemasukan', 'Iuran Bulanan', `Iuran ${(r.siswa as any)?.nama || 'Siswa'}`, r.nominal])
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      merchantRows.forEach((r: any) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rows.push(['Pemasukan', 'Penjualan Merchant', `Pesanan Merchant — ${(r.siswa as any)?.nama || 'Siswa'}`, r.total_harga])
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      transaksiRows.forEach((r: any) => {
        rows.push([r.jenis === 'income' ? 'Pemasukan' : 'Pengeluaran', r.kategori, r.keterangan, r.nominal])
      })
      const pr = keuanganData[0]?.payrollRun
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(pr?.payroll_details || []).filter((d: any) => d.status_dibayar).forEach((d: any) => {
        const net = d.honor_bersih !== null && d.honor_bersih !== undefined ? Number(d.honor_bersih) : (Number(d.total_payout) - Number(d.potongan_kasbon || 0))
        rows.push(['Pengeluaran', 'Honor Pelatih', `Honor ${d.pelatih?.nama || 'Pelatih'}${Number(d.potongan_kasbon || 0) > 0 ? ' (Bersih)' : ''}`, net])
      })

      downloadCSV(`laporan-keuangan-${bul}-${filterTahun}.csv`, rows, ['Jenis', 'Kategori', 'Keterangan', 'Nominal (Rp)'])
    } else if (activeTab === 'kehadiran') {
      downloadCSV(`rekap-kehadiran-${bul}-${filterTahun}.csv`,
        kehadiranData.map(s => [s.nama, s.programKelas, s.hadir, s.izin, s.sakit, s.alpha, s.totalSesi, `${s.persen}%`]),
        ['Nama Siswa', 'Program Kelas', 'Hadir', 'Izin', 'Sakit', 'Alpha', 'Total Sesi', '% Kehadiran']
      )
    } else if (activeTab === 'tagihan_ortu') {
      downloadCSV(`tagihan-iuran-${bul}-${filterTahun}.csv`,
        filteredTagihan.map(s => [s.nama, s.programKelas, s.no_hp_ortu, s.nominalIuran, s.statusIuran, s.hadir, s.totalSesi, `${s.persen}%`]),
        ['Nama Siswa', 'Program Kelas', 'No HP Ortu', 'Nominal Iuran', 'Status Bayar', 'Hadir (Sesi)', 'Total Sesi', '% Kehadiran']
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
        (run.payroll_details || []).map((d: any) => {
          const net = d.honor_bersih !== null && d.honor_bersih !== undefined ? Number(d.honor_bersih) : (Number(d.total_payout) - Number(d.potongan_kasbon || 0))
          return [d.pelatih?.nama || '', d.pelatih?.role || '', d.teaching_honor || 0, d.founder_margin_share || 0, d.total_payout || 0, d.potongan_kasbon || 0, net, d.status_dibayar ? 'Sudah Dibayar' : 'Belum']
        }),
        ['Nama Pelatih', 'Role', 'Honor Mengajar', 'Founder Share', 'Honor Kotor', 'Potongan Kasbon', 'Honor Bersih', 'Status']
      )
    }
  }

  // Formatting WhatsApp Message for Billing Reminder
  const generatePesanTagihan = (siswa: SiswaRekapTagihan): string => {
    const bul = BULAN_NAMES[parseInt(filterBulan)]
    const clubName = clubSettings?.nama_club || 'Siger Taekwondo Club'
    const bank = clubSettings?.rekening_bank || 'BCA / BRI / Mandiri'
    const noRek = clubSettings?.rekening_nomor || '-'
    const an = clubSettings?.rekening_atas_nama || clubName

    return `🥋 *PEMBERITAHUAN TAGIHAN IURAN BULANAN*\n*${clubName.toUpperCase()}*\n\n` +
      `Kepada Yth. Orang Tua / Wali Siswa\n` +
      `👤 *Nama Siswa*: ${siswa.nama}\n` +
      `🥋 *Program*: Kelas ${siswa.programKelas}\n` +
      `📅 *Periode Tagihan*: ${bul} ${filterTahun}\n` +
      `💰 *Jumlah Tagihan*: *${formatRupiah(siswa.nominalIuran)}*\n` +
      `📌 *Status*: ⏳ Belum Lunas\n\n` +
      `📊 *Kehadiran Latihan (${bul} ${filterTahun})*:\n` +
      `• Hadir: ${siswa.hadir}x dari ${siswa.totalSesi} sesi (${siswa.persen}%)\n` +
      `• Izin: ${siswa.izin}x | Sakit: ${siswa.sakit}x | Alpha: ${siswa.alpha}x\n\n` +
      `💳 *Rekening Pembayaran*:\n` +
      `• Bank: ${bank}\n` +
      `• No. Rekening: *${noRek}*\n` +
      `• Atas Nama: ${an}\n\n` +
      `_Mohon untuk melakukan konfirmasi & upload bukti transfer melalui portal wali murid atau kirimkan balasan ke pesan ini setelah melakukan pembayaran._\n\n` +
      `Terima kasih atas kerja sama dan dukungannya. 🙏🥋`
  }

  // Formatting WhatsApp Message for Full Report
  const generatePesanRekapLengkap = (siswa: SiswaRekapTagihan): string => {
    const bul = BULAN_NAMES[parseInt(filterBulan)]
    const clubName = clubSettings?.nama_club || 'Siger Taekwondo Club'
    const statusLabel: Record<string, string> = {
      lunas: '✅ LUNAS',
      belum_bayar: '⏳ BELUM DIBAYAR',
      menunggu_verifikasi: '🔍 MENUNGGU VERIFIKASI ADMIN',
      ditolak: '❌ DITOLAK (Silakan Upload Ulang)'
    }

    return `📊 *LAPORAN BULANAN SISWA*\n*${clubName.toUpperCase()}*\n\n` +
      `👤 *Nama Siswa*: ${siswa.nama}\n` +
      `🥋 *Program*: ${siswa.programKelas}\n` +
      `📅 *Periode*: ${bul} ${filterTahun}\n\n` +
      `🥋 *REKAP KEHADIRAN*:\n` +
      `• Total Kehadiran: *${siswa.hadir}x* dari ${siswa.totalSesi} sesi (${siswa.persen}%)\n` +
      `• Izin: ${siswa.izin}x | Sakit: ${siswa.sakit}x | Alpha: ${siswa.alpha}x\n\n` +
      `💰 *STATUS IURAN BULANAN*:\n` +
      `• Tagihan: *${formatRupiah(siswa.nominalIuran)}*\n` +
      `• Status: *${statusLabel[siswa.statusIuran] || siswa.statusIuran}*\n\n` +
      `Tetap semangat berlatih! 🥋🔥\n` +
      `_${clubName}_`
  }

  const handleKirimWA = (siswa: SiswaRekapTagihan, mode: 'tagihan' | 'rekap') => {
    if (!siswa.no_hp_ortu) {
      alert(`Nomor HP Orang Tua untuk siswa ${siswa.nama} belum terdaftar di data siswa.`)
      return
    }
    const teks = mode === 'tagihan' ? generatePesanTagihan(siswa) : generatePesanRekapLengkap(siswa)
    const noWA = siswa.no_hp_ortu.replace(/^0/, '62').replace(/\D/g, '')
    window.open(`https://wa.me/${noWA}?text=${encodeURIComponent(teks)}`, '_blank')
  }

  const handleSalinPesan = (siswa: SiswaRekapTagihan, mode: 'tagihan' | 'rekap') => {
    const teks = mode === 'tagihan' ? generatePesanTagihan(siswa) : generatePesanRekapLengkap(siswa)
    navigator.clipboard.writeText(teks)
    showToast(`📋 Pesan ${mode === 'tagihan' ? 'Tagihan' : 'Rekap'} untuk ${siswa.nama} berhasil disalin ke clipboard!`)
  }

  const handleSalinSemuaBelumBayar = () => {
    const bul = BULAN_NAMES[parseInt(filterBulan)]
    const listBelum = tagihanData.filter(s => s.statusIuran === 'belum_bayar' || s.statusIuran === 'ditolak')
    if (listBelum.length === 0) {
      alert('Semua siswa sudah lunas untuk periode ini!')
      return
    }

    const totalNominal = listBelum.reduce((acc, curr) => acc + curr.nominalIuran, 0)
    let text = `📋 *DAFTAR SISWA BELUM BAYAR IURAN*\n` +
      `📅 Periode: ${bul} ${filterTahun}\n` +
      `👥 Total: ${listBelum.length} Siswa\n` +
      `💰 Total Tagihan: ${formatRupiah(totalNominal)}\n\n`

    listBelum.forEach((s, idx) => {
      text += `${idx + 1}. *${s.nama}* (${s.programKelas}) - ${formatRupiah(s.nominalIuran)} (WA: ${s.no_hp_ortu || '-'})\n`
    })

    navigator.clipboard.writeText(text)
    showToast(`📋 Daftar ${listBelum.length} siswa belum bayar berhasil disalin!`)
  }

  // Filter tagihan data
  const filteredTagihan = tagihanData.filter(s => {
    const matchSearch = s.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.no_hp_ortu.toLowerCase().includes(searchQuery.toLowerCase())
    const matchKelas = kelasFilter === 'semua' || s.programKelas.toLowerCase() === kelasFilter.toLowerCase()

    if (!matchSearch || !matchKelas) return false

    if (tagihanStatusFilter === 'belum_bayar') {
      return s.statusIuran === 'belum_bayar' || s.statusIuran === 'ditolak'
    }
    if (tagihanStatusFilter === 'menunggu_verifikasi') {
      return s.statusIuran === 'menunggu_verifikasi'
    }
    if (tagihanStatusFilter === 'lunas') {
      return s.statusIuran === 'lunas'
    }
    return true
  })

  // Filter kehadiran data
  const filteredKehadiran = kehadiranData.filter(s => {
    const matchSearch = s.nama.toLowerCase().includes(searchQuery.toLowerCase())
    const matchKelas = kelasFilter === 'semua' || s.programKelas.toLowerCase() === kelasFilter.toLowerCase()
    return matchSearch && matchKelas
  })

  // Tagihan summary
  const countBelumBayar = tagihanData.filter(s => s.statusIuran === 'belum_bayar' || s.statusIuran === 'ditolak').length
  const nominalBelumBayar = tagihanData.filter(s => s.statusIuran === 'belum_bayar' || s.statusIuran === 'ditolak').reduce((acc, s) => acc + s.nominalIuran, 0)
  const countMenungguVerif = tagihanData.filter(s => s.statusIuran === 'menunggu_verifikasi').length
  const countLunas = tagihanData.filter(s => s.statusIuran === 'lunas').length
  const nominalLunas = tagihanData.filter(s => s.statusIuran === 'lunas').reduce((acc, s) => acc + s.nominalIuran, 0)

  // Kehadiran summary
  const totalCatatanKehadiran = kehadiranData.reduce((acc, s) => acc + s.totalSesi, 0)
  const totalHadirSemua = kehadiranData.reduce((acc, s) => acc + s.hadir, 0)
  const totalIzinSemua = kehadiranData.reduce((acc, s) => acc + s.izin, 0)
  const totalSakitSemua = kehadiranData.reduce((acc, s) => acc + s.sakit, 0)
  const totalAlphaSemua = kehadiranData.reduce((acc, s) => acc + s.alpha, 0)
  const avgKehadiran = totalCatatanKehadiran > 0 ? Math.round((totalHadirSemua / totalCatatanKehadiran) * 100) : 0

  // Keuangan variables
  const iuranRows = keuanganData[0]?.iuranRows || []
  const merchantRows = keuanganData[0]?.merchantRows || []
  const transaksiRows = keuanganData[0]?.transaksi || []
  const payrollRun = keuanganData[0]?.payrollRun || null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pemasukanIuran = iuranRows.filter((r: any) => r.status_bayar === 'lunas').reduce((s: number, r: any) => s + Number(r.nominal || 0), 0)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pemasukanMerchant = merchantRows.reduce((s: number, r: any) => s + Number(r.total_harga || 0), 0)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pemasukanManual = transaksiRows.filter((r: any) => r.jenis === 'income').reduce((s: number, r: any) => s + Number(r.nominal || 0), 0)
  const totalPemasukan = pemasukanIuran + pemasukanMerchant + pemasukanManual

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pengeluaranHonor = (payrollRun?.payroll_details || []).filter((d: any) => d.status_dibayar).reduce((s: number, d: any) => {
    const net = d.honor_bersih !== null && d.honor_bersih !== undefined ? Number(d.honor_bersih) : (Number(d.total_payout) - Number(d.potongan_kasbon || 0))
    return s + net
  }, 0)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pengeluaranManual = transaksiRows.filter((r: any) => r.jenis === 'expense').reduce((s: number, r: any) => s + Number(r.nominal || 0), 0)
  const totalPengeluaran = pengeluaranHonor + pengeluaranManual
  const saldoBersih = totalPemasukan - totalPengeluaran

  const TABS: { key: Tab; label: string; badge?: number }[] = [
    { key: 'tagihan_ortu', label: '📤 Tagihan & Blast WA', badge: countBelumBayar },
    { key: 'kehadiran', label: '📅 Rekap Kehadiran' },
    { key: 'keuangan', label: '💰 Keuangan' },
    { key: 'honor', label: '🏆 Honor Pelatih' },
    { key: 'anggota', label: '👤 Anggota' },
    { key: 'prestasi', label: '🎖️ Prestasi' },
  ]

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-6 pb-12">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-5 right-5 z-50 p-4 bg-primary text-dark font-bold font-sans rounded-2xl border-2 border-dark shadow-brutal animate-bounce">
          {toastMsg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 print:hidden">
        <div>
          <h1 className="text-3xl font-bold font-sans text-dark">📄 Laporan, Rekap &amp; Tagihan</h1>
          <p className="text-dark/60 font-sans mt-1">Rekap data kehadiran siswa, keuangan, dan pengiriman tagihan iuran WhatsApp</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => window.print()}
            className="px-4 py-2 bg-dark text-white rounded-2xl font-bold text-sm border-2 border-dark hover:bg-dark/80 transition-colors shadow-brutal">
            🖨️ Print / PDF
          </button>
          <button onClick={handleDownloadCSV}
            className="px-4 py-2 bg-primary text-dark rounded-2xl font-bold text-sm border-2 border-dark hover:bg-primary/80 transition-colors shadow-brutal">
            ⬇️ Download CSV
          </button>
        </div>
      </div>

      {/* Print View Header */}
      <div className="hidden print:block mb-4">
        <h1 className="text-2xl font-bold">📄 Laporan {clubSettings?.nama_club || 'Siger Taekwondo Club'}</h1>
        <p className="text-sm text-gray-500">Periode: {BULAN_NAMES[parseInt(filterBulan)]} {filterTahun}</p>
        <hr className="mt-2" />
      </div>

      {/* Month & Year Filter */}
      <Card className="print:hidden">
        <div className="flex gap-4 flex-wrap items-end justify-between">
          <div className="flex gap-4 flex-wrap items-end">
            <div className="flex flex-col gap-2">
              <label className="font-bold text-dark text-sm">Bulan</label>
              <select
                value={filterBulan}
                onChange={e => setFilterBulan(e.target.value)}
                className="border-2 border-dark rounded-2xl px-4 py-3 bg-white text-dark focus:outline-none focus:ring-2 focus:ring-primary font-sans min-w-[150px]"
              >
                {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map(m => (
                  <option key={m} value={m}>{BULAN_NAMES[parseInt(m)]}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="font-bold text-dark text-sm">Tahun</label>
              <Input
                type="number"
                value={filterTahun}
                onChange={e => setFilterTahun(e.target.value)}
                className="max-w-[110px]"
              />
            </div>
          </div>

          <div className="text-xs font-sans text-dark/70 flex items-center gap-2 bg-background p-3 rounded-xl border border-dark/20">
            <span>💳 Rekening Pembayaran Aktif:</span>
            <strong className="text-dark font-mono">
              {clubSettings?.rekening_bank || 'Bank'} {clubSettings?.rekening_nomor ? `• ${clubSettings.rekening_nomor}` : '(Belum Diisi)'} (a.n {clubSettings?.rekening_atas_nama || '-'})
            </strong>
          </div>
        </div>
      </Card>

      {/* Main Tabs Navigation */}
      <div className="flex gap-2 flex-wrap print:hidden">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2.5 rounded-2xl font-bold font-sans text-sm transition-all border-2 flex items-center gap-2 ${activeTab === t.key ? 'bg-dark text-white border-dark shadow-brutal' : 'bg-white text-dark border-dark/30 hover:border-dark'}`}
          >
            <span>{t.label}</span>
            {t.badge !== undefined && t.badge > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${activeTab === t.key ? 'bg-accent text-white' : 'bg-accent/20 text-accent'}`}>
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <Card className="text-center py-16 text-dark/50 font-sans">
          <div className="text-3xl mb-2">⏳</div>
          <p className="font-bold">Memuat data laporan...</p>
        </Card>
      ) : (
        <>
          {/* TAB 1: TAGIHAN SISWA & BLAST WA */}
          {activeTab === 'tagihan_ortu' && (
            <div className="flex flex-col gap-6">
              {/* Stats Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card className="bg-red-50 border-2 border-red-500/50 p-4 text-center">
                  <div className="text-xs font-bold text-red-600 uppercase">⏳ Belum Bayar</div>
                  <div className="text-2xl font-bold font-sans text-red-700 mt-1">{countBelumBayar} Siswa</div>
                  <div className="text-xs font-bold font-mono text-red-600 mt-0.5">{formatRupiah(nominalBelumBayar)}</div>
                </Card>

                <Card className="bg-yellow-50 border-2 border-yellow-500/50 p-4 text-center">
                  <div className="text-xs font-bold text-yellow-700 uppercase">🔍 Menunggu Verif</div>
                  <div className="text-2xl font-bold font-sans text-yellow-800 mt-1">{countMenungguVerif} Siswa</div>
                  <div className="text-xs text-yellow-700 mt-0.5">Bukti transfer terunggah</div>
                </Card>

                <Card className="bg-green-50 border-2 border-green-500/50 p-4 text-center">
                  <div className="text-xs font-bold text-green-700 uppercase">✅ Lunas</div>
                  <div className="text-2xl font-bold font-sans text-green-800 mt-1">{countLunas} Siswa</div>
                  <div className="text-xs font-bold font-mono text-green-700 mt-0.5">{formatRupiah(nominalLunas)}</div>
                </Card>

                <Card className="bg-white border-2 border-dark p-4 text-center">
                  <div className="text-xs font-bold text-dark/60 uppercase">👥 Total Tagihan</div>
                  <div className="text-2xl font-bold font-sans text-dark mt-1">{tagihanData.length} Siswa</div>
                  <div className="text-xs font-bold font-mono text-dark/70 mt-0.5">{formatRupiah(nominalLunas + nominalBelumBayar)}</div>
                </Card>
              </div>

              {/* Action Banner & Bulk Copy */}
              <div className="p-4 bg-primary/15 border-2 border-dark rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-dark font-sans text-base">📢 Pengingat &amp; Tagihan Iuran Siswa</h3>
                  <p className="text-xs text-dark/70 font-sans mt-0.5">
                    Kirim pesan rincian tagihan atau rekap bulanan langsung ke WhatsApp orang tua dengan nomor rekening dojang.
                  </p>
                </div>
                <div className="flex gap-2 flex-wrap shrink-0">
                  <Button
                    variant="accent"
                    onClick={handleSalinSemuaBelumBayar}
                    className="text-xs py-2 px-3 font-bold"
                  >
                    📋 Salin Daftar Belum Bayar
                  </Button>
                </div>
              </div>

              {/* Sub-Filters */}
              <Card className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  {/* Status Chips */}
                  <div className="flex gap-2 flex-wrap">
                    {[
                      { key: 'belum_bayar', label: '🔴 Belum Bayar', count: countBelumBayar },
                      { key: 'menunggu_verifikasi', label: '🔍 Menunggu Verif', count: countMenungguVerif },
                      { key: 'lunas', label: '✅ Lunas', count: countLunas },
                      { key: 'semua', label: 'Semua Status', count: tagihanData.length },
                    ].map(f => (
                      <button
                        key={f.key}
                        onClick={() => setTagihanStatusFilter(f.key as any)}
                        className={`px-3 py-1.5 rounded-xl font-bold font-sans text-xs transition-all border ${tagihanStatusFilter === f.key ? 'bg-dark text-white border-dark shadow-sm' : 'bg-background text-dark/70 border-dark/20 hover:border-dark'}`}
                      >
                        {f.label} ({f.count})
                      </button>
                    ))}
                  </div>

                  {/* Class Filter & Search */}
                  <div className="flex gap-3 flex-wrap items-center">
                    <select
                      value={kelasFilter}
                      onChange={e => setKelasFilter(e.target.value)}
                      className="border border-dark/30 rounded-xl px-3 py-2 text-xs font-sans bg-white text-dark focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="semua">Semua Program Kelas</option>
                      <option value="umum">Kelas Umum</option>
                      <option value="prestasi">Kelas Prestasi</option>
                    </select>
                    <input
                      type="text"
                      placeholder="Cari nama siswa / no HP..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="border border-dark/30 rounded-xl px-3 py-2 text-xs font-sans bg-white text-dark focus:outline-none focus:ring-2 focus:ring-primary min-w-[200px]"
                    />
                  </div>
                </div>

                {/* List of Students */}
                <div className="flex flex-col gap-3 mt-2">
                  {filteredTagihan.map((s) => (
                    <div
                      key={s.id}
                      className={`p-4 rounded-2xl border-2 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${s.statusIuran === 'belum_bayar' || s.statusIuran === 'ditolak' ? 'bg-red-50/50 border-red-300' : s.statusIuran === 'menunggu_verifikasi' ? 'bg-yellow-50/50 border-yellow-300' : 'bg-white border-dark/20'}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-dark font-sans text-base">{s.nama}</h4>
                          <Badge color="dark">{s.programKelas}</Badge>
                          <Badge color={s.statusIuran === 'lunas' ? 'primary' : s.statusIuran === 'menunggu_verifikasi' ? 'secondary' : 'accent'}>
                            {s.statusIuran === 'lunas' ? '✅ Lunas' : s.statusIuran === 'menunggu_verifikasi' ? '🔍 Menunggu Verif' : '⏳ Belum Bayar'}
                          </Badge>
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-dark/70 font-sans">
                          <div>
                            💰 Tagihan: <strong className="text-dark font-mono text-sm">{formatRupiah(s.nominalIuran)}</strong>
                          </div>
                          <div>
                            📅 Kehadiran: <strong className="text-green-700">{s.hadir}</strong>/{s.totalSesi} sesi ({s.persen}%)
                          </div>
                          <div>
                            📱 HP Ortu: <strong className="text-dark font-mono">{s.no_hp_ortu || 'Belum diisi'}</strong>
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 flex-wrap shrink-0">
                        <button
                          onClick={() => setSelectedSiswaDetail(s)}
                          className="px-3 py-2 bg-white border border-dark/30 rounded-xl text-xs font-bold text-dark hover:bg-dark/5 transition-colors flex items-center gap-1.5"
                          title="Lihat riwayat kehadiran siswa ini"
                        >
                          🔍 Absensi
                        </button>

                        <button
                          onClick={() => handleSalinPesan(s, 'tagihan')}
                          className="px-3 py-2 bg-secondary/30 border border-dark/30 rounded-xl text-xs font-bold text-dark hover:bg-secondary/50 transition-colors flex items-center gap-1.5"
                          title="Salin pesan tagihan ke clipboard"
                        >
                          📋 Salin
                        </button>

                        <button
                          onClick={() => handleKirimWA(s, 'tagihan')}
                          className="px-3.5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm"
                          title="Kirim pesan tagihan WhatsApp"
                        >
                          💬 Kirim Tagihan (WA)
                        </button>

                        <button
                          onClick={() => handleKirimWA(s, 'rekap')}
                          className="px-3 py-2 bg-dark hover:bg-dark/80 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm"
                          title="Kirim laporan rekap lengkap bulanan via WA"
                        >
                          📊 Rekap (WA)
                        </button>
                      </div>
                    </div>
                  ))}

                  {filteredTagihan.length === 0 && (
                    <div className="text-center py-12 text-dark/40 font-sans">
                      <div className="text-3xl mb-2">🔍</div>
                      <p>Tidak ada data tagihan yang sesuai dengan filter.</p>
                    </div>
                  )}
                </div>
              </Card>
            </div>
          )}

          {/* TAB 2: REKAP KEHADIRAN SISWA */}
          {activeTab === 'kehadiran' && (
            <div className="flex flex-col gap-6">
              {/* Summary Stats Kehadiran */}
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
                <Card className="bg-white border-2 border-dark text-center p-3">
                  <div className="text-xs text-dark/50 font-bold uppercase">Total Sesi</div>
                  <div className="text-2xl font-bold font-sans text-dark mt-1">{totalCatatanKehadiran}</div>
                </Card>
                <Card className="bg-green-50 border-2 border-green-500/40 text-center p-3">
                  <div className="text-xs text-green-700 font-bold uppercase">✅ Hadir</div>
                  <div className="text-2xl font-bold font-sans text-green-800 mt-1">{totalHadirSemua}</div>
                </Card>
                <Card className="bg-blue-50 border-2 border-blue-500/40 text-center p-3">
                  <div className="text-xs text-blue-700 font-bold uppercase">📝 Izin</div>
                  <div className="text-2xl font-bold font-sans text-blue-800 mt-1">{totalIzinSemua}</div>
                </Card>
                <Card className="bg-yellow-50 border-2 border-yellow-500/40 text-center p-3">
                  <div className="text-xs text-yellow-700 font-bold uppercase">🤒 Sakit</div>
                  <div className="text-2xl font-bold font-sans text-yellow-800 mt-1">{totalSakitSemua}</div>
                </Card>
                <Card className="bg-red-50 border-2 border-red-500/40 text-center p-3">
                  <div className="text-xs text-red-600 font-bold uppercase">❌ Alpha</div>
                  <div className="text-2xl font-bold font-sans text-red-700 mt-1">{totalAlphaSemua}</div>
                </Card>
                <Card className="bg-primary/20 border-2 border-primary text-center p-3">
                  <div className="text-xs text-dark/70 font-bold uppercase">Rata-rata</div>
                  <div className="text-2xl font-bold font-sans text-dark mt-1">{avgKehadiran}%</div>
                </Card>
              </div>

              {/* Table Kehadiran */}
              <Card>
                <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                  <h2 className="font-bold text-dark text-lg">
                    📅 Rekap Kehadiran Siswa — {BULAN_NAMES[parseInt(filterBulan)]} {filterTahun}
                  </h2>
                  <div className="flex gap-3 flex-wrap items-center">
                    <select
                      value={kelasFilter}
                      onChange={e => setKelasFilter(e.target.value)}
                      className="border border-dark/30 rounded-xl px-3 py-2 text-xs font-sans bg-white text-dark focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="semua">Semua Program</option>
                      <option value="umum">Kelas Umum</option>
                      <option value="prestasi">Kelas Prestasi</option>
                    </select>
                    <input
                      type="text"
                      placeholder="Cari nama siswa..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="border border-dark/30 rounded-xl px-3 py-2 text-xs font-sans bg-white text-dark focus:outline-none focus:ring-2 focus:ring-primary min-w-[180px]"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm font-sans">
                    <thead>
                      <tr className="border-b-2 border-dark/20 text-dark/60 font-bold text-xs uppercase">
                        <th className="text-left py-2.5">Nama Siswa</th>
                        <th className="text-left py-2.5">Kelas</th>
                        <th className="text-center py-2.5 text-green-700">✅ Hadir</th>
                        <th className="text-center py-2.5 text-blue-600">📝 Izin</th>
                        <th className="text-center py-2.5 text-yellow-600">🤒 Sakit</th>
                        <th className="text-center py-2.5 text-red-600">❌ Alpha</th>
                        <th className="text-center py-2.5">Total Sesi</th>
                        <th className="text-center py-2.5">% Hadir</th>
                        <th className="text-center py-2.5 print:hidden">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredKehadiran.map((s, i) => (
                        <tr key={i} className="border-b border-dark/10 hover:bg-black/5 transition-colors">
                          <td className="py-2.5 font-bold text-dark">{s.nama}</td>
                          <td className="py-2.5">
                            <Badge color="dark">{s.programKelas}</Badge>
                          </td>
                          <td className="py-2.5 text-center text-green-700 font-bold">{s.hadir}</td>
                          <td className="py-2.5 text-center text-blue-600">{s.izin}</td>
                          <td className="py-2.5 text-center text-yellow-600">{s.sakit}</td>
                          <td className="py-2.5 text-center text-red-600">{s.alpha}</td>
                          <td className="py-2.5 text-center font-bold text-dark/70">{s.totalSesi}</td>
                          <td className="py-2.5 text-center">
                            <span className={`font-bold px-2 py-0.5 rounded-full text-xs ${s.persen >= 80 ? 'bg-green-100 text-green-700' : s.persen >= 60 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-600'}`}>
                              {s.persen}%
                            </span>
                          </td>
                          <td className="py-2.5 text-center print:hidden">
                            <button
                              onClick={() => setSelectedSiswaDetail(s)}
                              className="px-2.5 py-1 bg-white border border-dark/30 rounded-lg text-xs font-bold text-dark hover:bg-dark/10 transition-colors"
                            >
                              🔍 Detail
                            </button>
                          </td>
                        </tr>
                      ))}

                      {filteredKehadiran.length === 0 && (
                        <tr>
                          <td colSpan={9} className="py-8 text-center text-dark/40">
                            Tidak ada data absensi untuk periode ini
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {/* TAB 3: KEUANGAN */}
          {activeTab === 'keuangan' && (
            <div className="flex flex-col gap-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="flex flex-col gap-2 border-2 border-dark">
                  <div className="text-xs font-bold text-dark/50 uppercase tracking-wide">💵 Total Pemasukan</div>
                  <div className="text-2xl font-bold font-sans text-green-700">{formatRupiah(totalPemasukan)}</div>
                  <div className="border-t border-dark/10 pt-2 flex flex-col gap-1 text-xs text-dark/70">
                    <div className="flex justify-between">
                      <span>💰 Iuran Siswa</span>
                      <span className="font-bold">{formatRupiah(pemasukanIuran)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>🛒 Toko Merchant</span>
                      <span className="font-bold">{formatRupiah(pemasukanMerchant)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>✏️ Manual</span>
                      <span className="font-bold">{formatRupiah(pemasukanManual)}</span>
                    </div>
                  </div>
                </Card>

                <Card className="flex flex-col gap-2 border-2 border-dark">
                  <div className="text-xs font-bold text-dark/50 uppercase tracking-wide">💸 Total Pengeluaran</div>
                  <div className="text-2xl font-bold font-sans text-red-600">{formatRupiah(totalPengeluaran)}</div>
                  <div className="border-t border-dark/10 pt-2 flex flex-col gap-1 text-xs text-dark/70">
                    <div className="flex justify-between">
                      <span>🏆 Honor Pelatih</span>
                      <span className="font-bold">{formatRupiah(pengeluaranHonor)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>✏️ Manual</span>
                      <span className="font-bold">{formatRupiah(pengeluaranManual)}</span>
                    </div>
                  </div>
                </Card>

                <Card className={`flex flex-col gap-2 border-2 ${saldoBersih >= 0 ? 'bg-primary/10 border-primary' : 'bg-accent/10 border-accent'}`}>
                  <div className="text-xs font-bold text-dark/50 uppercase tracking-wide">🏦 Saldo Bersih</div>
                  <div className={`text-2xl font-bold font-sans ${saldoBersih >= 0 ? 'text-green-700' : 'text-red-600'}`}>{formatRupiah(saldoBersih)}</div>
                  <div className="text-xs text-dark/50 mt-auto">Periode {BULAN_NAMES[parseInt(filterBulan)]} {filterTahun}</div>
                </Card>
              </div>

              {/* Detail Iuran */}
              <Card>
                <h2 className="font-bold text-dark mb-3 text-lg">💰 Detail Iuran Siswa — {BULAN_NAMES[parseInt(filterBulan)]} {filterTahun}</h2>
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
                          <td className="py-2 font-bold text-dark">{(r.siswa as any)?.nama || '-'}</td>
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

              {/* Detail Penjualan Toko Merchant */}
              <Card>
                <h2 className="font-bold text-dark mb-3 text-lg">🛒 Detail Penjualan Toko Merchant — {BULAN_NAMES[parseInt(filterBulan)]} {filterTahun}</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm font-sans">
                    <thead><tr className="border-b-2 border-dark/20">
                      <th className="text-left py-2 text-dark/60 font-bold">Tanggal</th>
                      <th className="text-left py-2 text-dark/60 font-bold">Nama Pemesan / Siswa</th>
                      <th className="text-center py-2 text-dark/60 font-bold">Status Pesanan</th>
                      <th className="text-right py-2 text-dark/60 font-bold">Total Belanja</th>
                    </tr></thead>
                    <tbody>
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {merchantRows.map((m: any, i: number) => (
                        <tr key={i} className="border-b border-dark/10">
                          <td className="py-2 text-dark/70 text-xs">{new Date(m.created_at).toLocaleDateString('id-ID')}</td>
                          <td className="py-2 font-bold text-dark">{(m.siswa as any)?.nama || '-'}</td>
                          <td className="py-2 text-center">
                            <span className="px-2 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 uppercase">
                              ✅ {m.status}
                            </span>
                          </td>
                          <td className="py-2 text-right font-bold text-green-700">{formatRupiah(m.total_harga)}</td>
                        </tr>
                      ))}
                      {merchantRows.length === 0 && <tr><td colSpan={4} className="py-8 text-center text-dark/40">Tidak ada pesanan toko yang lunas pada periode ini</td></tr>}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* Detail Transaksi Kas Manual */}
              <Card>
                <h2 className="font-bold text-dark mb-3 text-lg">✏️ Detail Transaksi Kas Manual — {BULAN_NAMES[parseInt(filterBulan)]} {filterTahun}</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm font-sans">
                    <thead><tr className="border-b-2 border-dark/20">
                      <th className="text-left py-2 text-dark/60 font-bold">Tanggal</th>
                      <th className="text-left py-2 text-dark/60 font-bold">Jenis</th>
                      <th className="text-left py-2 text-dark/60 font-bold">Kategori</th>
                      <th className="text-left py-2 text-dark/60 font-bold">Keterangan</th>
                      <th className="text-right py-2 text-dark/60 font-bold">Nominal</th>
                    </tr></thead>
                    <tbody>
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {transaksiRows.map((t: any, i: number) => (
                        <tr key={i} className="border-b border-dark/10">
                          <td className="py-2 text-dark/70 text-xs">{t.tgl}</td>
                          <td className="py-2">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${t.jenis === 'income' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                              {t.jenis === 'income' ? '💵 Income' : '💸 Expense'}
                            </span>
                          </td>
                          <td className="py-2 text-dark/80 text-xs font-bold">{t.kategori}</td>
                          <td className="py-2 text-dark">{t.keterangan}</td>
                          <td className={`py-2 text-right font-bold ${t.jenis === 'income' ? 'text-green-700' : 'text-red-600'}`}>
                            {t.jenis === 'income' ? '+' : '-'}{formatRupiah(t.nominal)}
                          </td>
                        </tr>
                      ))}
                      {transaksiRows.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-dark/40">Tidak ada transaksi kas manual pada periode ini</td></tr>}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {/* TAB 4: HONOR PELATIH */}
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
                              <th className="text-right py-2 text-dark/60 font-bold">Honor Kotor</th>
                              <th className="text-right py-2 text-dark/60 font-bold">Potongan</th>
                              <th className="text-right py-2 text-dark/60 font-bold">Honor Bersih</th>
                              <th className="text-center py-2 text-dark/60 font-bold">Status</th>
                            </tr></thead>
                            <tbody>
                              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                              {details.map((d: any, i: number) => {
                                const net = d.honor_bersih !== null && d.honor_bersih !== undefined ? Number(d.honor_bersih) : (Number(d.total_payout) - Number(d.potongan_kasbon || 0))
                                return (
                                <tr key={i} className="border-b border-dark/10">
                                  <td className="py-2 font-bold text-dark">{d.pelatih?.nama}</td>
                                  <td className="py-2 text-right">{formatRupiah(d.teaching_honor || 0)}</td>
                                  <td className="py-2 text-right">{formatRupiah(d.founder_margin_share || 0)}</td>
                                  <td className="py-2 text-right font-medium text-dark">{formatRupiah(d.total_payout || 0)}</td>
                                  <td className="py-2 text-right font-bold text-red-600">{Number(d.potongan_kasbon || 0) > 0 ? `-${formatRupiah(Number(d.potongan_kasbon))}` : '-'}</td>
                                  <td className="py-2 text-right font-bold text-green-700">{formatRupiah(net)}</td>
                                  <td className="py-2 text-center">
                                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${d.status_dibayar || d.sudah_dibayar ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                                      {d.status_dibayar || d.sudah_dibayar ? '✅ Dibayar' : '⏳ Belum'}
                                    </span>
                                  </td>
                                </tr>
                                )
                              })}
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

          {/* TAB 5: ANGGOTA */}
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

          {/* TAB 6: PRESTASI */}
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
        </>
      )}

      {/* MODAL: DETAIL RIWAYAT ABSENSI SISWA */}
      {selectedSiswaDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-dark/60 backdrop-blur-sm" onClick={() => setSelectedSiswaDetail(null)} />
          <div className="relative bg-white border-2 border-dark shadow-brutal w-full max-w-lg rounded-2xl p-6 z-10 flex flex-col gap-4 max-h-[85vh] overflow-hidden">
            <div className="flex justify-between items-start border-b border-dark/10 pb-3">
              <div>
                <h3 className="text-xl font-bold font-sans text-dark">{selectedSiswaDetail.nama}</h3>
                <p className="text-xs text-dark/60 font-sans mt-0.5">
                  Program: <strong className="text-dark">{selectedSiswaDetail.programKelas}</strong> · Periode: {BULAN_NAMES[parseInt(filterBulan)]} {filterTahun}
                </p>
              </div>
              <button
                onClick={() => setSelectedSiswaDetail(null)}
                className="w-8 h-8 rounded-full border border-dark/30 hover:bg-dark hover:text-white flex items-center justify-center font-bold text-sm"
              >
                ✕
              </button>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="p-2 bg-green-50 rounded-xl border border-green-300">
                <div className="text-xs font-bold text-green-700">Hadir</div>
                <div className="text-lg font-bold text-green-800">{selectedSiswaDetail.hadir}</div>
              </div>
              <div className="p-2 bg-blue-50 rounded-xl border border-blue-300">
                <div className="text-xs font-bold text-blue-700">Izin</div>
                <div className="text-lg font-bold text-blue-800">{selectedSiswaDetail.izin}</div>
              </div>
              <div className="p-2 bg-yellow-50 rounded-xl border border-yellow-300">
                <div className="text-xs font-bold text-yellow-700">Sakit</div>
                <div className="text-lg font-bold text-yellow-800">{selectedSiswaDetail.sakit}</div>
              </div>
              <div className="p-2 bg-red-50 rounded-xl border border-red-300">
                <div className="text-xs font-bold text-red-600">Alpha</div>
                <div className="text-lg font-bold text-red-700">{selectedSiswaDetail.alpha}</div>
              </div>
            </div>

            {/* Attendance percentage indicator */}
            <div className="p-3 bg-background rounded-xl border border-dark/10 flex justify-between items-center text-xs font-sans">
              <span className="text-dark/70 font-bold">Tingkat Kehadiran:</span>
              <span className="font-bold text-sm text-green-700">
                {selectedSiswaDetail.hadir} / {selectedSiswaDetail.totalSesi} Sesi ({selectedSiswaDetail.persen}%)
              </span>
            </div>

            {/* Session List */}
            <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1">
              <div className="text-xs font-bold text-dark/60 uppercase">Daftar Sesi Latihan:</div>
              {selectedSiswaDetail.riwayat.length === 0 ? (
                <div className="text-center py-8 text-dark/40 text-xs">Belum ada catatan sesi latihan untuk bulan ini</div>
              ) : (
                selectedSiswaDetail.riwayat.map((r, idx) => (
                  <div key={idx} className="p-3 bg-white border border-dark/20 rounded-xl flex items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="font-bold text-dark font-sans">
                        {new Date(r.tgl).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                      </div>
                      <div className="text-dark/60 mt-0.5">
                        Kelas: <strong className="text-dark">{r.kelas}</strong> · Pelatih: {r.pelatih_nama}
                      </div>
                    </div>
                    <Badge color={r.status_hadir === 'hadir' ? 'primary' : r.status_hadir === 'izin' ? 'dark' : r.status_hadir === 'sakit' ? 'secondary' : 'accent'}>
                      {r.status_hadir.toUpperCase()}
                    </Badge>
                  </div>
                ))
              )}
            </div>

            <Button
              variant="secondary"
              onClick={() => setSelectedSiswaDetail(null)}
              className="w-full text-sm py-2.5"
            >
              Tutup
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
