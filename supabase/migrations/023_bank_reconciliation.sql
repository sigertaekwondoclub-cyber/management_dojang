-- ==========================================
-- 023: REKONSILIASI BANK & AUDIT KAS
-- ==========================================

-- 1. Tambah kolom status rekonsiliasi pada keuangan_club
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

-- 3. Enable RLS & Policies
ALTER TABLE rekonsiliasi_bank ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin full access rekonsiliasi_bank" ON rekonsiliasi_bank;
CREATE POLICY "Admin full access rekonsiliasi_bank" 
ON rekonsiliasi_bank FOR ALL 
TO authenticated 
USING (get_my_role() = 'admin')
WITH CHECK (get_my_role() = 'admin');
