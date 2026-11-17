# Spesifikasi Desain: Pelacakan Tunggakan Iuran & Rekap Pesan WhatsApp Siswa

Mekanisme pelacakan tunggakan iuran bulanan siswa dihitung sejak tanggal siswa bergabung (`tgl_gabung`) hingga periode berjalan, dirangkum bersama data kehadiran latihan (bulan ini dan kumulatif periode menunggak) untuk pengiriman pesan tagihan WhatsApp ke orang tua siswa di panel Admin Laporan.

---

## 1. Latar Belakang & Masalah
Sebelumnya, tab *Pengingat & Tagihan Iuran Siswa* di `src/app/admin/laporan/page.tsx` hanya memeriksa status iuran pada satu bulan yang sedang dipilih (`filterBulan` & `filterTahun`). Konsekuensinya:
1. Admin tidak mengetahui apakah siswa memiliki tunggakan di bulan-bulan sebelumnya.
2. Pesan WhatsApp yang dikirimkan ke wali murid hanya mencantumkan tagihan 1 bulan, sehingga jika siswa menunggak 2 atau 3 bulan, tagihan lampau tidak tertera.
3. Rekap kehadiran hanya menampilkan sesi bulan berjalan, padahal orang tua yang menunggak memerlukan transparansi total sesi latihan yang telah diikuti siswa selama periode belum lunas.

---

## 2. Tujuan & Ruang Lingkup
- **Pelacakan Otomatis Tunggakan Multi-Bulan**: Menghitung secara otomatis berapa bulan siswa belum membayar iuran sejak siswa resmi bergabung (`tgl_gabung`) sampai periode yang difilter.
- **Rangkuman Kehadiran Ganda**: Merangkum kehadiran bulan berjalan (persentase & jumlah sesi) serta total sesi kehadiran selama periode menunggak.
- **Pesan WhatsApp Komprehensif**: Mengirim rincian tunggakan bulan, nominal per bulan, total akumulasi rupiah, rekening klub, dan rekap absensi dalam format rapi via WhatsApp.
- **Penyempurnaan UI Admin Laporan**:
  - Filter cepat: `Semua`, `🔴 Belum Bayar (Bulan Ini)`, `⚠️ Menunggak > 1 Bulan`, `🔍 Menunggu Verifikasi`, `✅ Lunas`.
  - Kartu siswa dengan indikator badge tunggakan bulan dan akumulasi rupiah.
  - Perbaruan fungsi salin tagihan massal (*copy all unpaid list*).

---

## 3. Logika & Model Perhitungan Data

### 3.1. Penentuan Rentang Bulan (Start & End Periode)
Untuk setiap siswa berstatus aktif (`status_aktif = true`):
- **Bulan Mulai**: Diambil dari `siswa.tgl_gabung` (contoh: jika `tgl_gabung` = `2025-08-10`, bulan mulai adalah Agustus 2025).
  - *Batas Pengaman*: Jika `tgl_gabung` kosong atau bernilai jauh di masa lalu (lebih dari 24 bulan), sistem membatasi perhitungan maksimal 24 bulan ke belakang.
- **Bulan Akhir**: Bulan dan tahun yang sedang aktif pada filter halaman laporan (`filterBulan` & `filterTahun`).
- Siswa tidak ditagih untuk bulan-bulan sebelum `tgl_gabung`.

### 3.2. Evaluasi Status Tiap Bulan
Sistem melakukan iterasi setiap bulan dari Bulan Mulai sampai Bulan Akhir:
1. **Lunas (`lunas`)**: Jika terdapat record di tabel `iuran` dengan status `'lunas'`, bulan tersebut dianggap selesai (bukan tunggakan).
2. **Menunggu Verifikasi (`menunggu_verifikasi`)**: Jika terdapat record dengan status `'menunggu_verifikasi'`, ditandai sebagai menunggu verifikasi bukti transfer.
3. **Tunggakan (`belum_bayar`)**:
   - Jika terdapat record `iuran` dengan status `'belum_bayar'` atau `'ditolak'`, bulan tersebut masuk daftar tunggakan dengan nominal sesuai record.
   - Jika **belum ada record** (misal admin belum sempat klik *Generate Tagihan* pada bulan tersebut), bulan tersebut **otomatis dimasukkan sebagai tunggakan** dengan nominal default dari `program_kelas.biaya_bulanan` siswa (default fallback: Rp 100.000).

### 3.3. Struktur Data Hasil Kalkulasi Siswa
```typescript
interface ItemTunggakanBulan {
  bulan: number
  tahun: number
  namaBulan: string
  nominal: number
  status: 'belum_bayar' | 'ditolak'
  iuranId?: string
}

interface SiswaRekapTagihanExtended extends SiswaRekapTagihan {
  tglGabung: string
  daftarTunggakan: ItemTunggakanBulan[]
  totalBulanMenunggak: number
  totalNominalTunggakan: number
  totalHadirTunggakan: number
  totalSesiTunggakan: number
}
```

### 3.4. Kalkulasi Kehadiran Absensi
1. **Kehadiran Periode Terpilih**: Menghitung absensi siswa (`hadir`, `izin`, `sakit`, `alpha`) pada rentang tanggal 1 sampai akhir bulan dari `filterBulan`-`filterTahun`.
2. **Kehadiran Kumulatif Selama Menunggak**:
   - Mengambil data absensi siswa pada bulan-bulan yang terdaftar di `daftarTunggakan`.
   - Menjumlahkan total kehadiran latihan siswa selama periode menunggak tersebut.

---

## 4. Format Pesan WhatsApp & Aksi Salin

### 4.1. Template Pesan Tagihan Individual (`generatePesanTagihan`)
```text
🥋 *PEMBERITAHUAN TAGIHAN IURAN BULANAN*
*SIGER TAEKWONDO CLUB*

Kepada Yth. Orang Tua / Wali Siswa
👤 *Nama Siswa*: {nama}
🥋 *Program*: Kelas {programKelas}
📅 *Periode Tagihan*: {namaBulanIni} {filterTahun}

💰 *RINCIAN TAGIHAN IURAN*:
• Jumlah Tunggakan: *{totalBulanMenunggak} Bulan*
• Rincian Periode:
  - {bulan_1}: {nominal_1}
  - {bulan_2}: {nominal_2}
  - {bulan_berjalan}: {nominal_berjalan} (Bulan Berjalan)
----------------------------------
💵 *TOTAL TAGIHAN*: *{totalNominalTunggakan}*
📌 *Status*: ⏳ Belum Lunas

📊 *REKAP KEHADIRAN LATIHAN*:
• Bulan Ini ({namaBulanIni} {filterTahun}): *{hadir}x hadir* dari {totalSesi} sesi ({persen}%)
  (Izin: {izin}x | Sakit: {sakit}x | Alpha: {alpha}x)
• Kehadiran Selama Periode Menunggak: *{totalHadirTunggakan}x latihan*

💳 *Rekening Pembayaran*:
• Bank: {rekening_bank}
• No. Rekening: *{rekening_nomor}*
• Atas Nama: {rekening_atas_nama}

_Mohon untuk melakukan konfirmasi & upload bukti transfer melalui portal wali murid atau balas pesan ini setelah melakukan pembayaran._

Terima kasih atas kerja sama dan dukungannya. 🙏🥋
```
*Catatan adaptasi*: Jika siswa hanya menunggak 1 bulan (hanya bulan berjalan), baris rincian periode dan kehadiran kumulatif tidak diduplikasi agar pesan tetap ringkas.

### 4.2. Template Salin Semua Belum Bayar (`handleSalinSemuaBelumBayar`)
```text
📋 *DAFTAR SISWA BELUM BAYAR IURAN*
📅 Periode: {namaBulanIni} {filterTahun}
👥 Total: {jumlahSiswa} Siswa
💰 Total Tagihan Akumulasi: {grandTotalRupiah}

1. *{nama}* ({programKelas})
   • Tunggakan: {totalBulan} Bulan ({daftarBulanSingkat}) - {totalNominal}
   • Kehadiran Bulan Ini: {hadir}/{totalSesi} sesi | WA: {no_hp_ortu}
...
```

---

## 5. Perubahan Tampilan Antarmuka (UI)
Di file `src/app/admin/laporan/page.tsx` pada tab `tagihan_ortu`:
1. **Sub-Filter Status**:
   - `Semua Status ({total})`
   - `🔴 Belum Bayar ({count})`
   - `⚠️ Menunggak > 1 Bulan ({count})`
   - `🔍 Menunggu Verifikasi ({count})`
   - `✅ Lunas ({count})`
2. **Kartu Siswa**:
   - Header badge: Menampilkan badge `⚠️ Menunggak X Bulan` (oranye/merah) untuk tunggakan > 1 bulan.
   - Baris Tagihan: Menampilkan total tagihan akumulasi rupiah dan keterangan rincian bulan.
   - Baris Kehadiran: Menampilkan persentase kehadiran bulan ini + catatan sesi kumulatif.
3. **Penyaringan Pencarian**:
   - Pencarian teks mendukung nama siswa dan nomor HP wali murid.
   - Filter kelas (Semua / Umum / Prestasi).

---

## 6. Penanganan Kasus Khusus (Edge Cases)
- **Siswa Baru di Pertengahan Bulan**: Jika `tgl_gabung` berada di bulan berjalan, tidak ada tunggakan bulan lampau.
- **Siswa Nonaktif**: Data tagihan siswa nonaktif tetap diabaikan dari penagihan aktif sesuai kebijakan sistem.
- **Siswa Tanpa Nomor WhatsApp**: Tombol WA memunculkan peringatan ramah bahwa nomor HP belum terdaftar di profil siswa.
- **Bulan Tanpa Record di Tabel Iuran**: Dihitung otomatis menggunakan tarif kelas siswa sehingga tidak ada tunggakan yang luput.

---

## 7. Rencana Verifikasi & Pengujian
1. Verifikasi kalkulasi bulan menunggak untuk siswa yang bergabung beberapa bulan lalu.
2. Verifikasi siswa yang baru bergabung di bulan berjalan (hanya ditagih 1 bulan).
3. Verifikasi siswa yang sudah lunas (muncul badge Lunas dan tidak masuk filter menunggak).
4. Verifikasi format teks WhatsApp saat tombol "Kirim Tagihan (WA)" diklik.
5. Verifikasi tombol "Salin Daftar Belum Bayar" menyalin teks rekap akumulasi dengan benar.
6. Memastikan tidak ada regresi pada tab Laporan lainnya (Keuangan, Kehadiran, Honor Pelatih, Anggota, Prestasi).
