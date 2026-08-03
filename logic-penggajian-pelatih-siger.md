# Logic Sistem Penggajian Pelatih — Siger Taekwondo Club Manager

## 1. Prinsip Perhitungan

Honor pelatih dihitung **berbasis kontribusi revenue per jenis kelas**, bukan flat rate. Kelas spesialis (Rp200rb) menyumbang revenue lebih besar per siswa dibanding kelas umum (Rp100rb), jadi rate per sesi mengajar juga harus berbeda mengikuti proporsi revenue kelas tersebut.

Alur perhitungan tiap akhir bulan:

1. Hitung total iuran yang **sudah dibayar** (bukan tagihan) bulan berjalan.
2. Alokasikan total iuran ke 5 bucket (persentase configurable):
   - Coach Pool: 45%
   - Operasional: 18%
   - Dana Cadangan: 17%
   - Pengembangan Klub: 12%
   - Margin Founder: 8%
3. Coach Pool dipecah lagi per jenis kelas, proporsional terhadap revenue kelas tersebut.
4. Rate per sesi = (Coach Pool jenis kelas) ÷ (jumlah sesi kelas tersebut bulan itu, status "completed").
5. Honor per pelatih = Σ (jumlah sesi yang dia ajar di kelas X × rate per sesi kelas X).
6. Kepala Pelatih dapat honor mengajar (poin 5) **+** Margin Founder (poin 2) sebagai baris terpisah — supaya jelas mana honor mengajar, mana hak kepemilikan.

## 2. Skema Database (Supabase / Postgres)

```sql
-- Master pelatih
create table coaches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text not null check (role in ('head_coach','core_coach','assistant_coach')),
  is_founder boolean default false,
  active boolean default true,
  created_at timestamptz default now()
);

-- Master jenis kelas
create table classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,               -- 'Kelas Umum' / 'Kelas Spesialis'
  monthly_fee numeric not null,     -- 100000 / 200000
  sessions_per_week int not null,   -- 1 / 2
  active boolean default true
);

-- Master siswa
create table students (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  class_id uuid references classes(id),
  status text not null check (status in ('active','inactive')) default 'active',
  joined_at date default current_date
);

-- Pembayaran iuran bulanan
create table payments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id),
  period date not null,             -- pakai tanggal 1 tiap bulan, misal '2026-08-01'
  amount numeric not null,
  status text not null check (status in ('paid','pending','overdue')) default 'pending',
  paid_at timestamptz
);

-- Sesi latihan (jadwal + realisasi kehadiran mengajar)
create table sessions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid references classes(id),
  coach_id uuid references coaches(id),
  session_date date not null,
  status text not null check (status in ('scheduled','completed','cancelled')) default 'scheduled'
);

-- Konfigurasi alokasi bucket (bisa diubah dari admin panel)
create table payroll_config (
  id int primary key default 1,
  coach_pool_pct numeric not null default 0.45,
  operational_pct numeric not null default 0.18,
  reserve_pct numeric not null default 0.17,
  development_pct numeric not null default 0.12,
  founder_margin_pct numeric not null default 0.08,
  constraint check_total check (
    coach_pool_pct + operational_pct + reserve_pct + development_pct + founder_margin_pct = 1
  )
);

-- Hasil perhitungan payroll per bulan (snapshot, jangan dihitung ulang on-the-fly di UI report)
create table payroll_runs (
  id uuid primary key default gen_random_uuid(),
  period date not null,             -- '2026-08-01'
  total_income numeric not null,
  coach_pool_amount numeric not null,
  operational_amount numeric not null,
  reserve_amount numeric not null,
  development_amount numeric not null,
  founder_margin_amount numeric not null,
  generated_at timestamptz default now(),
  unique(period)
);

-- Detail honor per pelatih per bulan
create table payroll_details (
  id uuid primary key default gen_random_uuid(),
  payroll_run_id uuid references payroll_runs(id),
  coach_id uuid references coaches(id),
  sessions_taught int not null,
  teaching_honor numeric not null,
  founder_margin_share numeric default 0,
  total_payout numeric not null
);
```

## 3. Logic Perhitungan (pseudocode, jadi acuan Edge Function / API route)

```
function generatePayroll(period):
  # 1. Total income bulan itu
  paidPayments = payments.where(period = period, status = 'paid')
  totalIncome = sum(paidPayments.amount)

  # 2. Alokasi bucket
  config = payroll_config.get()
  coachPool = totalIncome * config.coach_pool_pct
  operational = totalIncome * config.operational_pct
  reserve = totalIncome * config.reserve_pct
  development = totalIncome * config.development_pct
  founderMargin = totalIncome * config.founder_margin_pct

  # 3. Revenue per kelas (untuk proporsi pool)
  for each class in classes.active:
    activeStudents = students.count(class_id = class.id, status = 'active')
    classRevenue[class.id] = activeStudents * class.monthly_fee
  totalClassRevenue = sum(classRevenue.values())

  # 4. Pool per kelas + rate per sesi
  for each class in classes.active:
    classPool[class.id] = coachPool * (classRevenue[class.id] / totalClassRevenue)
    completedSessions = sessions.count(class_id = class.id, period = period, status = 'completed')
    ratePerSession[class.id] = completedSessions > 0 ? classPool[class.id] / completedSessions : 0

  # 5. Honor per pelatih
  for each coach in coaches.active:
    coachSessions = sessions.where(coach_id = coach.id, period = period, status = 'completed')
    teachingHonor = 0
    sessionCount = 0
    for session in coachSessions:
      teachingHonor += ratePerSession[session.class_id]
      sessionCount += 1

    founderShare = coach.is_founder ? founderMargin : 0
    totalPayout = teachingHonor + founderShare

    save payroll_details(coach.id, sessionCount, teachingHonor, founderShare, totalPayout)

  save payroll_runs(period, totalIncome, coachPool, operational, reserve, development, founderMargin)
```

## 4. Milestone otomatis (notifikasi growth)

Tambahkan trigger sederhana: setiap payroll_run dibuat, cek jumlah `students.active`:

| Ambang siswa aktif | Notifikasi yang muncul di dashboard |
|---|---|
| ≥ 30 | "Coach pool sudah stabil, evaluasi kenaikan rate per sesi" |
| ≥ 40 | "Pertimbangkan promosi asisten pelatih jadi pelatih inti dibayar" |
| ≥ 50 | "Coach pool cukup besar, evaluasi skema gaji semi-tetap untuk pelatih inti" |

---

# PROMPT UNTUK ANTIGRAVITY (vibe coding)

Salin blok di bawah ini langsung ke Antigravity. Sesuaikan bagian `[SESUAIKAN]` dengan struktur project kamu yang sudah ada.

```
Saya sedang membangun fitur "Sistem Penggajian Pelatih (Payroll)" di dalam aplikasi Siger Taekwondo Club Manager (stack: Next.js + Supabase, sudah ada tabel students, classes, sessions, coaches — [SESUAIKAN nama tabel jika berbeda]).

Tolong buatkan fitur payroll dengan logic sebagai berikut:

KONTEKS BISNIS:
- Income klub hanya dari iuran bulanan siswa, dibagi 2 jenis kelas dengan harga berbeda.
- Honor pelatih dihitung per sesi mengajar, dengan rate yang berbeda tiap jenis kelas — bukan flat rate. Rate ditentukan dari proporsi revenue kelas tersebut terhadap total pool honor pelatih.
- Sebagian pelatih adalah founder/kepala pelatih dan berhak atas margin tambahan di luar honor mengajar.

YANG PERLU DIBUATKAN:

1. Skema database (tabel `payroll_config`, `payroll_runs`, `payroll_details`) mengikuti struktur berikut:
[TEMPEL skema SQL dari bagian 2 dokumen ini]

2. Function/API route `generatePayroll(period)` yang menjalankan logic berikut:
[TEMPEL pseudocode dari bagian 3 dokumen ini]

3. Halaman admin "Payroll" dengan:
   - Tombol "Generate Payroll Bulan Ini" (memanggil generatePayroll untuk periode berjalan)
   - Tabel ringkasan alokasi bucket (coach pool, operasional, cadangan, pengembangan, margin founder) untuk bulan yang dipilih
   - Tabel detail honor per pelatih: nama, jumlah sesi diajar, honor mengajar, margin founder (jika ada), total payout
   - Riwayat payroll bulan-bulan sebelumnya (dari tabel payroll_runs), bisa diklik untuk lihat detail
   - Setting sederhana untuk mengubah persentase alokasi bucket (dari tabel payroll_config), dengan validasi total harus 100%

4. Notifikasi milestone growth di dashboard utama:
   - Jika jumlah siswa aktif ≥ 30/40/50, tampilkan banner saran evaluasi sesuai tabel berikut:
[TEMPEL tabel milestone dari bagian 4 dokumen ini]

CATATAN PENTING:
- Perhitungan payroll harus disimpan sebagai snapshot (payroll_runs/payroll_details), TIDAK dihitung ulang otomatis tiap kali halaman dibuka — supaya angka historis tidak berubah kalau ada perubahan data siswa/kelas belakangan.
- Hanya payment dengan status 'paid' yang dihitung sebagai income, jangan hitung yang masih 'pending'/'overdue'.
- Hanya session dengan status 'completed' yang dihitung sebagai sesi mengajar, jangan hitung yang 'scheduled' atau 'cancelled'.
- Buat UI-nya konsisten dengan design system yang sudah ada di project ini [SESUAIKAN — sebutkan komponen/style library yang sudah dipakai, misal shadcn/ui, Tailwind, dll].
```

---

**Tips pemakaian prompt ini di Antigravity:**
1. Jalankan dulu bagian skema SQL sebagai migration terpisah, cek dulu apakah tidak konflik dengan tabel yang sudah ada.
2. Baru minta Antigravity generate API route dan UI-nya, supaya lebih terkontrol dan gampang di-debug per tahap.
3. Setelah fitur jadi, test dengan data dummy dulu (misal 10 siswa, 3 pelatih) sebelum dipakai untuk data riil, supaya kamu bisa verifikasi angka honor sesuai perhitungan manual yang sudah kita bahas.
