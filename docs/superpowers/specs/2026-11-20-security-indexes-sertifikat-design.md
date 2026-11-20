# Desain Spesifikasi: Peningkatan Keamanan, Indeks DB, dan No Registrasi Sertifikat Ujian Sabuk

**Tanggal:** 2026-11-20  
**Status:** Disetujui  
**Aplikasi:** Siger Taekwondo Club Manager (`siger-tkd-manager`)

---

## 1. Latar Belakang & Tujuan

Berdasarkan audit komprehensif sistem Siger Taekwondo Club Manager, ditemukan beberapa area kritis yang perlu diperkuat untuk keamanan dan keandalan sistem jangka panjang, serta penambahan fitur nomor registrasi sertifikat kenaikan sabuk yang permanen sejak sabuk kuning.

### Sasaran Utama:
1. **Keamanan Server Actions & Checkout**:
   - Menambahkan auth guard terpusat (`requireAdmin`, `requirePelatih`, `requireOrtu`) pada semua Server Actions yang menggunakan `supabaseAdmin` (Service Role Key).
   - Menghilangkan celah *Price Tampering* pada `checkoutMerchantAction` dengan menghitung ulang harga produk dari tabel `produk_merchant` di server.
   - Mencegah celah IDOR (Insecure Direct Object Reference) dengan memvalidasi bahwa siswa yang di-checkout memang anak dari orang tua yang sedang login.
   - Validasi berkas upload bukti transfer (MIME-type whitelist dan batas maksimal 5 MB).
2. **Indeks Komposit Database (Migrasi 031)**:
   - Menambahkan indeks pada tabel `absensi_siswa`, `iuran`, `keuangan_club`, `siswa`, dan `profiles` untuk menghilangkan *sequential table scan* pada query rutin.
3. **No Registrasi Sertifikat Kenaikan Sabuk (Migrasi 032 & UI)**:
   - Menyediakan penyimpanan `no_reg_sertifikat` di tabel `siswa` (permanen seumur atlet di klub) dan tabel `ujian_sabuk`.
   - Form penilaian ujian sabuk mewajibkan/menyediakan input nomor registrasi saat siswa naik dari **Putih ke Kuning** (atau jika siswa belum memiliki nomor registrasi).
   - Saat siswa lulus, nomor registrasi tersimpan di profil `siswa.no_reg_sertifikat`.
   - Untuk ujian sabuk selanjutnya (Kuning ke Hijau, dst.), form otomatis menampilkan nomor registrasi yang sudah tersimpan dalam keadaan terkunci (*read-only*), menjamin konsistensi nomor registrasi.
   - Menampilkan nomor registrasi di data siswa dan detail ujian.

---

## 2. Arsitektur & Desain Rinci

### A. Auth Guard Server Actions Terpusat (`src/lib/auth-guard.ts`)
Fungsi helper yang memverifikasi sesi aktif via cookie session `createClient()` (server) dan mengecek peran pengguna (`profiles.role`) menggunakan `supabaseAdmin`.

```typescript
export interface AuthUserContext {
  user: User
  profile: Profile
}

export async function requireUser(): Promise<AuthUserContext>
export async function requireAdmin(): Promise<AuthUserContext>
export async function requirePelatih(): Promise<AuthUserContext>
export async function requireOrtu(): Promise<AuthUserContext>
```

Setiap Server Action di:
- `src/app/admin/akun/actions.ts`
- `src/app/admin/honor/actions.ts`
- `src/app/admin/keuangan/actions.ts`
- `src/app/admin/inventaris/actions.ts`
- `src/app/pelatih/inventaris/actions.ts`
- `src/app/ortu/merchant/actions.ts`
akan memanggil guard yang sesuai sebelum menjalankan operasi sensitif.

### B. Proteksi Checkout Merchant
- Input dari klien: `{ siswaId: string, items: { varianId: string, qty: number }[] }`.
- Server query tabel `produk_varian` join `produk_merchant` untuk mendapatkan harga satuan riil.
- Total harga dihitung di sisi server: $\sum (\text{harga\_satuan} \times \text{qty})$.
- Validasi kepemilikan siswa: verifikasi `siswaId` terdaftar sebagai anak dari akun ortu yang sedang login (via `profiles.siswa_id` atau tabel pendukung).

### C. Skema Database

#### 1. Migrasi `031_performance_indexes.sql`:
```sql
-- Absensi Siswa & Pelatih
CREATE INDEX IF NOT EXISTS idx_absensi_siswa_tgl_kelas ON public.absensi_siswa (tgl, kelas);
CREATE INDEX IF NOT EXISTS idx_absensi_siswa_siswa_tgl ON public.absensi_siswa (siswa_id, tgl);
CREATE INDEX IF NOT EXISTS idx_absensi_pelatih_tgl ON public.absensi_pelatih (tgl, pelatih_id);

-- Iuran
CREATE INDEX IF NOT EXISTS idx_iuran_periode_status ON public.iuran (tahun, bulan, status_bayar);
CREATE INDEX IF NOT EXISTS idx_iuran_siswa_periode ON public.iuran (siswa_id, tahun, bulan);

-- Keuangan Club
CREATE INDEX IF NOT EXISTS idx_keuangan_club_tgl_jenis ON public.keuangan_club (tgl, jenis);

-- Siswa & Profiles
CREATE INDEX IF NOT EXISTS idx_siswa_no_hp_ortu ON public.siswa (no_hp_ortu);
CREATE INDEX IF NOT EXISTS idx_siswa_status_program ON public.siswa (status_aktif, program_kelas_id);
CREATE INDEX IF NOT EXISTS idx_profiles_siswa_pelatih ON public.profiles (siswa_id, pelatih_id);
```

#### 2. Migrasi `032_no_reg_sertifikat.sql`:
```sql
-- Tambah kolom no_reg_sertifikat pada tabel siswa dan ujian_sabuk
ALTER TABLE public.siswa ADD COLUMN IF NOT EXISTS no_reg_sertifikat TEXT;
ALTER TABLE public.ujian_sabuk ADD COLUMN IF NOT EXISTS no_reg_sertifikat TEXT;

-- Index pencarian no registrasi
CREATE INDEX IF NOT EXISTS idx_siswa_no_reg ON public.siswa (no_reg_sertifikat);

-- Update trigger tr_ujian_sabuk_lulus agar otomatis sinkronisasi no_reg_sertifikat ke siswa jika diisi
CREATE OR REPLACE FUNCTION update_sabuk_siswa_on_lulus()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.hasil = 'lulus' AND (OLD.hasil IS NULL OR OLD.hasil != 'lulus') THEN
        UPDATE siswa 
        SET 
            sabuk_saat_ini = NEW.sabuk_tujuan,
            no_reg_sertifikat = COALESCE(NEW.no_reg_sertifikat, siswa.no_reg_sertifikat)
        WHERE id = NEW.siswa_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 3. Alur Antarmuka Pengguna (UI Flow)

### Ujian Kenaikan Sabuk (`src/app/admin/ujian/page.tsx` & `src/app/pelatih/ujian/page.tsx`):
1. **Modal Evaluasi Hasil Ujian**:
   - Jika `sabuk_asal === 'Putih'` (atau siswa belum memiliki `no_reg_sertifikat`):
     - Ditampilkan input teks: **"No. Registrasi Sertifikat"** (placeholder: `contoh: STKD-2026-0089 atau No. PBTI`).
     - Terdapat keterangan bantuan: *"Nomor registrasi pertama kali diterbitkan saat kenaikan sabuk putih ke kuning dan akan digunakan permanen untuk ujian sabuk berikutnya."*
   - Jika siswa sudah memiliki `no_reg_sertifikat`:
     - Input otomatis terisi dengan nomor registrasi yang ada.
     - Mode terkunci / *read-only* dengan badge centang hijau *"Tersimpan Permanen"*, sehingga nomor sertifikat konsisten tidak berubah.
2. **Tabel Data Ujian & Siswa**:
   - Menampilkan kolom badge "No. Reg Sertifikat" di tabel riwayat ujian dan detail siswa.

---

## 4. Kriteria Keberhasilan (Verification & Testing)
1. **Unit Test**: Test runner (`npx tsx --test`) tetap lulus 100%.
2. **Build Test**: `npm run build` sukses tanpa crash.
3. **Security Test**:
   - Percobaan memanggil server action admin dari unauthenticated context mengembalikan `{ success: false, message: 'Unauthorized' }`.
   - Checkout merchant dengan harga client yang dimanipulasi tetap tercatat dengan harga database yang benar.
4. **Functional Test**:
   - Menguji alur kenaikan sabuk Putih ke Kuning dengan nomor registrasi, memverifikasi nilai tersimpan di `ujian_sabuk` dan `siswa`.
   - Menguji kenaikan sabuk lanjutan (Kuning ke Hijau), memastikan nomor registrasi otomatis terbaca dan terkunci.
