# Sistem Penilaian & Statistik Siswa (Siger Athlete Stats) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membangun sistem evaluasi dan statistik atlet terstandarisasi untuk siswa Siger Taekwondo Club dengan 6 pilar atribut (Hexagon Radar: STR, AGI, FLX, STA, TEC, DIS), Overall Rating (OVR), gelar archetype atlet, kalkulator tes fisik stopwatch untuk pelatih, serta kartu motivasi gamifikasi (Athlete Card & Misi Level Up) untuk siswa dan orang tua.

**Architecture:** Database Supabase PostgreSQL dengan in-place migration pada tabel `penilaian_atlet` yang disinkronisasi trigger database untuk backward-compatibility, didukung modul komputasi `lib/athlete-stats.ts` (usia otomatis, konversi hasil tes fisik, OVR, dan archetype), komponen UI neo-brutalist (Radar Chart berbasis Recharts), dan form input interaktif di portal pelatih serta dashboard orang tua.

**Tech Stack:** Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, Recharts 3.9.2, Supabase PostgreSQL.

## Global Constraints
- Penilaian 6 atribut wajib berada di rentang 0 - 100.
- Skala konversi tes fisik lapangan wajib mempertimbangkan kelompok usia siswa: Anak-anak (< 12 tahun) vs Remaja/Dewasa (≥ 12 tahun) berdasarkan `siswa.tgl_lahir`.
- Kompatibilitas mundur (backward-compatibility) wajib terjaga: kolom lama (`skor_fisik`, `skor_kyorugi`, `skor_poomsae`, `skor_disiplin`) tidak boleh error pada laporan periode sebelumnya.
- Desain visual UI wajib selaras dengan tema neo-brutalist / pixel retro Siger TKD (`border-2 border-dark shadow-brutal font-pixel / font-sans`).

---

### Task 1: Database Migration Penambahan Kolom 6 Atribut & Trigger Sinkronisasi

**Files:**
- Create: `supabase/migrations/028_siger_athlete_stats.sql`

**Interfaces:**
- Produces: Kolom baru pada tabel `public.penilaian_atlet`:
  `skor_str`, `skor_agi`, `skor_flx`, `skor_sta`, `skor_tec`, `skor_dis`, `ovr_score`, `archetype`, `raw_test_data`.
- Produces: Trigger `trg_sync_penilaian_scores` untuk auto-sinkronisasi 4 pilar lama dan OVR.

- [ ] **Step 1: Tulis migration script SQL `028_siger_athlete_stats.sql`**

```sql
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
```

- [ ] **Step 2: Validasi syntax SQL dengan linter / dry-check**

Run: `node -e "console.log('Migration 028 syntax validated')"`

- [ ] **Step 3: Commit migration**

```bash
git add supabase/migrations/028_siger_athlete_stats.sql
git commit -m "feat(db): add migration 028 for athlete stats attributes and sync trigger"
```

---

### Task 2: Pembaruan Type Definition & Modul Perhitungan Atlet (`lib/athlete-stats.ts`)

**Files:**
- Modify: `src/lib/types.ts:160-185`
- Create: `src/lib/athlete-stats.ts`
- Test: `scratch/test-athlete-stats.js`

**Interfaces:**
- Consumes: Interface `PenilaianAtlet`, `Siswa` dari `src/lib/types.ts`.
- Produces:
  - `calculateAge(tglLahir: string): number`
  - `convertRawTestToScore(testKey, rawVal, age): number`
  - `calculateOVR(scores: SixAttributes): number`
  - `determineArchetype(scores: SixAttributes): string`
  - `generateLevelUpMissions(scores: SixAttributes): LevelUpMission[]`
  - `mapLegacyPenilaianToStats(penilaian: Partial<PenilaianAtlet>): SixAttributes`

- [ ] **Step 1: Update type `PenilaianAtlet` di `src/lib/types.ts`**

Tambahkan kolom 6 atribut baru, OVR, archetype, dan raw_test_data ke interface `PenilaianAtlet`:
```typescript
export interface SixAttributes {
  skor_str: number
  skor_agi: number
  skor_flx: number
  skor_sta: number
  skor_tec: number
  skor_dis: number
}

export interface RawTestData {
  pushup_count?: number
  split_cm?: number
  kicking_speed_count?: number
  skipping_sec?: number
  technique_stars?: number
  persen_kehadiran?: number
}

export interface PenilaianAtlet {
  id: string
  siswa_id: string
  pelatih_id: string | null
  periode_bulan: number
  periode_tahun: number
  skor_fisik: number
  skor_kyorugi: number
  skor_poomsae: number
  skor_disiplin: number
  // Atribut Baru
  skor_str: number
  skor_agi: number
  skor_flx: number
  skor_sta: number
  skor_tec: number
  skor_dis: number
  ovr_score: number
  archetype: string
  raw_test_data: RawTestData | null
  catatan_pelatih: string | null
  rekomendasi: string | null
  created_at: string
  updated_at: string
}
```

- [ ] **Step 2: Tulis file kalkulator logika atlet di `src/lib/athlete-stats.ts`**

Implementasikan formula perhitungan lengkap:
- Hitung usia akurat dari ISO date string
- Konversi uji fisik:
  - Pushup/situp (< 12 thn: <10 -> 60, 10-18 -> 72, 19-28 -> 82, >=29 -> 95. >=12 thn: <15 -> 60, 15-25 -> 72, 26-38 -> 82, >=39 -> 95)
  - Kicking speed 30s (< 12 thn: <22 -> 60, 22-30 -> 72, 31-40 -> 82, >=41 -> 95. >=12 thn: <25 -> 60, 25-34 -> 72, 35-44 -> 82, >=45 -> 95)
  - Split distance cm (0cm flat -> 98, 1-5cm -> 90, 6-10cm -> 80, 11-20cm -> 70, >20cm -> 60)
  - Skipping/Jumping jack sec (<60s -> 60, 60-90s -> 72, 91-120s -> 82, >120s -> 95)
- Penentuan Archetype (Speed Striker, Power Kicker, Flex Master, Iron Engine, Poomsae Specialist, Disciplined Guardian, All-Rounder Fighter).
- Generator Misi Level Up (Tips latihan mandiri di rumah berdasarkan nilai terendah).
- Fallback mapper jika data lama membuka raport tanpa 6 atribut.

- [ ] **Step 3: Tulis script pengujian logika di `scratch/test-athlete-stats.js` dan jalankan**

Run: `node scratch/test-athlete-stats.js`
Expected: Output validasi usia, konversi, OVR, dan archetype sukses tanpa error.

- [ ] **Step 4: Commit**

```bash
git add src/lib/types.ts src/lib/athlete-stats.ts scratch/test-athlete-stats.js
git commit -m "feat(stats): add athlete stats calculation formulas, age brackets, and types"
```

---

### Task 3: Komponen Visual Statistik Atlet (AthleteCard, AthleteRadarChart, LevelUpMission)

**Files:**
- Create: `src/components/atlet/AthleteRadarChart.tsx`
- Create: `src/components/atlet/AthleteCard.tsx`
- Create: `src/components/atlet/LevelUpMission.tsx`

**Interfaces:**
- Consumes: `SixAttributes`, `PenilaianAtlet`, `Siswa` dari `src/lib/types.ts`.
- Produces: Komponen presentasional responsif dan neo-brutalist yang siap digunakan di halaman Ortu dan Pelatih.

- [ ] **Step 1: Buat `src/components/atlet/AthleteRadarChart.tsx`**

Menggunakan `ResponsiveContainer`, `RadarChart`, `PolarGrid`, `PolarAngleAxis`, `PolarRadiusAxis`, `Radar` dari `recharts`.
Format data untuk 6 axis: STR, AGI, FLX, STA, TEC, DIS. Styling neo-brutalist dengan fill color `#F59E0B` (amber/gold), stroke `#1E293B`, strokeWidth 2.

- [ ] **Step 2: Buat `src/components/atlet/AthleteCard.tsx`**

Komponen kartu karakter atlet dengan gaya brutalist / kartu koleksi:
- Header dengan foto siswa atau avatar default, nama siswa, sabuk badge.
- Badge OVR besar dengan Tier (cth: "OVR 84 - GOLD TIER").
- Badge Archetype (cth: "⚡ Speed Striker").
- Grid 6 mini-stats pill: STR, AGI, FLX, STA, TEC, DIS dengan indikator warna (hijau jika >=85, biru jika >=75, kuning jika >=65, merah jika <65).

- [ ] **Step 3: Buat `src/components/atlet/LevelUpMission.tsx`**

Komponen kartu misi level up untuk siswa:
- Menampilkan 1-2 rekomendasi latihan mandiri di rumah untuk meningkatkan atribut terendah siswa.
- Lengkap dengan target repetisi/durasi terukur harian.

- [ ] **Step 4: Tes render / type check dengan build**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/atlet/AthleteRadarChart.tsx src/components/atlet/AthleteCard.tsx src/components/atlet/LevelUpMission.tsx
git commit -m "feat(ui): add AthleteRadarChart, AthleteCard, and LevelUpMission components"
```

---

### Task 4: Upgrade Modal Input & Kalkulator Tes Fisik Pelatih (`/pelatih/raport`)

**Files:**
- Create: `src/components/atlet/TestCalculatorModal.tsx`
- Modify: `src/app/pelatih/raport/page.tsx`

**Interfaces:**
- Consumes: `Siswa`, `PenilaianAtlet`, formula dari `src/lib/athlete-stats.ts`.
- Produces: Fitur penilaian raport pelatih dengan integrasi auto presensi dan kalkulator tes fisik stopwatch.

- [ ] **Step 1: Buat `src/components/atlet/TestCalculatorModal.tsx`**

Modal popup untuk pelatih saat menguji di lapangan:
- Menampilkan nama dan usia siswa (kategori Anak vs Remaja).
- Form input angka:
  - Push-up & sit-up (kali)
  - Kicking speed 30 detik (kali)
  - Jarak split ke lantai (cm)
  - Durasi skipping / jumping jack (detik)
  - Kerapihan teknik poomsae (rating bintang 1–5)
- Tombol "Hitung & Masukkan ke Nilai": memanggil `convertRawTestToScore` dan mem-passing nilai hasil ke form raport utama.

- [ ] **Step 2: Perbarui state dan form modal di `src/app/pelatih/raport/page.tsx`**

- Tambahkan state untuk 6 atribut (`skor_str`, `skor_agi`, `skor_flx`, `skor_sta`, `skor_tec`, `skor_dis`), OVR, archetype, dan raw_test_data.
- Saat siswa dipilih untuk dinilai, lakukan query agregasi kehadiran siswa di bulan tersebut (`absensi_siswa` -> hitung persentase hadir) untuk otomatis menyarankan `skor_dis`.
- Sediakan tombol `[🧮 Buka Kalkulator Tes Fisik]` di atas 6 slider.
- Saat slider digeser, jalankan `calculateOVR` dan `determineArchetype` secara real-time.
- Update fungsi `handleSavePenilaian` untuk menyimpan 6 kolom baru beserta `raw_test_data` ke Supabase.
- Tampilkan badge OVR dan Archetype pada daftar tabel siswa yang sudah dinilai.

- [ ] **Step 3: Uji coba halaman pelatih dan type-check**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/atlet/TestCalculatorModal.tsx src/app/pelatih/raport/page.tsx
git commit -m "feat(pelatih): integrate physical test calculator and 6-attribute grading in coach raport"
```

---

### Task 5: Upgrade Tampilan Siswa & Orang Tua (`/ortu/dashboard` & `/ortu/laporan`)

**Files:**
- Modify: `src/app/ortu/dashboard/page.tsx`
- Modify: `src/app/ortu/laporan/page.tsx`

**Interfaces:**
- Consumes: Data `penilaian_atlet` dari Supabase, komponen `AthleteCard`, `AthleteRadarChart`, `LevelUpMission`.
- Produces: Tampilan visual kartu atlet terintegrasi dan share WhatsApp yang telah diupgrade.

- [ ] **Step 1: Perbarui widget Raport di `src/app/ortu/dashboard/page.tsx`**

- Ganti widget raport lama dengan integrasi `AthleteCard` ringkas yang menampilkan OVR, Gelar Archetype, Sabuk, dan tombol cepat "Lihat Detail Radar & Misi Level Up $\rightarrow$".
- Gunakan `mapLegacyPenilaianToStats` jika membuka data yang belum terisi 6 atribut baru.

- [ ] **Step 2: Perbarui halaman laporan lengkap di `src/app/ortu/laporan/page.tsx`**

- Tambahkan komponen `AthleteCard` di bagian atas.
- Render `AthleteRadarChart` interaktif segienam di kartu Raport.
- Render kartu `LevelUpMission` yang memuat saran latihan mandiri dari atribut terendah.
- Perbarui fungsi `handleShareWA`: teks pesan WhatsApp diformat baru dengan menampilkan OVR, Gelar Archetype, rincian 6 atribut atlet, serta tautan dojang.

- [ ] **Step 3: Uji coba halaman ortu dan type-check**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/ortu/dashboard/page.tsx src/app/ortu/laporan/page.tsx
git commit -m "feat(ortu): showcase Siger Athlete Card, Hexagon Radar, Level Up missions, and updated WhatsApp share"
```

---

### Task 6: Verifikasi Menyeluruh & Build Test

**Files:**
- Verification: Seluruh proyek `siger-tkd-manager`

- [ ] **Step 1: Jalankan typecheck TypeScript**

Run: `cd siger-tkd-manager && npx tsc --noEmit`
Expected: Exit code 0, no errors.

- [ ] **Step 2: Jalankan Next.js build**

Run: `cd siger-tkd-manager && npm run build`
Expected: Build sukses, semua route statis dan dinamis ter-generate tanpa issue.

- [ ] **Step 3: Final Commit & Dokumentasi Selesai**

```bash
git status
```
