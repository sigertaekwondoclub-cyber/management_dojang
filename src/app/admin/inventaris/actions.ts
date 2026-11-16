'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import type {
  KategoriInventaris,
  InventarisBarang,
  InventarisPembelian,
  InventarisPeminjaman,
  InventarisPengajuan,
  Pelatih,
} from '@/lib/types'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Generate kode barang unik, contoh: INV-TAR-4819
 */
function generateKodeBarang(nama: string): string {
  const clean = (nama || 'ITM').replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
  const prefix = (clean.slice(0, 3) || 'ITM').padEnd(3, 'X')
  const randomNum = Math.floor(1000 + Math.random() * 9000)
  return `INV-${prefix}-${randomNum}`
}

export interface TambahBarangInput {
  nama_barang: string
  kategori: KategoriInventaris
  kondisi_baik: number
  kondisi_rusak_ringan?: number
  kondisi_rusak_berat?: number
  lokasi_penyimpanan?: string
  keterangan?: string | null
}

export interface UpdateKondisiInput {
  kondisi_baik: number
  kondisi_rusak_ringan: number
  kondisi_rusak_berat: number
  lokasi_penyimpanan?: string
  keterangan?: string | null
}

export interface CatatPembelianInput {
  barang_id?: string | null
  nama_barang: string
  kategori: KategoriInventaris
  tgl_beli: string
  jumlah: number
  harga_satuan: number
  toko_vendor?: string | null
  catat_ke_kas?: boolean
  lokasi_penyimpanan?: string
  created_by?: string | null
}

export interface CatatPeminjamanInput {
  barang_id: string
  pelatih_id?: string | null
  nama_peminjam: string
  jumlah: number
  tgl_pinjam: string
  tgl_rencana_kembali: string
  keperluan: string
  created_by?: string | null
}

export interface KembalikanPeminjamanOptions {
  catatan_kondisi_kembali?: string | null
  rusak_ringan_tambah?: number
  rusak_berat_tambah?: number
}

/**
 * Mengambil semua data inventaris untuk Admin:
 * - Master barang
 * - Log pembelian
 * - Sirkulasi peminjaman
 * - Pengajuan dari pelatih
 * - Daftar pelatih aktif
 */
export async function getAdminInventarisData() {
  try {
    const today = new Date().toISOString().split('T')[0]

    // Otomatis tandai peminjaman yang melewati tanggal rencana kembali sebagai 'terlambat'
    await supabaseAdmin
      .from('inventaris_peminjaman')
      .update({ status: 'terlambat' })
      .eq('status', 'dipinjam')
      .lt('tgl_rencana_kembali', today)

    // 1. Master Barang
    const { data: barang, error: errBarang } = await supabaseAdmin
      .from('inventaris_barang')
      .select('*')
      .order('nama_barang', { ascending: true })

    if (errBarang) throw errBarang

    // 2. Log Pembelian
    const { data: pembelian, error: errPembelian } = await supabaseAdmin
      .from('inventaris_pembelian')
      .select('*, inventaris_barang(nama_barang)')
      .order('tgl_beli', { ascending: false })
      .order('created_at', { ascending: false })

    if (errPembelian) throw errPembelian

    // 3. Peminjaman
    const { data: peminjaman, error: errPeminjaman } = await supabaseAdmin
      .from('inventaris_peminjaman')
      .select('*, inventaris_barang(nama_barang, kode_barang)')
      .order('created_at', { ascending: false })

    if (errPeminjaman) throw errPeminjaman

    // 4. Pengajuan Pelatih
    const { data: pengajuan, error: errPengajuan } = await supabaseAdmin
      .from('inventaris_pengajuan')
      .select('*, pelatih(nama)')
      .order('created_at', { ascending: false })

    if (errPengajuan) throw errPengajuan

    // 5. Daftar Pelatih Aktif
    const { data: pelatihList, error: errPelatih } = await supabaseAdmin
      .from('pelatih')
      .select('id, nama, role, is_founder, sabuk, no_hp, tgl_gabung, rate_honor_per_sesi, status_aktif')
      .eq('status_aktif', true)
      .order('nama', { ascending: true })

    if (errPelatih) throw errPelatih

    return {
      success: true,
      data: {
        barang: (barang || []) as InventarisBarang[],
        pembelian: (pembelian || []) as InventarisPembelian[],
        peminjaman: (peminjaman || []) as InventarisPeminjaman[],
        pengajuan: (pengajuan || []) as InventarisPengajuan[],
        pelatihList: (pelatihList || []) as Pelatih[],
      },
    }
  } catch (err: any) {
    console.error('getAdminInventarisData error:', err)
    return {
      success: false,
      error: err.message || 'Gagal memuat data inventaris',
      data: {
        barang: [] as InventarisBarang[],
        pembelian: [] as InventarisPembelian[],
        peminjaman: [] as InventarisPeminjaman[],
        pengajuan: [] as InventarisPengajuan[],
        pelatihList: [] as Pelatih[],
      },
    }
  }
}

/**
 * Menambahkan master barang baru ke inventaris_barang
 */
export async function tambahBarangMaster(data: TambahBarangInput) {
  try {
    if (!data.nama_barang || !data.nama_barang.trim()) {
      throw new Error('Nama barang wajib diisi')
    }
    if (!data.kategori) {
      throw new Error('Kategori barang wajib dipilih')
    }

    const kondisiBaik = Math.max(0, Number(data.kondisi_baik || 0))
    const kondisiRusakRingan = Math.max(0, Number(data.kondisi_rusak_ringan || 0))
    const kondisiRusakBerat = Math.max(0, Number(data.kondisi_rusak_berat || 0))

    const kodeBarang = generateKodeBarang(data.nama_barang)

    const { data: newBarang, error } = await supabaseAdmin
      .from('inventaris_barang')
      .insert({
        kode_barang: kodeBarang,
        nama_barang: data.nama_barang.trim(),
        kategori: data.kategori,
        kondisi_baik: kondisiBaik,
        kondisi_rusak_ringan: kondisiRusakRingan,
        kondisi_rusak_berat: kondisiRusakBerat,
        stok_dipinjam: 0,
        lokasi_penyimpanan: data.lokasi_penyimpanan?.trim() || 'Dojang Utama',
        keterangan: data.keterangan?.trim() || null,
      })
      .select()
      .single()

    if (error) {
      throw new Error('Gagal menambahkan barang master: ' + error.message)
    }

    revalidatePath('/admin/inventaris')
    revalidatePath('/pelatih/inventaris')

    return {
      success: true,
      message: 'Barang master berhasil ditambahkan',
      data: newBarang as InventarisBarang,
    }
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Gagal menambahkan barang master',
    }
  }
}

/**
 * Memperbarui kondisi fisik barang (kondisi_baik, kondisi_rusak_ringan, kondisi_rusak_berat, lokasi, keterangan)
 */
export async function updateKondisiBarang(id: string, data: UpdateKondisiInput) {
  try {
    if (!id) throw new Error('ID barang tidak valid')

    const kondisiBaik = Number(data.kondisi_baik ?? 0)
    const kondisiRusakRingan = Number(data.kondisi_rusak_ringan ?? 0)
    const kondisiRusakBerat = Number(data.kondisi_rusak_berat ?? 0)

    if (kondisiBaik < 0 || kondisiRusakRingan < 0 || kondisiRusakBerat < 0) {
      throw new Error('Jumlah kondisi barang tidak boleh bernilai negatif')
    }

    // Ambil data sekarang untuk validasi unit dipinjam
    const { data: curr, error: cErr } = await supabaseAdmin
      .from('inventaris_barang')
      .select('*')
      .eq('id', id)
      .single()

    if (cErr || !curr) {
      throw new Error('Barang tidak ditemukan')
    }

    const totalBaru = kondisiBaik + kondisiRusakRingan + kondisiRusakBerat
    if (totalBaru < curr.stok_dipinjam) {
      throw new Error(
        `Total stok baru (${totalBaru}) tidak boleh lebih kecil dari unit yang sedang dipinjam (${curr.stok_dipinjam})`
      )
    }

    const { data: updated, error } = await supabaseAdmin
      .from('inventaris_barang')
      .update({
        kondisi_baik: kondisiBaik,
        kondisi_rusak_ringan: kondisiRusakRingan,
        kondisi_rusak_berat: kondisiRusakBerat,
        lokasi_penyimpanan: data.lokasi_penyimpanan?.trim() || curr.lokasi_penyimpanan,
        keterangan: data.keterangan !== undefined ? data.keterangan?.trim() || null : curr.keterangan,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      throw new Error('Gagal memperbarui kondisi barang: ' + error.message)
    }

    revalidatePath('/admin/inventaris')
    revalidatePath('/pelatih/inventaris')

    return {
      success: true,
      message: 'Kondisi barang berhasil diperbarui',
      data: updated as InventarisBarang,
    }
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Gagal memperbarui kondisi barang',
    }
  }
}

/**
 * Mencatat pengadaan/pembelian baru.
 * - Jika memilih barang master ada: menambah kondisi_baik.
 * - Jika barang master baru: membuat entri inventaris_barang baru.
 * - Jika catat_ke_kas = true: memasukkan pengeluaran ke keuangan_club.
 * - Menyimpan log ke inventaris_pembelian.
 */
export async function catatPembelianBaru(data: CatatPembelianInput) {
  try {
    const jumlah = parseInt(String(data.jumlah), 10)
    if (isNaN(jumlah) || jumlah <= 0) {
      throw new Error('Jumlah pembelian harus lebih dari 0')
    }

    const hargaSatuan = parseFloat(String(data.harga_satuan))
    if (isNaN(hargaSatuan) || hargaSatuan < 0) {
      throw new Error('Harga satuan tidak boleh negatif')
    }

    if (!data.nama_barang || !data.nama_barang.trim()) {
      throw new Error('Nama barang wajib diisi')
    }
    if (!data.tgl_beli) {
      throw new Error('Tanggal pembelian wajib diisi')
    }

    const totalBiaya = jumlah * hargaSatuan
    let finalBarangId = data.barang_id || null

    // 1. Update / Buat master inventaris_barang
    if (finalBarangId) {
      const { data: existing, error: eErr } = await supabaseAdmin
        .from('inventaris_barang')
        .select('id, kondisi_baik')
        .eq('id', finalBarangId)
        .single()

      if (eErr || !existing) {
        throw new Error('Barang master yang dipilih tidak ditemukan')
      }

      const { error: uErr } = await supabaseAdmin
        .from('inventaris_barang')
        .update({
          kondisi_baik: existing.kondisi_baik + jumlah,
          updated_at: new Date().toISOString(),
        })
        .eq('id', finalBarangId)

      if (uErr) {
        throw new Error('Gagal memperbarui stok master barang: ' + uErr.message)
      }
    } else {
      const kode = generateKodeBarang(data.nama_barang)
      const { data: newB, error: nErr } = await supabaseAdmin
        .from('inventaris_barang')
        .insert({
          kode_barang: kode,
          nama_barang: data.nama_barang.trim(),
          kategori: data.kategori,
          kondisi_baik: jumlah,
          kondisi_rusak_ringan: 0,
          kondisi_rusak_berat: 0,
          stok_dipinjam: 0,
          lokasi_penyimpanan: data.lokasi_penyimpanan?.trim() || 'Dojang Utama',
          keterangan: 'Ditambahkan via pembelian baru',
        })
        .select('id')
        .single()

      if (nErr || !newB) {
        throw new Error('Gagal membuat master barang baru: ' + (nErr?.message || ''))
      }
      finalBarangId = newB.id
    }

    // 2. Jika catat_ke_kas, catat pengeluaran ke keuangan_club
    let keuanganId: string | null = null
    if (data.catat_ke_kas) {
      const { data: kas, error: kasErr } = await supabaseAdmin
        .from('keuangan_club')
        .insert({
          tgl: data.tgl_beli,
          jenis: 'expense',
          kategori: 'Pengadaan Alat & Inventaris',
          nominal: totalBiaya,
          keterangan: `Pengadaan Inventaris: ${data.nama_barang.trim()} (${jumlah} unit) — Vendor: ${data.toko_vendor?.trim() || '-'}`,
          sumber: data.toko_vendor?.trim() || 'inventaris',
        })
        .select('id')
        .single()

      if (kasErr || !kas) {
        throw new Error('Gagal mencatat pengeluaran kas: ' + (kasErr?.message || ''))
      }
      keuanganId = kas.id
    }

    // 3. Masukkan ke log inventaris_pembelian
    const { data: pembelian, error: pErr } = await supabaseAdmin
      .from('inventaris_pembelian')
      .insert({
        barang_id: finalBarangId,
        nama_barang: data.nama_barang.trim(),
        kategori: data.kategori,
        tgl_beli: data.tgl_beli,
        jumlah: jumlah,
        harga_satuan: hargaSatuan,
        total_biaya: totalBiaya,
        toko_vendor: data.toko_vendor?.trim() || null,
        catat_ke_kas: !!data.catat_ke_kas,
        keuangan_id: keuanganId,
        created_by: data.created_by || null,
      })
      .select()
      .single()

    if (pErr) {
      throw new Error('Gagal mencatat log pembelian: ' + pErr.message)
    }

    revalidatePath('/admin/inventaris')
    revalidatePath('/pelatih/inventaris')
    if (data.catat_ke_kas) {
      revalidatePath('/admin/keuangan')
    }

    return {
      success: true,
      message: 'Pembelian berhasil dicatat dan stok telah diperbarui',
      data: pembelian as InventarisPembelian,
    }
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Gagal mencatat pembelian',
    }
  }
}

/**
 * Menghapus catatan pembelian:
 * - Mengurangi stok barang master terkait
 * - Menghapus catatan pengeluaran di keuangan_club jika ada
 * - Menghapus baris inventaris_pembelian
 */
export async function hapusPembelian(id: string) {
  try {
    if (!id) throw new Error('ID pembelian tidak valid')

    const { data: pembelian, error: fErr } = await supabaseAdmin
      .from('inventaris_pembelian')
      .select('*')
      .eq('id', id)
      .single()

    if (fErr || !pembelian) {
      throw new Error('Data pembelian tidak ditemukan')
    }

    // 1. Kurangi stok barang terkait jika barang_id masih ada
    if (pembelian.barang_id) {
      const { data: barang } = await supabaseAdmin
        .from('inventaris_barang')
        .select('id, kondisi_baik')
        .eq('id', pembelian.barang_id)
        .single()

      if (barang) {
        const newKondisi = Math.max(0, barang.kondisi_baik - pembelian.jumlah)
        await supabaseAdmin
          .from('inventaris_barang')
          .update({
            kondisi_baik: newKondisi,
            updated_at: new Date().toISOString(),
          })
          .eq('id', barang.id)
      }
    }

    // 2. Hapus catatan kas jika ada
    if (pembelian.keuangan_id) {
      await supabaseAdmin
        .from('keuangan_club')
        .delete()
        .eq('id', pembelian.keuangan_id)
    }

    // 3. Hapus catatan pembelian
    const { error: dErr } = await supabaseAdmin
      .from('inventaris_pembelian')
      .delete()
      .eq('id', id)

    if (dErr) {
      throw new Error('Gagal menghapus catatan pembelian: ' + dErr.message)
    }

    revalidatePath('/admin/inventaris')
    revalidatePath('/pelatih/inventaris')
    if (pembelian.keuangan_id) {
      revalidatePath('/admin/keuangan')
    }

    return {
      success: true,
      message: 'Data pembelian berhasil dihapus dan kas telah disinkronkan',
    }
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Gagal menghapus data pembelian',
    }
  }
}

/**
 * Mencatat peminjaman alat oleh Admin.
 * Memvalidasi ketersediaan stok ((kondisi_baik + kondisi_rusak_ringan) - stok_dipinjam >= jumlah).
 * Menambah stok_dipinjam di master barang.
 */
export async function catatPeminjamanAdmin(data: CatatPeminjamanInput) {
  try {
    if (!data.barang_id) throw new Error('Pilih alat yang ingin dipinjam')
    if (!data.nama_peminjam || !data.nama_peminjam.trim()) {
      throw new Error('Nama peminjam wajib diisi')
    }

    const jumlah = parseInt(String(data.jumlah), 10)
    if (isNaN(jumlah) || jumlah <= 0) {
      throw new Error('Jumlah peminjaman harus lebih dari 0')
    }

    if (!data.tgl_pinjam) throw new Error('Tanggal pinjam wajib diisi')
    if (!data.tgl_rencana_kembali) throw new Error('Tanggal rencana kembali wajib diisi')
    if (!data.keperluan || !data.keperluan.trim()) {
      throw new Error('Keperluan peminjaman wajib diisi')
    }

    // 1. Cek stok alat
    const { data: barang, error: bErr } = await supabaseAdmin
      .from('inventaris_barang')
      .select('*')
      .eq('id', data.barang_id)
      .single()

    if (bErr || !barang) throw new Error('Barang tidak ditemukan')

    const stokTersedia = (barang.kondisi_baik + barang.kondisi_rusak_ringan) - barang.stok_dipinjam
    if (jumlah > stokTersedia) {
      throw new Error(`Stok alat tidak mencukupi untuk dipinjam (Tersedia: ${Math.max(0, stokTersedia)} unit)`)
    }

    // 2. Update stok_dipinjam di inventaris_barang
    const { error: upErr } = await supabaseAdmin
      .from('inventaris_barang')
      .update({
        stok_dipinjam: barang.stok_dipinjam + jumlah,
        updated_at: new Date().toISOString(),
      })
      .eq('id', barang.id)

    if (upErr) {
      throw new Error('Gagal memperbarui stok pinjam barang: ' + upErr.message)
    }

    // 3. Masukkan ke tabel inventaris_peminjaman
    const { data: peminjaman, error: pinjamErr } = await supabaseAdmin
      .from('inventaris_peminjaman')
      .insert({
        barang_id: data.barang_id,
        pelatih_id: data.pelatih_id || null,
        nama_peminjam: data.nama_peminjam.trim(),
        jumlah: jumlah,
        tgl_pinjam: data.tgl_pinjam,
        tgl_rencana_kembali: data.tgl_rencana_kembali,
        keperluan: data.keperluan.trim(),
        status: 'dipinjam',
        created_by: data.created_by || null,
      })
      .select()
      .single()

    if (pinjamErr) {
      // Rollback stok_dipinjam
      await supabaseAdmin
        .from('inventaris_barang')
        .update({ stok_dipinjam: barang.stok_dipinjam })
        .eq('id', barang.id)
      throw new Error('Gagal mencatat peminjaman: ' + pinjamErr.message)
    }

    revalidatePath('/admin/inventaris')
    revalidatePath('/pelatih/inventaris')

    return {
      success: true,
      message: 'Peminjaman berhasil dicatat',
      data: peminjaman as InventarisPeminjaman,
    }
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Gagal mencatat peminjaman',
    }
  }
}

/**
 * Mengembalikan alat peminjaman:
 * - Update status peminjaman menjadi 'kembali' dan tgl_kembali = today
 * - Mengurangi stok_dipinjam di master barang
 * - Jika ada kerusakan baru (rusak_ringan / rusak_berat), sesuaikan rasio kondisi_baik ke rusak
 */
export async function kembalikanPeminjaman(
  id: string,
  options?: KembalikanPeminjamanOptions
) {
  try {
    if (!id) throw new Error('ID peminjaman tidak valid')

    // 1. Ambil data peminjaman
    const { data: peminjaman, error: fErr } = await supabaseAdmin
      .from('inventaris_peminjaman')
      .select('*')
      .eq('id', id)
      .single()

    if (fErr || !peminjaman) {
      throw new Error('Data peminjaman tidak ditemukan')
    }

    if (peminjaman.status === 'kembali') {
      throw new Error('Alat untuk peminjaman ini sudah tercatat dikembalikan')
    }

    // 2. Ambil data barang
    const { data: barang, error: bErr } = await supabaseAdmin
      .from('inventaris_barang')
      .select('*')
      .eq('id', peminjaman.barang_id)
      .single()

    if (bErr || !barang) {
      throw new Error('Data master barang tidak ditemukan')
    }

    const rusakRingan = Math.max(0, Number(options?.rusak_ringan_tambah || 0))
    const rusakBerat = Math.max(0, Number(options?.rusak_berat_tambah || 0))
    const totalRusakBaru = rusakRingan + rusakBerat

    if (totalRusakBaru > peminjaman.jumlah) {
      throw new Error(
        `Total unit rusak baru (${totalRusakBaru}) tidak boleh melebihi jumlah unit yang dipinjam (${peminjaman.jumlah})`
      )
    }

    // 3. Perhitungan penyesuaian kondisi fisik & stok dipinjam
    const newStokDipinjam = Math.max(0, barang.stok_dipinjam - peminjaman.jumlah)
    const newKondisiBaik = Math.max(0, barang.kondisi_baik - totalRusakBaru)
    const newKondisiRusakRingan = barang.kondisi_rusak_ringan + rusakRingan
    const newKondisiRusakBerat = barang.kondisi_rusak_berat + rusakBerat

    const { error: bUpErr } = await supabaseAdmin
      .from('inventaris_barang')
      .update({
        stok_dipinjam: newStokDipinjam,
        kondisi_baik: newKondisiBaik,
        kondisi_rusak_ringan: newKondisiRusakRingan,
        kondisi_rusak_berat: newKondisiRusakBerat,
        updated_at: new Date().toISOString(),
      })
      .eq('id', barang.id)

    if (bUpErr) {
      throw new Error('Gagal memperbarui stok barang saat pengembalian: ' + bUpErr.message)
    }

    // 4. Update data peminjaman
    const today = new Date().toISOString().split('T')[0]
    const { data: updatedPinjam, error: pUpErr } = await supabaseAdmin
      .from('inventaris_peminjaman')
      .update({
        status: 'kembali',
        tgl_kembali: today,
        catatan_kondisi_kembali: options?.catatan_kondisi_kembali?.trim() || null,
      })
      .eq('id', id)
      .select()
      .single()

    if (pUpErr) {
      throw new Error('Gagal memperbarui status peminjaman: ' + pUpErr.message)
    }

    revalidatePath('/admin/inventaris')
    revalidatePath('/pelatih/inventaris')

    return {
      success: true,
      message: 'Alat berhasil dikembalikan ke inventaris',
      data: updatedPinjam as InventarisPeminjaman,
    }
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Gagal memproses pengembalian alat',
    }
  }
}

/**
 * Memperbarui status usulan pengajuan alat oleh Pelatih (disetujui / ditolak)
 */
export async function updateStatusPengajuan(
  id: string,
  status: 'menunggu' | 'disetujui' | 'ditolak',
  catatan_admin?: string | null
) {
  try {
    if (!id) throw new Error('ID pengajuan tidak valid')
    if (!['menunggu', 'disetujui', 'ditolak'].includes(status)) {
      throw new Error('Status pengajuan tidak valid')
    }

    const { data: updated, error } = await supabaseAdmin
      .from('inventaris_pengajuan')
      .update({
        status: status,
        catatan_admin: catatan_admin !== undefined ? catatan_admin?.trim() || null : undefined,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      throw new Error('Gagal memperbarui status pengajuan: ' + error.message)
    }

    revalidatePath('/admin/inventaris')
    revalidatePath('/pelatih/inventaris')

    return {
      success: true,
      message: `Pengajuan berhasil diubah menjadi ${status}`,
      data: updated as InventarisPengajuan,
    }
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Gagal memperbarui status pengajuan',
    }
  }
}
