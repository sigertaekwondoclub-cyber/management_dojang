# Desain Sistem Penilaian & Statistik Siswa (Siger Athlete Stats)

**Tanggal:** 2026-11-16  
**Status:** Approved by User  
**Target Aplikasi:** Siger Taekwondo Club Manager (`siger-tkd-manager`)

---

## 1. Ringkasan & Tujuan

Fitur ini bertujuan untuk mentransformasi sistem raport penilaian siswa yang sebelumnya bersifat penilaian subjektif 4-slider sederhana menjadi sistem **Statistik Atlet Komprehensif (Siger Athlete Stats)** yang objektif, terstandarisasi, dan termotivasi gamifikasi (ala *Player Card / RPG Athlete Stats*).

### Manfaat Utama:
1. **Bagi Siswa & Orang Tua:** Setiap siswa memiliki kartu statistik (OVR rating, radar chart 6 atribut, dan gelar archetype) yang dapat dipantau perkembangannya dan memicu motivasi untuk latihan mandiri (*Misi Level Up*).
2. **Bagi Pelatih:** Tersedia kalkulator uji fisik instan (stopwatch & target) dengan rubrik terstandarisasi yang otomatis disesuaikan dengan kategori usia siswa, serta otomatis menghitung persentase presensi latihan.
3. **Bagi Dojang:** Standardisasi evaluasi atlet untuk persiapan Ujian Kenaikan Tingkat (UKT) maupun pemetaan atlet tanding (*Kyorugi*) dan jurus (*Poomsae*).

---

## 2. Model 6 Atribut Atlet & Skala Standarisasi

Statistik siswa dibagi menjadi 6 atribut utama (Radar Segienam):
1. **STR (Strength / Kekuatan Otot & Daya Ledak)**
2. **AGI (Agility & Speed / Kelincahan & Kecepatan Langkah)**
3. **FLX (Flexibility / Kelenturan Tubuh)**
4. **STA (Stamina / Daya Tahan Fisik & Kardio)**
5. **TEC (Technique / Presisi Kuda-kuda, Tendangan, & Poomsae)**
6. **DIS (Discipline / Kedisiplinan & Presensi Kehadiran)**

### Pembagian Kelompok Usia Otomatis (via `siswa.tgl_lahir`):
* **Kategori Anak-anak (< 12 tahun / Pra-Kadet)**
* **Kategori Remaja & Dewasa (≥ 12 tahun / Kadet, Junior, Senior)**

### Tabel Rubrik Konversi Hasil Tes Lapangan ke Skor (0 - 100):

| Atribut | Parameter Tes Lapangan | Kategori Anak (< 12 thn) | Kategori Remaja/Dewasa (≥ 12 thn) | Skor Dihasilkan |
|---|---|---|---|---|
| **STR** | Push-up + Sit-up (1 Menit) | < 10 kali<br>10 - 18 kali<br>19 - 28 kali<br>≥ 29 kali | < 15 kali<br>15 - 25 kali<br>26 - 38 kali<br>≥ 39 kali | 50 - 65<br>66 - 75<br>76 - 85<br>86 - 100 |
| **AGI** | Kicking Speed *Dollyo Chagi* bolak-balik (30 Detik) | < 22 tendangan<br>22 - 30 tendangan<br>31 - 40 tendangan<br>≥ 41 tendangan | < 25 tendangan<br>25 - 34 tendangan<br>35 - 44 tendangan<br>≥ 45 tendangan | 50 - 65<br>66 - 75<br>76 - 85<br>86 - 100 |
| **FLX** | Jarak Pangkal Paha ke Lantai (*Side / Front Split*) | > 20 cm<br>10 - 20 cm<br>3 - 9 cm<br>0 cm (Flat Split) | > 20 cm<br>10 - 20 cm<br>3 - 9 cm<br>0 cm (Flat Split) | 50 - 65<br>66 - 75<br>76 - 85<br>86 - 100 |
| **STA** | Skipping / *Jumping Jack* Nonstop | < 1 menit<br>1 - 1.5 menit<br>1.5 - 2 menit ritme teratur<br>≥ 2 menit ritme cepat | < 1.5 menit<br>1.5 - 2 menit<br>2 menit ritme cepat<br>≥ 3 menit / bleep level tinggi | 50 - 65<br>66 - 75<br>76 - 85<br>86 - 100 |
| **TEC** | Observasi Kuda-kuda, Snapping, & Keseimbangan | 1-2 Bintang (Dasar goyah)<br>3 Bintang (Form benar, snap kurang)<br>4 Bintang (Kuda-kuda kokoh, snap kuat)<br>5 Bintang (Sangat matang & presisi) | Sama | 50 - 65<br>66 - 75<br>76 - 85<br>86 - 100 |
| **DIS** | Presensi Otomatis (50%) + Nilai Sikap Pelatih (50%) | Formula: `(Hadir / Total Sesi * 100) * 0.5 + (Nilai Sikap * 0.5)` | Sama | 0 - 100 |

---

## 3. Skema Database & Migrasi (Supabase)

Migrasi baru: `supabase/migrations/028_siger_athlete_stats.sql`

```sql
-- Tambah kolom 6 atribut & metadata kalkulasi
ALTER TABLE penilaian_atlet
  ADD COLUMN IF NOT EXISTS skor_str INT DEFAULT 75 CHECK (skor_str BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS skor_agi INT DEFAULT 75 CHECK (skor_agi BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS skor_flx INT DEFAULT 75 CHECK (skor_flx BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS skor_sta INT DEFAULT 75 CHECK (skor_sta BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS skor_tec INT DEFAULT 75 CHECK (skor_tec BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS skor_dis INT DEFAULT 85 CHECK (skor_dis BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS ovr_score INT DEFAULT 78 CHECK (ovr_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS archetype TEXT DEFAULT 'All-Rounder Fighter',
  ADD COLUMN IF NOT EXISTS raw_test_data JSONB DEFAULT '{}'::jsonb;

-- Trigger atau fungsi sinkronisasi kolom lama (backward compatibility)
CREATE OR REPLACE FUNCTION sync_legacy_penilaian_atlet_scores()
RETURNS TRIGGER AS $$
BEGIN
  -- Jika skor baru diupdate, isi kolom pilar lama
  IF NEW.skor_str IS NOT NULL THEN
    NEW.skor_fisik := ROUND((NEW.skor_str + NEW.skor_agi + NEW.skor_flx + NEW.skor_sta) / 4.0);
    NEW.skor_kyorugi := ROUND((NEW.skor_agi + NEW.skor_str) / 2.0);
    NEW.skor_poomsae := NEW.skor_tec;
    NEW.skor_disiplin := NEW.skor_dis;
    NEW.ovr_score := ROUND((NEW.skor_str + NEW.skor_agi + NEW.skor_flx + NEW.skor_sta + NEW.skor_tec + NEW.skor_dis) / 6.0);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_penilaian_scores ON penilaian_atlet;
CREATE TRIGGER trg_sync_penilaian_scores
BEFORE INSERT OR UPDATE ON penilaian_atlet
FOR EACH ROW
EXECUTE FUNCTION sync_legacy_penilaian_atlet_scores();
```

---

## 4. Logika Kalkulasi & Gelar Atlet (`lib/athlete-stats.ts`)

File utilitas murni untuk komputasi:
1. **`calculateAge(tglLahir: string): number`**: Menghitung usia akurat berdasarkan tanggal saat ini.
2. **`convertRawTestToScore(...)`**: Mengonversi nilai mentah tes fisik menjadi skor 0–100 berdasarkan usia.
3. **`calculateOVR(scores: SixAttributes): number`**: Menghitung rata-rata OVR dan mengembalikan tier (S / A / B / C).
4. **`determineArchetype(scores: SixAttributes): string`**:
   * Jika selisih nilai tertinggi dan terendah ≤ 7: `"All-Rounder Fighter"`
   * Jika AGI tertinggi: `"⚡ Speed Striker"`
   * Jika STR tertinggi: `"💥 Power Kicker"`
   * Jika FLX tertinggi: `"🤸 Flex Master"`
   * Jika STA tertinggi: `"🫁 Iron Engine"`
   * Jika TEC tertinggi: `"🥋 Poomsae Specialist"`
   * Jika DIS tertinggi: `"⭐ Disciplined Guardian"`
5. **`generateLevelUpMissions(scores: SixAttributes): LevelUpMission[]`**:
   Menganalisis 1-2 atribut terendah dan memetakan aksi latihan mandiri di rumah.

---

## 5. Alur & Antarmuka Pengguna (UI/UX)

### A. Portal Pelatih (`/pelatih/raport`)
* **List Siswa Periode:** Menampilkan status input raport, nilai OVR jika sudah dinilai, dan badge archetype.
* **Modal Penilaian:**
  * Header menampilkan foto, nama, sabuk, usia siswa, dan ringkasan presensi latihan bulan itu.
  * Tombol switch: **Mode Slider Cepat** vs **Kalkulator Tes Fisik**.
  * Di dalam kalkulator:
    * Form input: Push-up (kali), Kicking speed 30 detik (kali), Split (cm), Skipping (menit/detik), Bintang teknik (1–5).
    * Tombol *"Hitung & Terapkan Skor"* $\rightarrow$ otomatis mengisi 6 slider atribut, mengupdate OVR secara instan.
  * Catatan Pelatih & Dropdown Rekomendasi (Siap Ujian Sabuk, Siap Tanding Kyorugi, Siap Poomsae, Penguatan Fisik).

### B. Portal Siswa & Orang Tua (`/ortu/dashboard` & `/ortu/laporan`)
* **Siger Athlete Card:**
  * Desain neo-brutalist (tebal, tegas, berkarakter).
  * Menampilkan: Foto Siswa, Sabuk, Badge OVR (Besar), Gelar Archetype.
  * Grid 6 Mini Stat (STR, AGI, FLX, STA, TEC, DIS).
* **Interactive Hexagon Radar Chart:**
  * Menggunakan `recharts` `<RadarChart>` dengan sumbu 6 atribut.
  * Warna tema aksen Siger (Kuning/Emas `#f59e0b` atau primary neon).
* **Misi Level Up (Fokus Peningkatan):**
  * Kartu saran latihan terukur untuk mendongkrak stat terendah siswa.
* **Share WhatsApp:**
  * Menyusun ringkasan kartu statistik berformat teks estetik dengan emotikon untuk dikirim langsung via WhatsApp.

---

## 6. Penanganan Kasus Khusus (Edge Cases & Resilience)

1. **Presensi Nol / Siswa Baru:** Jika sesi latihan di bulan tersebut 0, pembagi presensi di-bypass sehingga skor DIS diambil langsung dari nilai sikap pelatih tanpa error `NaN`.
2. **Data Historis (Raport Bulan Lalu):** Jika data lama dibuka, fallback mapper otomatis memetakan kolom 4 pilar lama ke 6 atribut agar grafik radar tidak kosong atau pecah.
3. **Data Tanggal Lahir Kosong:** Jika tanggal lahir belum diisi, default jatuh ke kategori *Anak-anak* secara aman.
4. **Client & DB Range Checks:** Seluruh nilai diproteksi dalam rentang 0 hingga 100.

---

## 7. Struktur Komponen & File Baru

```
siger-tkd-manager/
├── supabase/
│   └── migrations/
│       └── 028_siger_athlete_stats.sql
├── src/
│   ├── lib/
│   │   ├── types.ts                     (Update interface PenilaianAtlet)
│   │   └── athlete-stats.ts             (Kalkulator, rubrik usia, archetype, tips misi)
│   ├── components/
│   │   └── atlet/
│   │       ├── AthleteCard.tsx          (Kartu profil atlet OVR + Archetype)
│   │       ├── AthleteRadarChart.tsx    (Hexagon Radar Chart dengan Recharts)
│   │       ├── LevelUpMission.tsx       (Kartu saran latihan peningkatan atribut)
│   │       └── TestCalculatorModal.tsx  (Modal stopwatch & input tes fisik lapangan)
│   └── app/
│       ├── pelatih/raport/page.tsx      (Integrasi kalkulator & 6 atribut)
│       ├── ortu/dashboard/page.tsx      (Widget Athlete Card baru)
│       └── ortu/laporan/page.tsx        (Detail radar chart & misi level up)
```
