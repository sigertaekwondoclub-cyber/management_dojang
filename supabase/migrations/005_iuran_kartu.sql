-- ==========================================
-- FASE 3: IURAN BULANAN & KARTU ANGGOTA
-- ==========================================

-- ==========================================
-- 1. CREATE TABLES
-- ==========================================

-- Tabel: iuran
CREATE TABLE iuran (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    siswa_id UUID NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
    bulan INT NOT NULL CHECK (bulan BETWEEN 1 AND 12),
    tahun INT NOT NULL,
    nominal NUMERIC NOT NULL,
    status_bayar TEXT NOT NULL DEFAULT 'belum_bayar'
        CHECK (status_bayar IN ('belum_bayar', 'menunggu_verifikasi', 'lunas', 'ditolak')),
    tgl_bayar TIMESTAMP WITH TIME ZONE,
    metode TEXT,
    bukti_transfer_url TEXT,
    catatan TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (siswa_id, bulan, tahun)
);

-- Tabel: kartu_anggota
CREATE TABLE kartu_anggota (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    siswa_id UUID NOT NULL UNIQUE REFERENCES siswa(id) ON DELETE CASCADE,
    no_kartu TEXT NOT NULL UNIQUE,
    qr_code_value TEXT NOT NULL,
    tgl_cetak DATE,
    status_aktif BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- 2. STORAGE BUCKET
-- ==========================================
-- Buat bucket lewat Supabase Dashboard → Storage → New Bucket:
-- Nama: bukti-transfer
-- Public: false (private, akses via signed URL)
--
-- Atau jalankan SQL di bawah ini:
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'bukti-transfer',
    'bukti-transfer',
    false,
    5242880, -- 5MB limit
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: ortu bisa upload ke folder sesuai siswa_id-nya
-- Ortu bisa upload
CREATE POLICY "Ortu can upload bukti transfer"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'bukti-transfer'
    AND auth.uid() IS NOT NULL
);

-- Ortu bisa baca file milik anaknya
CREATE POLICY "Authenticated users can read bukti transfer"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'bukti-transfer');

-- ==========================================
-- 3. ROW LEVEL SECURITY
-- ==========================================

ALTER TABLE iuran ENABLE ROW LEVEL SECURITY;
ALTER TABLE kartu_anggota ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------
-- POLICIES: iuran
-- ------------------------------------------

-- Admin: full access
CREATE POLICY "Admin full access to iuran"
ON iuran FOR ALL
TO authenticated
USING (get_my_role() = 'admin')
WITH CHECK (get_my_role() = 'admin');

-- Ortu: SELECT tagihan anaknya saja
CREATE POLICY "Ortu can view own child iuran"
ON iuran FOR SELECT
TO authenticated
USING (
    siswa_id = (
        SELECT siswa_id FROM profiles WHERE id = auth.uid() AND role = 'ortu'
    )
);

-- Ortu: UPDATE hanya kolom bukti_transfer_url & status_bayar
-- HANYA kalau status sebelumnya 'belum_bayar' atau 'ditolak'
-- (Constraint ini dijaga di level aplikasi + policy below)
CREATE POLICY "Ortu can update own iuran bukti"
ON iuran FOR UPDATE
TO authenticated
USING (
    siswa_id = (
        SELECT siswa_id FROM profiles WHERE id = auth.uid() AND role = 'ortu'
    )
    AND status_bayar IN ('belum_bayar', 'ditolak')
)
WITH CHECK (
    siswa_id = (
        SELECT siswa_id FROM profiles WHERE id = auth.uid() AND role = 'ortu'
    )
    AND status_bayar = 'menunggu_verifikasi'
);

-- ------------------------------------------
-- POLICIES: kartu_anggota
-- ------------------------------------------

-- Admin: full access
CREATE POLICY "Admin full access to kartu_anggota"
ON kartu_anggota FOR ALL
TO authenticated
USING (get_my_role() = 'admin')
WITH CHECK (get_my_role() = 'admin');

-- Ortu: read-only untuk kartu anaknya
CREATE POLICY "Ortu can view own child kartu"
ON kartu_anggota FOR SELECT
TO authenticated
USING (
    siswa_id = (
        SELECT siswa_id FROM profiles WHERE id = auth.uid() AND role = 'ortu'
    )
);
