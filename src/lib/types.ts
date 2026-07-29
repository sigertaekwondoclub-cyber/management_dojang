import { createClient } from '@/lib/supabase/client'

// Define shared types for Supabase query results
export interface Profile {
  id: string
  role: 'admin' | 'pelatih' | 'ortu'
  siswa_id: string | null
  pelatih_id: string | null
  nama: string
  created_at: string
}

export interface ProgramKelas {
  id: string
  nama_program: string
  frekuensi_per_minggu: number
  biaya_bulanan: number
  deskripsi: string
  status_aktif: boolean
}

export interface Siswa {
  id: string
  nama: string
  tgl_lahir: string
  tempat_lahir?: string | null
  sabuk_saat_ini: string
  tgl_gabung: string
  no_hp_ortu: string
  berat_badan?: number | null
  alamat?: string | null
  status_aktif: boolean
  foto_url?: string
  no_kartu?: string
  program_kelas_id?: string
  fokus_prestasi?: 'pomsae' | 'kyurugi' | null
  created_at: string
  program_kelas?: {
    nama_program: string
  }
}

export interface Pelatih {
  id: string
  nama: string
  sabuk: string
  no_hp: string
  tgl_gabung: string
  rate_honor_per_sesi: number | null
  status_aktif: boolean
}

export interface PendaftaranSiswa {
  id: string
  nama_calon_siswa: string
  tgl_lahir: string
  tempat_lahir?: string | null
  nama_ortu: string
  no_hp_ortu: string
  program_kelas_id?: string
  fokus_prestasi?: 'pomsae' | 'kyurugi' | null
  berat_badan?: number | null
  sabuk_pendaftaran?: string | null
  alamat?: string | null
  tgl_daftar: string
  status: 'pending' | 'diterima' | 'ditolak'
  catatan_admin?: string
  program_kelas?: {
    nama_program: string
  }
}

export interface AbsensiSiswa {
  id: string
  tgl: string
  siswa_id: string
  kelas: string
  status_hadir: 'hadir' | 'izin' | 'sakit' | 'alpha'
  pelatih_id_pengajar: string
  created_at: string
  siswa?: Pick<Siswa, 'nama'>
  pelatih?: Pick<Pelatih, 'nama'>
}

export interface AbsensiPelatih {
  id: string
  tgl: string
  pelatih_id: string
  kelas: string
  jam_masuk: string
  jam_keluar: string | null
  created_at: string
  pelatih?: Pick<Pelatih, 'nama'>
}

export interface Iuran {
  id: string
  siswa_id: string
  bulan: number
  tahun: number
  nominal: number
  status_bayar: 'belum_bayar' | 'menunggu_verifikasi' | 'lunas' | 'ditolak'
  tgl_bayar: string | null
  metode: string | null
  bukti_transfer_url: string | null
  catatan: string | null
  created_at: string
  siswa?: Pick<Siswa, 'nama' | 'program_kelas_id'>
}

export interface KartuAnggota {
  id: string
  siswa_id: string
  no_kartu: string
  qr_code_value: string
  tgl_cetak: string | null
  status_aktif: boolean
  created_at: string
  siswa?: Pick<Siswa, 'nama' | 'sabuk_saat_ini' | 'foto_url'>
}

export interface PengaturanClub {
  id: string
  // Honor
  persentase_pool_honor: number
  // Identitas Club
  nama_club: string | null
  alamat_dojo: string | null
  kontak_wa: string | null
  kontak_email: string | null
  logo_url: string | null
  // Rekening Utama (Iuran)
  rekening_bank: string | null
  rekening_nomor: string | null
  rekening_atas_nama: string | null
  // Rekening Merchant
  merchant_bank: string | null
  merchant_nomor: string | null
  merchant_atas_nama: string | null
  // Iuran
  iuran_default: number | null
  updated_at: string
}

export interface HonorPelatih {
  id: string
  pelatih_id: string
  bulan: number
  tahun: number
  jumlah_sesi_mengajar: number
  total_sesi_semua_pelatih: number
  total_iuran_terkumpul_bulan: number
  persentase_pool_dipakai: number
  total_pool_honor: number
  honor_diterima: number
  status_dibayar: boolean
  tgl_dibayar: string | null
  created_at: string
  pelatih?: Pick<Pelatih, 'nama'>
}

export interface KeuanganClub {
  id: string
  tgl: string
  jenis: 'income' | 'expense'
  kategori: string
  nominal: number
  keterangan: string
  sumber: string | null
  created_at: string
}

export interface UjianSabuk {
  id: string
  siswa_id: string
  tgl_ujian: string
  sabuk_asal: string
  sabuk_tujuan: string
  hasil: 'lulus' | 'tidak_lulus' | null
  penguji: string
  catatan: string | null
  created_at: string
  siswa?: Pick<Siswa, 'nama'>
}

export interface EventKompetisi {
  id: string
  nama: string
  tgl: string
  lokasi: string
  biaya_pendaftaran: number
  keterangan: string | null
  created_at: string
}

export interface EventPeserta {
  id: string
  event_id: string
  siswa_id: string
  status_daftar: 'terdaftar' | 'batal'
  hasil: string | null
  catatan: string | null
  created_at: string
  siswa?: Pick<Siswa, 'nama' | 'sabuk_saat_ini' | 'program_kelas_id'> & { program_kelas?: { nama_program: string } }
  event_kompetisi?: Pick<EventKompetisi, 'nama' | 'tgl' | 'lokasi'>
}

export type KategoriMerchant = 'Seragam' | 'Aksesoris' | 'Perlengkapan'
export type StatusPesanan = 'menunggu_pembayaran' | 'menunggu_verifikasi' | 'lunas' | 'diproses' | 'siap_diambil'

export interface ProdukMerchant {
  id: string
  nama: string
  kategori: KategoriMerchant
  harga: number
  deskripsi: string | null
  foto_url: string | null
  status_aktif: boolean
  created_at: string
  produk_varian?: ProdukVarian[]
}

export interface ProdukVarian {
  id: string
  produk_id: string
  ukuran: string
  stok: number
  created_at: string
}

export interface PesananMerchant {
  id: string
  siswa_id: string
  total_harga: number
  status: StatusPesanan
  bukti_transfer_url: string | null
  catatan_admin: string | null
  created_at: string
  updated_at: string
  siswa?: Pick<Siswa, 'nama'>
  pesanan_item?: PesananItemWithDetail[]
}

export interface PesananItem {
  id: string
  pesanan_id: string
  produk_id: string
  varian_id: string
  qty: number
  harga_satuan: number
}

export interface PesananItemWithDetail extends PesananItem {
  produk_merchant?: Pick<ProdukMerchant, 'nama' | 'foto_url'>
  produk_varian?: Pick<ProdukVarian, 'ukuran'>
}

export interface KeranjangItem {
  produk: ProdukMerchant
  varian: ProdukVarian
  qty: number
}

export { createClient }
