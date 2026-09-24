-- ==========================================
-- 022: TABEL KASBON / HUTANG PELATIH & SINKRONISASI KAS
-- ==========================================

-- 1. Tabel Master Pinjaman Kasbon Pelatih
CREATE TABLE IF NOT EXISTS kasbon_pelatih (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pelatih_id UUID NOT NULL REFERENCES pelatih(id) ON DELETE RESTRICT,
  nominal_pinjaman NUMERIC NOT NULL CHECK (nominal_pinjaman > 0),
  sisa_hutang NUMERIC NOT NULL CHECK (sisa_hutang >= 0),
  tgl_pinjam DATE NOT NULL,
  keterangan TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('belum_lunas', 'lunas')) DEFAULT 'belum_lunas',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabel Riwayat Pembayaran/Cicilan Kasbon
CREATE TABLE IF NOT EXISTS pembayaran_kasbon (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  kasbon_id UUID NOT NULL REFERENCES kasbon_pelatih(id) ON DELETE CASCADE,
  pelatih_id UUID NOT NULL REFERENCES pelatih(id) ON DELETE RESTRICT,
  tgl_bayar DATE NOT NULL,
  nominal NUMERIC NOT NULL CHECK (nominal > 0),
  metode TEXT NOT NULL CHECK (metode IN ('potong_honor', 'tunai')),
  payroll_detail_id UUID REFERENCES payroll_details(id) ON DELETE SET NULL,
  catatan TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Alter Tabel payroll_details untuk mencatat potongan kasbon & honor bersih
ALTER TABLE payroll_details ADD COLUMN IF NOT EXISTS potongan_kasbon NUMERIC DEFAULT 0;
ALTER TABLE payroll_details ADD COLUMN IF NOT EXISTS honor_bersih NUMERIC DEFAULT 0;

-- 4. Enable Row Level Security (RLS)
ALTER TABLE kasbon_pelatih ENABLE ROW LEVEL SECURITY;
ALTER TABLE pembayaran_kasbon ENABLE ROW LEVEL SECURITY;

-- 5. Policies untuk Admin (Full Access)
DROP POLICY IF EXISTS "Admin full access kasbon_pelatih" ON kasbon_pelatih;
CREATE POLICY "Admin full access kasbon_pelatih" 
ON kasbon_pelatih FOR ALL 
TO authenticated 
USING (get_my_role() = 'admin')
WITH CHECK (get_my_role() = 'admin');

DROP POLICY IF EXISTS "Admin full access pembayaran_kasbon" ON pembayaran_kasbon;
CREATE POLICY "Admin full access pembayaran_kasbon" 
ON pembayaran_kasbon FOR ALL 
TO authenticated 
USING (get_my_role() = 'admin')
WITH CHECK (get_my_role() = 'admin');

-- 6. Policies untuk Pelatih (Hanya melihat data miliknya)
DROP POLICY IF EXISTS "Pelatih view own kasbon" ON kasbon_pelatih;
CREATE POLICY "Pelatih view own kasbon" 
ON kasbon_pelatih FOR SELECT 
TO authenticated 
USING (
  get_my_role() = 'pelatih' 
  AND pelatih_id = (SELECT pelatih_id FROM profiles WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Pelatih view own pembayaran kasbon" ON pembayaran_kasbon;
CREATE POLICY "Pelatih view own pembayaran kasbon" 
ON pembayaran_kasbon FOR SELECT 
TO authenticated 
USING (
  get_my_role() = 'pelatih' 
  AND pelatih_id = (SELECT pelatih_id FROM profiles WHERE id = auth.uid())
);
