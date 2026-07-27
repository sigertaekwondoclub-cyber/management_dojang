-- ==========================================
-- MERCHANT: Toko Produk Club
-- ==========================================

-- Tabel produk
CREATE TABLE IF NOT EXISTS produk_merchant (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nama TEXT NOT NULL,
  kategori TEXT NOT NULL CHECK (kategori IN ('Seragam', 'Aksesoris', 'Perlengkapan')),
  harga NUMERIC NOT NULL CHECK (harga >= 0),
  deskripsi TEXT,
  foto_url TEXT,
  status_aktif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabel varian ukuran per produk
CREATE TABLE IF NOT EXISTS produk_varian (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  produk_id UUID NOT NULL REFERENCES produk_merchant(id) ON DELETE CASCADE,
  ukuran TEXT NOT NULL,
  stok INT NOT NULL DEFAULT 0 CHECK (stok >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabel header pesanan
CREATE TABLE IF NOT EXISTS pesanan_merchant (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  siswa_id UUID NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
  total_harga NUMERIC NOT NULL CHECK (total_harga >= 0),
  status TEXT NOT NULL DEFAULT 'menunggu_pembayaran'
    CHECK (status IN ('menunggu_pembayaran', 'lunas', 'diproses', 'siap_diambil')),
  bukti_transfer_url TEXT,
  catatan_admin TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger: auto-update updated_at pada pesanan_merchant
CREATE OR REPLACE FUNCTION update_pesanan_merchant_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pesanan_merchant_updated_at ON pesanan_merchant;
CREATE TRIGGER trg_pesanan_merchant_updated_at
BEFORE UPDATE ON pesanan_merchant
FOR EACH ROW EXECUTE FUNCTION update_pesanan_merchant_updated_at();

-- Tabel item dalam pesanan
CREATE TABLE IF NOT EXISTS pesanan_item (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pesanan_id UUID NOT NULL REFERENCES pesanan_merchant(id) ON DELETE CASCADE,
  produk_id UUID NOT NULL REFERENCES produk_merchant(id) ON DELETE RESTRICT,
  varian_id UUID NOT NULL REFERENCES produk_varian(id) ON DELETE RESTRICT,
  qty INT NOT NULL CHECK (qty > 0),
  harga_satuan NUMERIC NOT NULL CHECK (harga_satuan >= 0)
);

-- ==========================================
-- ROW LEVEL SECURITY (RLS)
-- ==========================================

ALTER TABLE produk_merchant ENABLE ROW LEVEL SECURITY;
ALTER TABLE produk_varian ENABLE ROW LEVEL SECURITY;
ALTER TABLE pesanan_merchant ENABLE ROW LEVEL SECURITY;
ALTER TABLE pesanan_item ENABLE ROW LEVEL SECURITY;

-- Policy produk_merchant
DROP POLICY IF EXISTS "Admin full access produk_merchant" ON produk_merchant;
CREATE POLICY "Admin full access produk_merchant"
ON produk_merchant FOR ALL TO authenticated
USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

DROP POLICY IF EXISTS "Authenticated can view active produk" ON produk_merchant;
CREATE POLICY "Authenticated can view active produk"
ON produk_merchant FOR SELECT TO authenticated
USING (status_aktif = true OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- Policy produk_varian
DROP POLICY IF EXISTS "Admin full access produk_varian" ON produk_varian;
CREATE POLICY "Admin full access produk_varian"
ON produk_varian FOR ALL TO authenticated
USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

DROP POLICY IF EXISTS "Authenticated can view produk_varian" ON produk_varian;
CREATE POLICY "Authenticated can view produk_varian"
ON produk_varian FOR SELECT TO authenticated
USING (true);

-- Policy pesanan_merchant
DROP POLICY IF EXISTS "Admin full access pesanan_merchant" ON pesanan_merchant;
CREATE POLICY "Admin full access pesanan_merchant"
ON pesanan_merchant FOR ALL TO authenticated
USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

DROP POLICY IF EXISTS "Ortu insert pesanan for own child" ON pesanan_merchant;
CREATE POLICY "Ortu insert pesanan for own child"
ON pesanan_merchant FOR INSERT TO authenticated
WITH CHECK (
  siswa_id IN (
    SELECT siswa_id FROM profiles
    WHERE id = auth.uid() AND role = 'ortu'
  )
);

DROP POLICY IF EXISTS "Ortu view own pesanan" ON pesanan_merchant;
CREATE POLICY "Ortu view own pesanan"
ON pesanan_merchant FOR SELECT TO authenticated
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  OR siswa_id IN (
    SELECT siswa_id FROM profiles
    WHERE id = auth.uid() AND role = 'ortu'
  )
);

DROP POLICY IF EXISTS "Ortu update own pesanan bukti transfer" ON pesanan_merchant;
CREATE POLICY "Ortu update own pesanan bukti transfer"
ON pesanan_merchant FOR UPDATE TO authenticated
USING (
  siswa_id IN (
    SELECT siswa_id FROM profiles
    WHERE id = auth.uid() AND role = 'ortu'
  )
)
WITH CHECK (
  siswa_id IN (
    SELECT siswa_id FROM profiles
    WHERE id = auth.uid() AND role = 'ortu'
  )
);

-- Policy pesanan_item
DROP POLICY IF EXISTS "Admin full access pesanan_item" ON pesanan_item;
CREATE POLICY "Admin full access pesanan_item"
ON pesanan_item FOR ALL TO authenticated
USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

DROP POLICY IF EXISTS "Ortu insert pesanan_item for own pesanan" ON pesanan_item;
CREATE POLICY "Ortu insert pesanan_item for own pesanan"
ON pesanan_item FOR INSERT TO authenticated
WITH CHECK (
  pesanan_id IN (
    SELECT pm.id FROM pesanan_merchant pm
    JOIN profiles p ON p.siswa_id = pm.siswa_id
    WHERE p.id = auth.uid() AND p.role = 'ortu'
  )
);

DROP POLICY IF EXISTS "Ortu view own pesanan_item" ON pesanan_item;
CREATE POLICY "Ortu view own pesanan_item"
ON pesanan_item FOR SELECT TO authenticated
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  OR pesanan_id IN (
    SELECT pm.id FROM pesanan_merchant pm
    JOIN profiles p ON p.siswa_id = pm.siswa_id
    WHERE p.id = auth.uid() AND p.role = 'ortu'
  )
);
