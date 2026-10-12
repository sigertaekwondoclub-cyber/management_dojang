# Design Specification: Professional Club Finance Suite

- **Date:** 2026-10-12
- **Topic:** Professional Finance Suite (Buku Kas, Rekonsiliasi Bank, Laba Rugi P&L, Neraca Posisi Keuangan)
- **Status:** Proposed
- **Author:** Antigravity AI & Siger TC Dev Team

---

## 1. Background & Objectives

### 1.1 Background
Pada pengelolaan keuangan dojang Siger Taekwondo Club, pengurus mengelola berbagai arus dana:
1. Rekening Bank resmi (*Bank Jago Syariah*).
2. Akun penampung digital (*GoPay / Midtrans QRIS*).
3. Kas tunai operasional fisik di dojang (*Petty cash*).

Sebelumnya, seluruh transaksi digabungkan dalam satu tabel mutasi tanpa pemisahan standar akuntansi, yang memicu dua masalah utama:
- **Kerancuan Arus Kas vs Laba Bersih:** Pengurus bingung mengapa angka **Saldo Bersih (Arus Kas)** berbeda dengan **Laba Bersih (P&L)** karena transaksi non-operasional (seperti pelunasan kasbon pelatih dan koreksi saldo fisik) tercampur dengan omset penjualan.
- **Pencocokan Bank Manual:** Tidak tersedianya modul Rekonsiliasi Bank formal untuk mencocokkan mutasi rekening koran bank dengan catatan aplikasi.

### 1.2 Objectives
Mengubah halaman Keuangan Club menjadi **Financial Suite Profesional** dengan standar akuntansi bisnis modern:
1. **Buku Kas & Mutasi (Cash Ledger):** Pencatatan harian, filter periode bulanan/tahunan, dan audit trail mutasi.
2. **Rekonsiliasi Bank (Bank Reconciliation):** Dashboard pencocokan saldo sistem vs saldo rekening bank, checklist transaksi (*Reconciled* vs *Outstanding*), dan riwayat snapshot rekonsiliasi.
3. **Laporan Laba Rugi Standar (P&L Statement):** Pemisahan jelas antara Pendapatan Usaha, Beban Pokok & Operasional, Pos Non-Operasional, dan Net Profit Margin.
4. **Neraca & Posisi Keuangan (Balance Sheet):** Rekapitulasi Aset Lancar (Kas & Bank, Piutang Iuran Siswa, Piutang Kasbon Pelatih), Liabilitas (Honor pelatih terutang), dan Ekuitas Bersih (Net Worth).

---

## 2. Architecture & UX Flow

### 2.1 Tab Navigation di `/admin/keuangan`
Halaman admin keuangan dilengkapi dengan 4 Tab Inti yang responsif dan elegan:
```
┌────────────────────────────────────────────────────────────────────────┐
│ [ 📖 Buku Kas ]  [ ⚖️ Rekonsiliasi Bank ]  [ 📊 Laba Rugi ]  [ 🏛️ Neraca ]│
└────────────────────────────────────────────────────────────────────────┘
```

1. **Tab 1: 📖 Buku Kas & Mutasi**
   - KPI Cards: Total Pemasukan, Total Pengeluaran, Saldo Kas Riil Berjalan.
   - Filter Periode (Bulan & Tahun), Jenis (Semua / Income / Expense), Sumber.
   - Form Tambah Transaksi & Modal Koreksi Saldo (Cash Opname).
   - Ekspor Excel (.xlsx), Cetak PDF, dan CSV.

2. **Tab 2: ⚖️ Rekonsiliasi Bank**
   - **Header Card:**
     - Saldo Menurut Sistem (Book Balance)
     - Saldo Menurut Rekening Bank (Bank Statement Balance)
     - Selisih Belum Terekonsiliasi (Unreconciled Difference)
   - **Tombol Aksi:** "Simpan Rekonsiliasi Baru (Opname Bank)" & "Tandai Semua Cocok".
   - **Tabel Transaksi:** Dilengkapi kolom status `Sudah Cocok (Reconciled)` dengan toggle checklist interaktif.
   - **Riwayat Rekonsiliasi:** Log historis tanggal rekonsiliasi dan catatan pengurus.

3. **Tab 3: 📊 Laporan Laba Rugi (P&L Statement)**
   - Format standar akuntansi berjenjang:
     - **I. Pendapatan Usaha (Operating Revenue):**
       - Iuran Bulanan Siswa (SPP)
       - Penjualan Merchant Toko & Seragam
       - Pendaftaran Ujian Kenaikan Sabuk & Event
     - **II. Beban Operasional (Operating Expenses):**
       - Honor Mengajar Pelatih
       - Sewa Tempat Latihan
       - Pembelian Perlengkapan & Matras
       - Konsumsi & Logistik
       - Administrasi, ATK & Layard
     - **III. Laba Operasional (Operating Profit):** Revenue - Expenses.
     - **IV. Pos Non-Operasional / Penyesuaian Kas:** Pelunasan Kasbon & Koreksi Opname.
     - **V. Laba Bersih Akhir (Net Profit) & Margin (%):** Disertai kartu edukasi ringkas yang menjelaskan perbedaan Laba Bersih vs Saldo Kas.

4. **Tab 4: 🏛️ Neraca & Posisi Keuangan (Balance Sheet)**
   - **Aset Lancar (Current Assets):**
     - Total Kas & Bank Aktif
     - Piutang Iuran Siswa (Total tunggakan iuran siswa yang belum bayar)
     - Piutang Kasbon Pelatih (Sisa pinjaman pelatih yang belum lunas)
   - **Kewajiban / Liabilitas (Liabilities):**
     - Honor Pelatih Terutang (Payroll bulan berjalan yang belum ditransfer)
   - **Ekuitas Bersih (Net Equity / Kekayaan Bersih Club):** Total Aset - Total Kewajiban.

---

## 3. Database Schema Changes

### 3.1 Migration `023_bank_reconciliation.sql`
```sql
-- 1. Tambah kolom rekonsiliasi pada keuangan_club
ALTER TABLE keuangan_club 
ADD COLUMN IF NOT EXISTS is_reconciled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMP WITH TIME ZONE;

-- 2. Tabel riwayat snapshot rekonsiliasi bank
CREATE TABLE IF NOT EXISTS rekonsiliasi_bank (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tgl_rekon DATE NOT NULL,
  nama_bank TEXT NOT NULL DEFAULT 'Bank Jago Syariah',
  no_rekening TEXT NOT NULL DEFAULT '502747384058',
  saldo_bank_riil NUMERIC NOT NULL,
  saldo_buku_sistem NUMERIC NOT NULL,
  selisih NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('cocok', 'ada_selisih')) DEFAULT 'cocok',
  catatan TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. RLS Policies
ALTER TABLE rekonsiliasi_bank ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin full access rekonsiliasi_bank" ON rekonsiliasi_bank;
CREATE POLICY "Admin full access rekonsiliasi_bank" 
ON rekonsiliasi_bank FOR ALL 
TO authenticated 
USING (get_my_role() = 'admin')
WITH CHECK (get_my_role() = 'admin');
```

---

## 4. Component Structure & Data Flow

```
src/
├── app/admin/keuangan/
│   ├── page.tsx                    # Controller & Tab Switcher
│   └── actions.ts                  # Server actions untuk rekonsiliasi
├── components/keuangan/
│   ├── CashLedgerTab.tsx           # Tab 1: Mutasi Kas, Filter, Table
│   ├── BankReconciliationTab.tsx   # Tab 2: Rekonsiliasi Bank
│   ├── ProfitLossTab.tsx           # Tab 3: P&L Statement
│   ├── BalanceSheetTab.tsx         # Tab 4: Neraca Aset & Liabilitas
│   └── PrintReportModal.tsx        # Pratinjau Cetak / PDF resmi
└── lib/
    ├── types.ts                    # Tipe data keuangan lengkap
    └── exportKeuangan.ts           # Generator Excel .xlsx multi-sheet
```

---

## 5. Testing & Verification Plan

1. **Uji Fungsional Tab Navigation:**
   - Memastikan perpindahan tab berjalan mulus tanpa re-fetch data berlebihan.
2. **Uji Rekonsiliasi Bank:**
   - Toggle checklist `is_reconciled` langsung tersimpan ke Supabase.
   - Input snapshot saldo bank menghitung selisih secara akurat.
3. **Uji Integritas P&L dan Neraca:**
   - Memastikan Laba Bersih konsisten dan tidak memasukkan pos non-operasional (kasbon/koreksi).
   - Memastikan piutang iuran dan kasbon dihitung real-time dari tabel `iuran` dan `kasbon_pelatih`.
4. **Build & Bundle Verification:**
   - Menjalankan `npm run build` untuk memverifikasi 0 TypeScript error.
