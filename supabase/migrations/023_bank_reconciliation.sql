-- ==========================================
-- 023: REKONSILIASI BANK & AUDIT KAS
-- ==========================================

-- Pastikan schema public aktif
SET search_path TO public;

-- 1. Buat tabel keuangan_club jika belum ada
CREATE TABLE IF NOT EXISTS public.keuangan_club (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tgl DATE NOT NULL,
    jenis TEXT NOT NULL CHECK (jenis IN ('income', 'expense')),
    kategori TEXT NOT NULL,
    nominal NUMERIC NOT NULL,
    keterangan TEXT NOT NULL,
    sumber TEXT,
    is_reconciled BOOLEAN DEFAULT false,
    reconciled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Aktifkan RLS untuk keuangan_club
ALTER TABLE public.keuangan_club ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin full access to keuangan_club" ON public.keuangan_club;
CREATE POLICY "Admin full access to keuangan_club"
ON public.keuangan_club FOR ALL
TO authenticated
USING (get_my_role() = 'admin')
WITH CHECK (get_my_role() = 'admin');

-- Tambahkan kolom status rekonsiliasi jika tabel sudah ada sebelumnya
ALTER TABLE public.keuangan_club 
ADD COLUMN IF NOT EXISTS is_reconciled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMP WITH TIME ZONE;

-- 2. Tabel riwayat snapshot rekonsiliasi bank
CREATE TABLE IF NOT EXISTS public.rekonsiliasi_bank (
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

-- 3. Enable RLS & Policies untuk rekonsiliasi_bank
ALTER TABLE public.rekonsiliasi_bank ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin full access rekonsiliasi_bank" ON public.rekonsiliasi_bank;
CREATE POLICY "Admin full access rekonsiliasi_bank" 
ON public.rekonsiliasi_bank FOR ALL 
TO authenticated 
USING (get_my_role() = 'admin')
WITH CHECK (get_my_role() = 'admin');
