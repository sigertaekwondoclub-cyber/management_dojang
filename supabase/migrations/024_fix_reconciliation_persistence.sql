-- ==========================================
-- 024: FIX RECONCILIATION PERSISTENCE
-- ==========================================
-- Sebelumnya, transaksi virtual (iuran & honor) tidak bisa ditandai
-- sebagai "Reconciled" karena tidak ada kolom status di tabel sumber.
-- Migration ini memperbaiki hal tersebut.

SET search_path TO public;

-- 1. Tambahkan kolom is_reconciled pada tabel iuran
--    agar pembayaran iuran siswa dapat ditandai sudah cocok dengan rekening bank
ALTER TABLE public.iuran
  ADD COLUMN IF NOT EXISTS is_reconciled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMP WITH TIME ZONE;

-- 2. Tambahkan kolom is_reconciled pada payroll_details
--    agar transfer honor pelatih dapat ditandai sudah cocok dengan rekening bank
ALTER TABLE public.payroll_details
  ADD COLUMN IF NOT EXISTS is_reconciled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMP WITH TIME ZONE;

-- 3. Index untuk mempercepat query reconciliation status
CREATE INDEX IF NOT EXISTS idx_iuran_reconciled ON public.iuran (is_reconciled) WHERE is_reconciled = true;
CREATE INDEX IF NOT EXISTS idx_payroll_details_reconciled ON public.payroll_details (is_reconciled) WHERE is_reconciled = true;
