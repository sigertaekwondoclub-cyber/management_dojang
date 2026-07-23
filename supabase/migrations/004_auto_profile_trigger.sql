-- ==========================================
-- AUTO-CREATE PROFILE TRIGGER
-- ==========================================
-- Setiap kali user baru dibuat di auth.users,
-- trigger ini otomatis INSERT ke public.profiles
-- dengan role default 'ortu' (bisa diubah admin nanti).
-- ==========================================

-- 1. Buat function trigger
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, role, nama, siswa_id, pelatih_id)
  VALUES (
    NEW.id,
    'ortu',   -- default role, admin bisa ubah nanti
    COALESCE(NEW.raw_user_meta_data->>'nama', split_part(NEW.email, '@', 1)),
    NULL,
    NULL
  )
  ON CONFLICT (id) DO NOTHING; -- jangan error kalau sudah ada
  RETURN NEW;
END;
$$;

-- 2. Pasang trigger ke auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
