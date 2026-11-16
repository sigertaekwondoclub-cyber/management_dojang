-- =====================================================
-- MIGRASI 029: FITUR INVENTARIS CLUB SIGER TC
-- =====================================================

-- 1. TABEL: inventaris_barang (Master Alat & Stok Kondisi)
CREATE TABLE IF NOT EXISTS inventaris_barang (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    kode_barang TEXT UNIQUE NOT NULL,
    nama_barang TEXT NOT NULL,
    kategori TEXT NOT NULL CHECK (kategori IN (
        'Target & Kicking',
        'Proteksi & Sparring',
        'Fasilitas Dojang',
        'Elektronik & Scoring',
        'Lainnya'
    )),
    total_stok INT NOT NULL DEFAULT 0 CHECK (total_stok >= 0),
    kondisi_baik INT NOT NULL DEFAULT 0 CHECK (kondisi_baik >= 0),
    kondisi_rusak_ringan INT NOT NULL DEFAULT 0 CHECK (kondisi_rusak_ringan >= 0),
    kondisi_rusak_berat INT NOT NULL DEFAULT 0 CHECK (kondisi_rusak_berat >= 0),
    stok_dipinjam INT NOT NULL DEFAULT 0 CHECK (stok_dipinjam >= 0),
    lokasi_penyimpanan TEXT NOT NULL DEFAULT 'Dojang Utama',
    keterangan TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trigger untuk sinkronisasi total_stok otomatis
CREATE OR REPLACE FUNCTION trg_sync_total_stok_inventaris()
RETURNS TRIGGER AS $$
BEGIN
    NEW.total_stok := NEW.kondisi_baik + NEW.kondisi_rusak_ringan + NEW.kondisi_rusak_berat;
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_calc_total_stok_inventaris ON inventaris_barang;
CREATE TRIGGER trg_calc_total_stok_inventaris
BEFORE INSERT OR UPDATE ON inventaris_barang
FOR EACH ROW
EXECUTE FUNCTION trg_sync_total_stok_inventaris();

-- 2. TABEL: inventaris_pembelian (Log Pengadaan Baru)
CREATE TABLE IF NOT EXISTS inventaris_pembelian (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    barang_id UUID REFERENCES inventaris_barang(id) ON DELETE SET NULL,
    nama_barang TEXT NOT NULL,
    kategori TEXT NOT NULL,
    tgl_beli DATE NOT NULL,
    jumlah INT NOT NULL CHECK (jumlah > 0),
    harga_satuan NUMERIC NOT NULL CHECK (harga_satuan >= 0),
    total_biaya NUMERIC NOT NULL CHECK (total_biaya >= 0),
    toko_vendor TEXT,
    catat_ke_kas BOOLEAN NOT NULL DEFAULT true,
    keuangan_id UUID REFERENCES keuangan_club(id) ON DELETE SET NULL,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. TABEL: inventaris_peminjaman (Sirkulasi & Peminjaman)
CREATE TABLE IF NOT EXISTS inventaris_peminjaman (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    barang_id UUID NOT NULL REFERENCES inventaris_barang(id) ON DELETE CASCADE,
    pelatih_id UUID REFERENCES pelatih(id) ON DELETE SET NULL,
    nama_peminjam TEXT NOT NULL,
    jumlah INT NOT NULL CHECK (jumlah > 0),
    tgl_pinjam DATE NOT NULL,
    tgl_rencana_kembali DATE NOT NULL,
    tgl_kembali DATE,
    keperluan TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'dipinjam' CHECK (status IN ('dipinjam', 'kembali', 'terlambat')),
    catatan_kondisi_kembali TEXT,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. TABEL: inventaris_pengajuan (Usulan Alat dari Pelatih)
CREATE TABLE IF NOT EXISTS inventaris_pengajuan (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    pelatih_id UUID NOT NULL REFERENCES pelatih(id) ON DELETE CASCADE,
    nama_barang TEXT NOT NULL,
    kategori TEXT NOT NULL DEFAULT 'Target & Kicking',
    jumlah INT NOT NULL CHECK (jumlah > 0),
    estimasi_harga NUMERIC DEFAULT 0,
    alasan TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'menunggu' CHECK (status IN ('menunggu', 'disetujui', 'ditolak')),
    catatan_admin TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. ROW LEVEL SECURITY (RLS)
ALTER TABLE inventaris_barang ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventaris_pembelian ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventaris_peminjaman ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventaris_pengajuan ENABLE ROW LEVEL SECURITY;

-- Polisi inventaris_barang
DROP POLICY IF EXISTS "Admin full access inventaris_barang" ON inventaris_barang;
CREATE POLICY "Admin full access inventaris_barang"
ON inventaris_barang FOR ALL
TO authenticated
USING (get_my_role() = 'admin')
WITH CHECK (get_my_role() = 'admin');

DROP POLICY IF EXISTS "Pelatih view inventaris_barang" ON inventaris_barang;
CREATE POLICY "Pelatih view inventaris_barang"
ON inventaris_barang FOR SELECT
TO authenticated
USING (get_my_role() = 'pelatih');

-- Polisi inventaris_pembelian
DROP POLICY IF EXISTS "Admin full access inventaris_pembelian" ON inventaris_pembelian;
CREATE POLICY "Admin full access inventaris_pembelian"
ON inventaris_pembelian FOR ALL
TO authenticated
USING (get_my_role() = 'admin')
WITH CHECK (get_my_role() = 'admin');

-- Polisi inventaris_peminjaman
DROP POLICY IF EXISTS "Admin full access inventaris_peminjaman" ON inventaris_peminjaman;
CREATE POLICY "Admin full access inventaris_peminjaman"
ON inventaris_peminjaman FOR ALL
TO authenticated
USING (get_my_role() = 'admin')
WITH CHECK (get_my_role() = 'admin');

DROP POLICY IF EXISTS "Pelatih view own peminjaman" ON inventaris_peminjaman;
CREATE POLICY "Pelatih view own peminjaman"
ON inventaris_peminjaman FOR SELECT
TO authenticated
USING (
    get_my_role() = 'pelatih' AND (
        pelatih_id = (SELECT pelatih_id FROM profiles WHERE id = auth.uid() AND role = 'pelatih')
        OR created_by = auth.uid()
    )
);

DROP POLICY IF EXISTS "Pelatih insert peminjaman" ON inventaris_peminjaman;
CREATE POLICY "Pelatih insert peminjaman"
ON inventaris_peminjaman FOR INSERT
TO authenticated
WITH CHECK (
    get_my_role() = 'pelatih' AND
    created_by = auth.uid()
);

-- Polisi inventaris_pengajuan
DROP POLICY IF EXISTS "Admin full access inventaris_pengajuan" ON inventaris_pengajuan;
CREATE POLICY "Admin full access inventaris_pengajuan"
ON inventaris_pengajuan FOR ALL
TO authenticated
USING (get_my_role() = 'admin')
WITH CHECK (get_my_role() = 'admin');

DROP POLICY IF EXISTS "Pelatih select own pengajuan" ON inventaris_pengajuan;
CREATE POLICY "Pelatih select own pengajuan"
ON inventaris_pengajuan FOR SELECT
TO authenticated
USING (
    get_my_role() = 'pelatih' AND
    pelatih_id = (SELECT pelatih_id FROM profiles WHERE id = auth.uid() AND role = 'pelatih')
);

DROP POLICY IF EXISTS "Pelatih insert own pengajuan" ON inventaris_pengajuan;
CREATE POLICY "Pelatih insert own pengajuan"
ON inventaris_pengajuan FOR INSERT
TO authenticated
WITH CHECK (
    get_my_role() = 'pelatih' AND
    pelatih_id = (SELECT pelatih_id FROM profiles WHERE id = auth.uid() AND role = 'pelatih')
);
