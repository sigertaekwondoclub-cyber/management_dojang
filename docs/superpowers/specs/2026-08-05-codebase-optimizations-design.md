# Spesifikasi Desain: Optimasi Codebase & Perbaikan Performa

* **Tanggal**: 2026-08-05
* **Topik**: Pembersihan redundansi otentikasi, perbaikan inisialisasi client Supabase, optimasi query N+1 payroll, serta pembersihan aset kode (utility, CSS, types).

---

## 1. Pembersihan Redundansi Otentikasi & Inisialisasi Supabase

### Latar Belakang
Setiap kali route `/admin` diakses, Next.js Middleware sudah melakukan pengecekan token JWT dan query ke tabel `profiles` untuk memvalidasi apakah user tersebut adalah `admin`. Namun, file `AdminLayout` juga melakukan query yang sama persis (`supabase.auth.getUser()` & query profiles). Hal ini membuat loading dashboard terasa lambat (terjadi flash screen "Memuat Dashboard Admin...").
Selain itu, instansi `supabase` di dalam halaman dashboard diinisialisasi di dalam fungsi render komponen, yang berisiko memicu re-creation instansi secara berulang.

### Solusi Desain
1. **Layout Client-Side Auth Bypass**:
   Ubah logic `AdminLayout` di `src/app/admin/layout.tsx` (serta layout `ortu` dan `pelatih` jika memiliki pola serupa) agar langsung melepaskan `loading` dan memperbolehkan akses (`authorized = true`) pada saat komponen terpasang (`mounted`).
   Middleware Next.js tetap menjadi gerbang utama penegakan otorisasi.
2. **Supabase Client Placement**:
   Pindahkan baris `const supabase = createClient()` ke lingkup luar file (modul level scope) pada file `src/app/admin/dashboard/page.tsx`.

---

## 2. Sentralisasi Utilitas Format (utils.ts)

### Latar Belakang
Fungsi `formatRupiah` dideklarasikan ulang di berbagai file, yang tidak efisien dan menyulitkan pemeliharaan jangka panjang.

### Solusi Desain
1. Buat file baru `src/lib/utils.ts`.
2. Pindahkan implementasi format rupiah dan tanggal ke file tersebut:
   ```typescript
   export function formatRupiah(n: number): string {
     return new Intl.NumberFormat('id-ID', {
       style: 'currency',
       currency: 'IDR',
       maximumFractionDigits: 0
     }).format(n)
   }

   export function formatTanggal(s: string, options?: Intl.DateTimeFormatOptions): string {
     return new Date(s).toLocaleDateString('id-ID', options ?? { day: 'numeric', month: 'long', year: 'numeric' })
   }
   ```
3. Lakukan refactoring pada seluruh file halaman admin (`dashboard`, `merchant`, `pesanan`, `honor`) untuk mengimpor fungsi tersebut.

---

## 3. Resolusi Query N+1 di Payroll Generator

### Latar Belakang
Server Action `generatePayroll` di `src/app/admin/honor/actions.ts` melakukan query di dalam iterasi program kelas (untuk menghitung siswa aktif dan menghitung absensi sesi mengajar) serta di dalam iterasi data pelatih. Hal ini berpotensi memicu belasan round-trip query database yang lambat.

### Solusi Desain
1. **Bulk Fetching Siswa Aktif**:
   Query seluruh jumlah siswa aktif yang memiliki `program_kelas_id` dalam satu query:
   ```typescript
   const { data: studentCounts } = await supabaseAdmin
     .from('siswa')
     .select('program_kelas_id')
     .eq('status_aktif', true)
   ```
   Lahu hitung jumlah per kelas menggunakan pemrosesan array JavaScript di memory.
2. **Bulk Fetching Sesi Mengajar**:
   Tarik data absensi pelatih untuk bulan berjalan menggunakan filter rentang tanggal dalam satu query tunggal.
   Filter dengan `.gte('tgl', startDate)` and `.lte('tgl', endDate)`.
   Gunakan struktur data map / dictionary di memory untuk mengelompokkan jumlah sesi berdasarkan `program_kelas_id` dan `pelatih_id`.

---

## 4. Perbaikan Edit Varian Merchant & Loading State

### Latar Belakang
Saat ini, proses edit varian produk merchant menghapus semua baris varian lama menggunakan `.delete().eq('produk_id', editId)` lalu menyisipkan kembali (*re-insert*). Jika ID varian lama tersebut dirujuk oleh tabel pesanan/item pesanan, referensi relasional akan terputus atau terhapus (karena `ON DELETE CASCADE`).

### Solusi Desain
1. **Upsert Logic untuk Varian**:
   Daripada menghapus semua varian, kita akan:
   - Mengidentifikasi varian mana saja yang dikirimkan dari form.
   - Melakukan `upsert` pada varian yang memiliki ID atau kombinasi ukuran yang sama.
   - Menghapus varian yang ada di database tetapi tidak lagi dikirimkan oleh form (deteksi penghapusan manual oleh user).
2. **Loading States**:
   Tambahkan penanganan status disable/loading ketika admin menekan tombol "Nonaktifkan / Aktifkan" pada produk merchant.

---

## 5. Pembersihan CSS & Types

### Latar Belakang
Pembersihan kecil untuk menjaga integritas file kode agar tidak memicu warning compiler / linter.

### Solusi Desain
1. Ganti property `min-h-screen: 100vh;` di `src/app/globals.css` dengan standar CSS: `min-height: 100vh;`.
2. Hapus baris `import { createClient } ...` dan `export { createClient }` di file `src/lib/types.ts`.

---

## Rencana Verification
* **Automated Tests**: Jalankan `npm run lint` dan `npm run build` untuk memastikan tidak ada error kompilasi TypeScript atau CSS.
* **Manual Verification**:
  - Login dengan akun admin, pelatih, dan ortu untuk memastikan bypass layout loading flash berjalan sempurna dan middleware tetap menghalangi jika role tidak cocok.
  - Jalankan simulasi payroll untuk memastikan kalkulasi honor tetap akurat tetapi dengan query database yang jauh lebih sedikit.
  - Lakukan edit produk merchant (ubah stok/tambah varian) lalu periksa apakah item varian lama yang terhubung dengan transaksi lama tidak ikut terhapus di database.
