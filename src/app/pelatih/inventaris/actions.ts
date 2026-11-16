'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import type {
  InventarisBarang,
  InventarisPeminjaman,
  InventarisPengajuan,
  KategoriInventaris,
} from '@/lib/types'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Mengambil data inventaris untuk portal pelatih:
 * - Master barang (untuk cek ketersediaan alat siap pakai)
 * - Riwayat peminjaman milik pelatih yang sedang login
 * - Riwayat pengajuan usulan alat milik pelatih yang sedang login
 */
export async function getPelatihInventarisData(pelatihId?: string | null) {
  try {
    // 1. Ambil master barang
    const { data: barang, error: bErr } = await supabaseAdmin
      .from('inventaris_barang')
      .select('*')
      .order('nama_barang', { ascending: true })

    if (bErr) throw new Error('Gagal mengambil katalog alat: ' + bErr.message)

    // 2. Ambil peminjaman milik pelatih
    let peminjamanQuery = supabaseAdmin
      .from('inventaris_peminjaman')
      .select('*, inventaris_barang(nama_barang, kode_barang, kategori)')
      .order('created_at', { ascending: false })

    if (pelatihId) {
      peminjamanQuery = peminjamanQuery.eq('pelatih_id', pelatihId)
    }

    const { data: peminjaman, error: pErr } = await peminjamanQuery
    if (pErr) throw new Error('Gagal mengambil riwayat peminjaman: ' + pErr.message)

    // 3. Ambil pengajuan milik pelatih
    let pengajuanQuery = supabaseAdmin
      .from('inventaris_pengajuan')
      .select('*')
      .order('created_at', { ascending: false })

    if (pelatihId) {
      pengajuanQuery = pengajuanQuery.eq('pelatih_id', pelatihId)
    }

    const { data: pengajuan, error: gErr } = await pengajuanQuery
    if (gErr) throw new Error('Gagal mengambil daftar usulan: ' + gErr.message)

    return {
      success: true,
      data: {
        barang: (barang || []) as InventarisBarang[],
        peminjaman: (peminjaman || []) as InventarisPeminjaman[],
        pengajuan: (pengajuan || []) as InventarisPengajuan[],
      },
    }
  } catch (err: any) {
    console.error('getPelatihInventarisData error:', err)
    return {
      success: false,
      error: err.message || 'Gagal memuat data inventaris pelatih',
      message: err.message || 'Gagal memuat data inventaris pelatih',
      data: {
        barang: [] as InventarisBarang[],
        peminjaman: [] as InventarisPeminjaman[],
        pengajuan: [] as InventarisPengajuan[],
      },
    }
  }
}

export interface AjukanPinjamPelatihInput {
  barang_id: string
  pelatih_id: string
  nama_peminjam: string
  jumlah: number
  tgl_pinjam: string
  tgl_rencana_kembali: string
  keperluan: string
}

/**
 * Pelatih meminjam alat latihan untuk keperluan latihan luar atau kejuaraan
 */
export async function ajukanPinjamPelatih(data: AjukanPinjamPelatihInput) {
  try {
    if (!data.barang_id) throw new Error('Pilih alat yang ingin dipinjam')
    if (!data.pelatih_id) throw new Error('Identitas pelatih tidak valid')
    if (!data.tgl_pinjam || !data.tgl_rencana_kembali) throw new Error('Tanggal pinjam dan batas kembali wajib diisi')
    if (!data.keperluan || !data.keperluan.trim()) throw new Error('Keperluan peminjaman wajib diisi')

    const jumlah = parseInt(String(data.jumlah), 10)
    if (isNaN(jumlah) || jumlah <= 0) {
      throw new Error('Jumlah yang dipinjam harus minimal 1 unit')
    }

    // Cek stok fisik yang tersedia
    const { data: barang, error: bErr } = await supabaseAdmin
      .from('inventaris_barang')
      .select('id, nama_barang, kondisi_baik, kondisi_rusak_ringan, stok_dipinjam')
      .eq('id', data.barang_id)
      .single()

    if (bErr || !barang) {
      throw new Error('Data alat tidak ditemukan')
    }

    const stokTersedia = (barang.kondisi_baik + barang.kondisi_rusak_ringan) - (barang.stok_dipinjam || 0)
    if (jumlah > stokTersedia) {
      throw new Error(
        `Stok alat tidak mencukupi untuk dipinjam. Tersedia saat ini hanya ${stokTersedia} unit.`
      )
    }

    // 1. Naikkan stok_dipinjam
    const { error: uErr } = await supabaseAdmin
      .from('inventaris_barang')
      .update({
        stok_dipinjam: (barang.stok_dipinjam || 0) + jumlah,
        updated_at: new Date().toISOString(),
      })
      .eq('id', data.barang_id)

    if (uErr) {
      throw new Error('Gagal memperbarui stok pinjam alat: ' + uErr.message)
    }

    // 2. Insert ke inventaris_peminjaman
    const { data: pinjam, error: iErr } = await supabaseAdmin
      .from('inventaris_peminjaman')
      .insert({
        barang_id: data.barang_id,
        pelatih_id: data.pelatih_id,
        nama_peminjam: data.nama_peminjam.trim(),
        jumlah,
        tgl_pinjam: data.tgl_pinjam,
        tgl_rencana_kembali: data.tgl_rencana_kembali,
        keperluan: data.keperluan.trim(),
        status: 'dipinjam',
      })
      .select()
      .single()

    if (iErr) {
      // Rollback stok_dipinjam
      await supabaseAdmin
        .from('inventaris_barang')
        .update({ stok_dipinjam: barang.stok_dipinjam })
        .eq('id', data.barang_id)

      throw new Error('Gagal mencatat peminjaman: ' + iErr.message)
    }

    revalidatePath('/pelatih/inventaris')
    revalidatePath('/admin/inventaris')

    return {
      success: true,
      message: 'Peminjaman alat berhasil dicatat',
      data: pinjam as InventarisPeminjaman,
    }
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Gagal meminjam alat',
      message: err.message || 'Gagal meminjam alat',
    }
  }
}

export interface AjukanKebutuhanAlatInput {
  pelatih_id: string
  nama_barang: string
  kategori: KategoriInventaris
  jumlah: number
  estimasi_harga?: number
  alasan: string
}

/**
 * Pelatih mengusulkan pengadaan alat baru untuk kebutuhan latihan dojang
 */
export async function ajukanKebutuhanAlat(data: AjukanKebutuhanAlatInput) {
  try {
    if (!data.pelatih_id) throw new Error('Identitas pelatih tidak valid')
    if (!data.nama_barang || !data.nama_barang.trim()) throw new Error('Nama alat wajib diisi')
    if (!data.alasan || !data.alasan.trim()) throw new Error('Alasan kebutuhan wajib diisi')

    const jumlah = parseInt(String(data.jumlah), 10)
    if (isNaN(jumlah) || jumlah <= 0) {
      throw new Error('Jumlah yang diusulkan minimal 1 unit')
    }

    const estimasiHarga = data.estimasi_harga ? parseFloat(String(data.estimasi_harga)) : 0

    const { data: pengajuan, error } = await supabaseAdmin
      .from('inventaris_pengajuan')
      .insert({
        pelatih_id: data.pelatih_id,
        nama_barang: data.nama_barang.trim(),
        kategori: data.kategori || 'Target & Kicking',
        jumlah,
        estimasi_harga: estimasiHarga >= 0 ? estimasiHarga : 0,
        alasan: data.alasan.trim(),
        status: 'menunggu',
      })
      .select()
      .single()

    if (error) {
      throw new Error('Gagal menyimpan usulan alat: ' + error.message)
    }

    revalidatePath('/pelatih/inventaris')
    revalidatePath('/admin/inventaris')

    return {
      success: true,
      message: 'Usulan pengadaan alat berhasil dikirimkan ke Admin Club',
      data: pengajuan as InventarisPengajuan,
    }
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Gagal mengirim usulan alat',
      message: err.message || 'Gagal mengirim usulan alat',
    }
  }
}
