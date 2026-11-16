-- Migration 028: Tambah 6 Atribut Atlet & Metadata Kalkulasi pada penilaian_atlet
ALTER TABLE public.penilaian_atlet
  ADD COLUMN IF NOT EXISTS skor_str INT DEFAULT 75 CHECK (skor_str BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS skor_agi INT DEFAULT 75 CHECK (skor_agi BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS skor_flx INT DEFAULT 75 CHECK (skor_flx BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS skor_sta INT DEFAULT 75 CHECK (skor_sta BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS skor_tec INT DEFAULT 75 CHECK (skor_tec BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS skor_dis INT DEFAULT 85 CHECK (skor_dis BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS ovr_score INT DEFAULT 78 CHECK (ovr_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS archetype TEXT DEFAULT 'All-Rounder Fighter',
  ADD COLUMN IF NOT EXISTS raw_test_data JSONB DEFAULT '{}'::jsonb;

-- Trigger fungsi untuk menjaga keselarasan kolom 4 pilar lama dan OVR
CREATE OR REPLACE FUNCTION public.sync_legacy_penilaian_atlet_scores()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.skor_str IS NOT NULL THEN
    NEW.skor_fisik := ROUND((NEW.skor_str + NEW.skor_agi + NEW.skor_flx + NEW.skor_sta) / 4.0);
    NEW.skor_kyorugi := ROUND((NEW.skor_agi + NEW.skor_str) / 2.0);
    NEW.skor_poomsae := NEW.skor_tec;
    NEW.skor_disiplin := NEW.skor_dis;
    NEW.ovr_score := ROUND((NEW.skor_str + NEW.skor_agi + NEW.skor_flx + NEW.skor_sta + NEW.skor_tec + NEW.skor_dis) / 6.0);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_penilaian_scores ON public.penilaian_atlet;
CREATE TRIGGER trg_sync_penilaian_scores
BEFORE INSERT OR UPDATE ON public.penilaian_atlet
FOR EACH ROW
EXECUTE FUNCTION public.sync_legacy_penilaian_atlet_scores();
