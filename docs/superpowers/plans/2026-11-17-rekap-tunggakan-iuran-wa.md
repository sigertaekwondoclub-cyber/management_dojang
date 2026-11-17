# Rekap Tunggakan Iuran & Pesan Tagihan WhatsApp Siswa Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement multi-month unpaid dues tracking calculated from each student's joining date (`tgl_gabung`) up to the active filter period, integrated with dual attendance metrics (current month and cumulative unpaid period) and automated WhatsApp message formatting in the Admin Laporan dashboard.

**Architecture:** 
1. Encapsulate business logic into a pure, testable utility module (`src/lib/tunggakan.ts`) that handles month sequence expansion, unpaid status resolution, cumulative attendance aggregation, and WhatsApp message templating.
2. Integrate this utility into `src/app/admin/laporan/page.tsx` within `fetchTagihan` by querying student join dates and historical iuran/absensi records.
3. Enhance the UI with quick filters (`Menunggak > 1 Bulan`), status badges, and enhanced CSV export.

**Tech Stack:** Next.js 14 (App Router), TypeScript 5, Supabase Client, Tailwind CSS, Node.js native TypeScript test runner (`--experimental-strip-types`).

## Global Constraints
- Do not modify database schemas or execute migrations; rely on existing `siswa`, `iuran`, and `absensi_siswa` tables.
- Keep calculations bounded (maximum 24 months back for `tgl_gabung` safeguard).
- Preserve existing styling conventions (brutalism theme, `font-sans`, `Badge`, `Card`, `Button`).
- All code changes must compile cleanly via `npm run build`.

---

### Task 1: Core Tunggakan Calculation & WhatsApp Templating Module

**Files:**
- Create: `src/lib/tunggakan.ts`
- Test: `src/lib/__tests__/tunggakan.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export interface ItemTunggakanBulan {
    bulan: number
    tahun: number
    namaBulan: string
    nominal: number
    status: 'belum_bayar' | 'ditolak'
    iuranId?: string
  }

  export interface SiswaRekapTagihanExtended {
    id: string
    nama: string
    no_hp_ortu: string
    programKelas: string
    tglGabung: string
    hadir: number
    izin: number
    sakit: number
    alpha: number
    totalSesi: number
    persen: number
    statusIuran: string
    nominalIuran: number
    iuranId?: string
    riwayat: {
      id: string
      tgl: string
      kelas: string
      status_hadir: 'hadir' | 'izin' | 'sakit' | 'alpha'
      pelatih_nama: string
    }[]
    daftarTunggakan: ItemTunggakanBulan[]
    totalBulanMenunggak: number
    totalNominalTunggakan: number
    totalHadirTunggakan: number
    totalSesiTunggakan: number
  }

  export interface ClubSettingsInfo {
    nama_club: string | null
    rekening_bank: string | null
    rekening_nomor: string | null
    rekening_atas_nama: string | null
  }

  export function hitungTunggakanSiswa(params: {
    siswa: {
      id: string
      nama: string
      no_hp_ortu?: string | null
      tgl_gabung?: string | null
      program_kelas?: { nama_program?: string; biaya_bulanan?: number } | null
    }
    iuranRows: {
      id: string
      siswa_id: string
      bulan: number
      tahun: number
      nominal: number
      status_bayar: string
    }[]
    absensiRows: {
      id: string
      siswa_id: string
      tgl: string
      kelas: string
      status_hadir: string
      pelatih_nama?: string
    }[]
    filterBulan: number
    filterTahun: number
  }): SiswaRekapTagihanExtended

  export function generatePesanTagihan(siswa: SiswaRekapTagihanExtended, clubSettings: ClubSettingsInfo | null, filterBulan: number, filterTahun: number): string
  export function generatePesanRekapLengkap(siswa: SiswaRekapTagihanExtended, clubSettings: ClubSettingsInfo | null, filterBulan: number, filterTahun: number): string
  export function generateTeksSalinSemuaBelumBayar(list: SiswaRekapTagihanExtended[], filterBulan: number, filterTahun: number): string
  ```

- [ ] **Step 1: Write unit tests covering tunggakan calculations and message formats**

Create `src/lib/__tests__/tunggakan.test.ts`:
```typescript
import assert from 'node:assert'
import {
  hitungTunggakanSiswa,
  generatePesanTagihan,
  generateTeksSalinSemuaBelumBayar
} from '../tunggakan.ts'

console.log('--- RUNNING TUNGGAKAN UNIT TESTS ---')

// Test Case 1: Student joined 3 months ago, only paid 1st month
const mockSiswa1 = {
  id: 'siswa-1',
  nama: 'Budi Santoso',
  no_hp_ortu: '08123456789',
  tgl_gabung: '2026-09-10',
  program_kelas: { nama_program: 'Reguler Prestasi', biaya_bulanan: 150000 }
}

const mockIuran1 = [
  { id: 'i-1', siswa_id: 'siswa-1', bulan: 9, tahun: 2026, nominal: 150000, status_bayar: 'lunas' },
  { id: 'i-2', siswa_id: 'siswa-1', bulan: 10, tahun: 2026, nominal: 150000, status_bayar: 'belum_bayar' }
  // Month 11 (November 2026) has not been generated yet
]

const mockAbsensi1 = [
  // November sessions (current month)
  { id: 'a-1', siswa_id: 'siswa-1', tgl: '2026-11-03', kelas: 'Reguler', status_hadir: 'hadir', pelatih_nama: 'Sabeum A' },
  { id: 'a-2', siswa_id: 'siswa-1', tgl: '2026-11-05', kelas: 'Reguler', status_hadir: 'hadir', pelatih_nama: 'Sabeum A' },
  { id: 'a-3', siswa_id: 'siswa-1', tgl: '2026-11-10', kelas: 'Reguler', status_hadir: 'izin', pelatih_nama: 'Sabeum A' },
  // October sessions (unpaid month)
  { id: 'a-4', siswa_id: 'siswa-1', tgl: '2026-10-06', kelas: 'Reguler', status_hadir: 'hadir', pelatih_nama: 'Sabeum B' },
  { id: 'a-5', siswa_id: 'siswa-1', tgl: '2026-10-13', kelas: 'Reguler', status_hadir: 'hadir', pelatih_nama: 'Sabeum B' },
  // September sessions (paid month - should NOT count toward unpaid attendance)
  { id: 'a-6', siswa_id: 'siswa-1', tgl: '2026-09-15', kelas: 'Reguler', status_hadir: 'hadir', pelatih_nama: 'Sabeum B' }
]

const res1 = hitungTunggakanSiswa({
  siswa: mockSiswa1,
  iuranRows: mockIuran1,
  absensiRows: mockAbsensi1,
  filterBulan: 11,
  filterTahun: 2026
})

assert.strictEqual(res1.totalBulanMenunggak, 2, 'Should have 2 unpaid months (Oct & Nov)')
assert.strictEqual(res1.totalNominalTunggakan, 300000, 'Total debt should be 300,000')
assert.strictEqual(res1.hadir, 2, 'November attendance count should be 2')
assert.strictEqual(res1.totalSesi, 3, 'November total sessions should be 3')
assert.strictEqual(res1.totalHadirTunggakan, 4, 'Cumulative attendance across Oct & Nov should be 4')

// Test WhatsApp formatting
const waMsg = generatePesanTagihan(res1, {
  nama_club: 'Siger Taekwondo Club',
  rekening_bank: 'BCA',
  rekening_nomor: '1234567890',
  rekening_atas_nama: 'Siger TC'
}, 11, 2026)

assert.ok(waMsg.includes('Budi Santoso'), 'Message should contain student name')
assert.ok(waMsg.includes('2 Bulan'), 'Message should mention 2 Bulan')
assert.ok(waMsg.includes('Rp 300.000'), 'Message should contain formatted Rp 300.000')
assert.ok(waMsg.includes('1234567890'), 'Message should contain bank account')

console.log('✅ ALL TUNGGAKAN UNIT TESTS PASSED!')
```

- [ ] **Step 2: Run test to verify it fails initially**

Run: `node --experimental-strip-types src/lib/__tests__/tunggakan.test.ts`
Expected: FAIL (Cannot find module `../tunggakan.ts`)

- [ ] **Step 3: Implement `src/lib/tunggakan.ts`**

Write implementation in `src/lib/tunggakan.ts`:
```typescript
export const BULAN_NAMES = [
  '',
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember'
]

export function formatRupiah(n: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(n)
}

export interface ItemTunggakanBulan {
  bulan: number
  tahun: number
  namaBulan: string
  nominal: number
  status: 'belum_bayar' | 'ditolak'
  iuranId?: string
}

export interface SiswaRekapTagihanExtended {
  id: string
  nama: string
  no_hp_ortu: string
  programKelas: string
  tglGabung: string
  hadir: number
  izin: number
  sakit: number
  alpha: number
  totalSesi: number
  persen: number
  statusIuran: string
  nominalIuran: number
  iuranId?: string
  riwayat: {
    id: string
    tgl: string
    kelas: string
    status_hadir: 'hadir' | 'izin' | 'sakit' | 'alpha'
    pelatih_nama: string
  }[]
  daftarTunggakan: ItemTunggakanBulan[]
  totalBulanMenunggak: number
  totalNominalTunggakan: number
  totalHadirTunggakan: number
  totalSesiTunggakan: number
}

export interface ClubSettingsInfo {
  nama_club: string | null
  rekening_bank: string | null
  rekening_nomor: string | null
  rekening_atas_nama: string | null
}

export function hitungTunggakanSiswa(params: {
  siswa: {
    id: string
    nama: string
    no_hp_ortu?: string | null
    tgl_gabung?: string | null
    program_kelas?: { nama_program?: string; biaya_bulanan?: number } | null
  }
  iuranRows: {
    id: string
    siswa_id: string
    bulan: number
    tahun: number
    nominal: number
    status_bayar: string
  }[]
  absensiRows: {
    id: string
    siswa_id: string
    tgl: string
    kelas: string
    status_hadir: string
    pelatih_nama?: string
  }[]
  filterBulan: number
  filterTahun: number
}): SiswaRekapTagihanExtended {
  const { siswa, iuranRows, absensiRows, filterBulan, filterTahun } = params
  const defaultBiaya = siswa.program_kelas?.biaya_bulanan || 100000
  const programNama = siswa.program_kelas?.nama_program || 'Umum'

  // 1. Tentukan Bulan Awal berdasarkan tgl_gabung (maksimal 24 bulan ke belakang)
  const maxLookbackMonths = 24
  const targetDate = new Date(filterTahun, filterBulan - 1, 1)

  let startDate: Date
  if (siswa.tgl_gabung) {
    const rawJoin = new Date(siswa.tgl_gabung)
    if (!isNaN(rawJoin.getTime())) {
      startDate = new Date(rawJoin.getFullYear(), rawJoin.getMonth(), 1)
    } else {
      startDate = new Date(filterTahun, filterBulan - 1, 1)
    }
  } else {
    startDate = new Date(filterTahun, filterBulan - 1, 1)
  }

  // Batasi agar tidak lebih awal dari targetDate - maxLookbackMonths
  const earliestAllowed = new Date(filterTahun, filterBulan - 1 - maxLookbackMonths, 1)
  if (startDate < earliestAllowed) {
    startDate = earliestAllowed
  }

  // Jika startDate lebih besar dari targetDate (siswa gabung di masa depan), samakan dengan targetDate
  if (startDate > targetDate) {
    startDate = targetDate
  }

  // 2. Loop setiap bulan dari startDate sampai targetDate
  const daftarTunggakan: ItemTunggakanBulan[] = []
  const currentIter = new Date(startDate)

  // Map iuran siswa
  const siswaIuranMap = new Map<string, (typeof iuranRows)[0]>()
  for (const iur of iuranRows) {
    if (iur.siswa_id === siswa.id) {
      siswaIuranMap.set(`${iur.tahun}-${iur.bulan}`, iur)
    }
  }

  let statusPeriodeIni = 'belum_bayar'
  let nominalPeriodeIni = defaultBiaya
  let iuranIdPeriodeIni: string | undefined = undefined

  while (currentIter <= targetDate) {
    const b = currentIter.getMonth() + 1
    const y = currentIter.getFullYear()
    const key = `${y}-${b}`
    const existingIur = siswaIuranMap.get(key)

    const isCurrentPeriod = b === filterBulan && y === filterTahun

    if (existingIur) {
      if (isCurrentPeriod) {
        statusPeriodeIni = existingIur.status_bayar
        nominalPeriodeIni = Number(existingIur.nominal) || defaultBiaya
        iuranIdPeriodeIni = existingIur.id
      }

      if (existingIur.status_bayar === 'belum_bayar' || existingIur.status_bayar === 'ditolak') {
        daftarTunggakan.push({
          bulan: b,
          tahun: y,
          namaBulan: BULAN_NAMES[b],
          nominal: Number(existingIur.nominal) || defaultBiaya,
          status: existingIur.status_bayar as 'belum_bayar' | 'ditolak',
          iuranId: existingIur.id
        })
      }
    } else {
      // Tidak ada data iuran di DB -> otomatis dihitung menunggak
      if (isCurrentPeriod) {
        statusPeriodeIni = 'belum_bayar'
        nominalPeriodeIni = defaultBiaya
      }

      daftarTunggakan.push({
        bulan: b,
        tahun: y,
        namaBulan: BULAN_NAMES[b],
        nominal: defaultBiaya,
        status: 'belum_bayar'
      })
    }

    // Maju ke bulan berikutnya
    currentIter.setMonth(currentIter.getMonth() + 1)
  }

  const totalBulanMenunggak = daftarTunggakan.length
  const totalNominalTunggakan = daftarTunggakan.reduce((acc, curr) => acc + curr.nominal, 0)

  // 3. Hitung Absensi Periode Terpilih
  const siswaAbsensi = absensiRows.filter(a => a.siswa_id === siswa.id)
  const currentMonthAbsensi = siswaAbsensi.filter(a => {
    const d = new Date(a.tgl)
    return d.getMonth() + 1 === filterBulan && d.getFullYear() === filterTahun
  })

  const hadir = currentMonthAbsensi.filter(a => a.status_hadir === 'hadir').length
  const izin = currentMonthAbsensi.filter(a => a.status_hadir === 'izin').length
  const sakit = currentMonthAbsensi.filter(a => a.status_hadir === 'sakit').length
  const alpha = currentMonthAbsensi.filter(a => a.status_hadir === 'alpha').length
  const totalSesi = currentMonthAbsensi.length
  const persen = totalSesi > 0 ? Math.round((hadir / totalSesi) * 100) : 0

  // 4. Hitung Absensi Kumulatif Selama Periode Menunggak
  const unpaidYearMonthSet = new Set(daftarTunggakan.map(t => `${t.tahun}-${t.bulan}`))
  const unpaidAbsensi = siswaAbsensi.filter(a => {
    const d = new Date(a.tgl)
    return unpaidYearMonthSet.has(`${d.getFullYear()}-${d.getMonth() + 1}`)
  })
  const totalHadirTunggakan = unpaidAbsensi.filter(a => a.status_hadir === 'hadir').length
  const totalSesiTunggakan = unpaidAbsensi.length

  return {
    id: siswa.id,
    nama: siswa.nama,
    no_hp_ortu: siswa.no_hp_ortu || '',
    programKelas: programNama,
    tglGabung: siswa.tgl_gabung || '',
    hadir,
    izin,
    sakit,
    alpha,
    totalSesi,
    persen,
    statusIuran: statusPeriodeIni,
    nominalIuran: nominalPeriodeIni,
    iuranId: iuranIdPeriodeIni,
    riwayat: currentMonthAbsensi.map(a => ({
      id: a.id,
      tgl: a.tgl,
      kelas: a.kelas,
      status_hadir: a.status_hadir as 'hadir' | 'izin' | 'sakit' | 'alpha',
      pelatih_nama: a.pelatih_nama || 'Pelatih'
    })),
    daftarTunggakan,
    totalBulanMenunggak,
    totalNominalTunggakan,
    totalHadirTunggakan,
    totalSesiTunggakan
  }
}

export function generatePesanTagihan(
  siswa: SiswaRekapTagihanExtended,
  clubSettings: ClubSettingsInfo | null,
  filterBulan: number,
  filterTahun: number
): string {
  const bul = BULAN_NAMES[filterBulan]
  const clubName = clubSettings?.nama_club || 'Siger Taekwondo Club'
  const bank = clubSettings?.rekening_bank || 'BCA / BRI / Mandiri'
  const noRek = clubSettings?.rekening_nomor || '-'
  const an = clubSettings?.rekening_atas_nama || clubName

  let rincianTunggakanText = ''
  if (siswa.totalBulanMenunggak > 1) {
    const itemLines = siswa.daftarTunggakan.map(item => {
      const isCurrent = item.bulan === filterBulan && item.tahun === filterTahun
      const label = `${item.namaBulan} ${item.tahun}`
      return `  - ${label}: ${formatRupiah(item.nominal)}${isCurrent ? ' (Bulan Berjalan)' : ''}`
    }).join('\n')

    rincianTunggakanText =
      `💰 *RINCIAN TAGIHAN IURAN*:\n` +
      `• Jumlah Tunggakan: *${siswa.totalBulanMenunggak} Bulan*\n` +
      `• Rincian Periode:\n${itemLines}\n` +
      `----------------------------------\n` +
      `💵 *TOTAL TAGIHAN*: *${formatRupiah(siswa.totalNominalTunggakan)}*\n`
  } else {
    const nominal = siswa.totalNominalTunggakan > 0 ? siswa.totalNominalTunggakan : siswa.nominalIuran
    rincianTunggakanText =
      `💰 *RINCIAN TAGIHAN IURAN*:\n` +
      `• Tagihan ${bul} ${filterTahun}: *${formatRupiah(nominal)}*\n`
  }

  let kehadiranKumulatifText = ''
  if (siswa.totalBulanMenunggak > 1 && siswa.totalSesiTunggakan > 0) {
    kehadiranKumulatifText = `• Kehadiran Selama Periode Menunggak: *${siswa.totalHadirTunggakan}x latihan*\n`
  }

  return (
    `🥋 *PEMBERITAHUAN TAGIHAN IURAN BULANAN*\n*${clubName.toUpperCase()}*\n\n` +
    `Kepada Yth. Orang Tua / Wali Siswa\n` +
    `👤 *Nama Siswa*: ${siswa.nama}\n` +
    `🥋 *Program*: Kelas ${siswa.programKelas}\n` +
    `📅 *Periode Tagihan*: ${bul} ${filterTahun}\n\n` +
    `${rincianTunggakanText}` +
    `📌 *Status*: ⏳ Belum Lunas\n\n` +
    `📊 *REKAP KEHADIRAN LATIHAN*:\n` +
    `• Bulan Ini (${bul} ${filterTahun}): *${siswa.hadir}x hadir* dari ${siswa.totalSesi} sesi (${siswa.persen}%)\n` +
    `  (Izin: ${siswa.izin}x | Sakit: ${siswa.sakit}x | Alpha: ${siswa.alpha}x)\n` +
    `${kehadiranKumulatifText}\n` +
    `💳 *Rekening Pembayaran*:\n` +
    `• Bank: ${bank}\n` +
    `• No. Rekening: *${noRek}*\n` +
    `• Atas Nama: ${an}\n\n` +
    `_Mohon untuk melakukan konfirmasi & upload bukti transfer melalui portal wali murid atau kirimkan balasan ke pesan ini setelah melakukan pembayaran._\n\n` +
    `Terima kasih atas kerja sama dan dukungannya. 🙏🥋`
  )
}

export function generatePesanRekapLengkap(
  siswa: SiswaRekapTagihanExtended,
  clubSettings: ClubSettingsInfo | null,
  filterBulan: number,
  filterTahun: number
): string {
  const bul = BULAN_NAMES[filterBulan]
  const clubName = clubSettings?.nama_club || 'Siger Taekwondo Club'
  const statusLabel: Record<string, string> = {
    lunas: '✅ LUNAS',
    belum_bayar: '⏳ BELUM DIBAYAR',
    menunggu_verifikasi: '🔍 MENUNGGU VERIFIKASI ADMIN',
    ditolak: '❌ DITOLAK (Silakan Upload Ulang)'
  }

  let infoTunggakan = ''
  if (siswa.totalBulanMenunggak > 1) {
    infoTunggakan = `• Total Tunggakan: *${siswa.totalBulanMenunggak} Bulan* (${formatRupiah(siswa.totalNominalTunggakan)})\n`
  }

  return (
    `📊 *LAPORAN BULANAN SISWA*\n*${clubName.toUpperCase()}*\n\n` +
    `👤 *Nama Siswa*: ${siswa.nama}\n` +
    `🥋 *Program*: ${siswa.programKelas}\n` +
    `📅 *Periode*: ${bul} ${filterTahun}\n\n` +
    `🥋 *REKAP KEHADIRAN*:\n` +
    `• Total Kehadiran: *${siswa.hadir}x* dari ${siswa.totalSesi} sesi (${siswa.persen}%)\n` +
    `• Izin: ${siswa.izin}x | Sakit: ${siswa.sakit}x | Alpha: ${siswa.alpha}x\n\n` +
    `💰 *STATUS IURAN BULANAN*:\n` +
    `• Tagihan Periode Ini: *${formatRupiah(siswa.nominalIuran)}*\n` +
    `• Status: *${statusLabel[siswa.statusIuran] || siswa.statusIuran}*\n` +
    `${infoTunggakan}\n` +
    `Tetap semangat berlatih! 🥋🔥\n` +
    `_${clubName}_`
  )
}

export function generateTeksSalinSemuaBelumBayar(
  listBelum: SiswaRekapTagihanExtended[],
  filterBulan: number,
  filterTahun: number
): string {
  const bul = BULAN_NAMES[filterBulan]
  const totalNominal = listBelum.reduce((acc, curr) => acc + curr.totalNominalTunggakan, 0)

  let text =
    `📋 *DAFTAR SISWA BELUM BAYAR IURAN*\n` +
    `📅 Periode: ${bul} ${filterTahun}\n` +
    `👥 Total: ${listBelum.length} Siswa\n` +
    `💰 Total Tagihan Akumulasi: ${formatRupiah(totalNominal)}\n\n`

  listBelum.forEach((s, idx) => {
    const detailBulan = s.totalBulanMenunggak > 1
      ? `${s.totalBulanMenunggak} Bulan (${s.daftarTunggakan.map(d => d.namaBulan.slice(0, 3)).join(', ')})`
      : '1 Bulan'
    text += `${idx + 1}. *${s.nama}* (${s.programKelas})\n` +
      `   • Tunggakan: ${detailBulan} - ${formatRupiah(s.totalNominalTunggakan)}\n` +
      `   • Kehadiran Bulan Ini: ${s.hadir}/${s.totalSesi} sesi | WA: ${s.no_hp_ortu || '-'}\n\n`
  })

  return text
}
```

- [ ] **Step 4: Run unit test to verify it passes**

Run: `node --experimental-strip-types src/lib/__tests__/tunggakan.test.ts`
Expected: PASS (All tests pass)

- [ ] **Step 5: Commit**

```bash
git add src/lib/tunggakan.ts src/lib/__tests__/tunggakan.test.ts
git commit -m "feat: add tunggakan calculation and whatsapp templating module"
```

---

### Task 2: Integrate Tunggakan Logic into Admin Laporan Data Fetching

**Files:**
- Modify: `src/app/admin/laporan/page.tsx:250-320`

**Interfaces:**
- Consumes: `hitungTunggakanSiswa`, `generatePesanTagihan`, `generatePesanRekapLengkap`, `generateTeksSalinSemuaBelumBayar`, `SiswaRekapTagihanExtended` from `@/lib/tunggakan`
- Produces: Updated state `tagihanData: SiswaRekapTagihanExtended[]` populated with multi-month calculation

- [ ] **Step 1: Update `fetchTagihan` query to fetch `tgl_gabung` and historical iuran/absensi**

In `src/app/admin/laporan/page.tsx`:
1. Import `hitungTunggakanSiswa`, `generatePesanTagihan`, `generatePesanRekapLengkap`, `generateTeksSalinSemuaBelumBayar`, and `SiswaRekapTagihanExtended` from `@/lib/tunggakan`.
2. Update `fetchTagihan`:
   - Query `siswa`: `.select('id, nama, no_hp_ortu, tgl_gabung, program_kelas_id, program_kelas:program_kelas_id(nama_program, biaya_bulanan)')`
   - Calculate earliest date for lookback (up to 24 months before `filterTahun-filterBulan`).
   - Query `iuran`: get all records for active students with `(tahun < tah) OR (tahun == tah AND bulan <= bul)`.
   - Query `absensi_siswa`: get absensi records from the lookback date up to end of selected month.
   - For each student, call `hitungTunggakanSiswa`.
3. Update state declaration `tagihanData` to type `SiswaRekapTagihanExtended[]`.
4. Update `handleKirimWA`, `handleSalinPesan`, and `handleSalinSemuaBelumBayar` to use the imported functions.

- [ ] **Step 2: Verify compilation and tests**

Run: `npm run build`
Expected: Type checking and Next.js build pass without errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/laporan/page.tsx
git commit -m "feat: integrate multi-month tunggakan tracking into admin laporan fetch"
```

---

### Task 3: UI Sub-Filters, Badges, and CSV Export

**Files:**
- Modify: `src/app/admin/laporan/page.tsx:550-560, 660-700, 880-1015`

**Interfaces:**
- Consumes: `SiswaRekapTagihanExtended`
- Produces: Enhanced sub-filter buttons, card badges, and updated CSV export columns

- [ ] **Step 1: Add new sub-filter options and calculation counts**

In `src/app/admin/laporan/page.tsx`:
1. Calculate counts:
   - `countBelumBayar`: `tagihanData.filter(s => s.totalBulanMenunggak > 0).length`
   - `countMultiBulan`: `tagihanData.filter(s => s.totalBulanMenunggak > 1).length`
   - `countMenungguVerif`: `tagihanData.filter(s => s.statusIuran === 'menunggu_verifikasi').length`
   - `countLunas`: `tagihanData.filter(s => s.statusIuran === 'lunas' && s.totalBulanMenunggak === 0).length`
2. Update filter options:
   - `semua`: Semua Status
   - `belum_bayar`: 🔴 Belum Bayar
   - `multi_bulan`: ⚠️ Nunggak >1 Bln ({countMultiBulan})
   - `menunggu_verifikasi`: 🔍 Menunggu Verif
   - `lunas`: ✅ Lunas
3. Update filter predicate in `filteredTagihan` to handle `multi_bulan` (`s.totalBulanMenunggak > 1`).

- [ ] **Step 2: Update Card UI with badges and detailed breakdown**

In `filteredTagihan.map((s) => ...)`:
1. Header badges:
   - If `s.totalBulanMenunggak > 1`: `<Badge color="accent">⚠️ Menunggak ${s.totalBulanMenunggak} Bulan</Badge>`
   - Else if `s.statusIuran === 'lunas'`: `<Badge color="primary">✅ Lunas</Badge>`
   - Else if `s.statusIuran === 'menunggu_verifikasi'`: `<Badge color="secondary">🔍 Menunggu Verif</Badge>`
   - Else: `<Badge color="accent">⏳ Belum Bayar (1 Bln)</Badge>`
2. Tagihan info:
   - Display `formatRupiah(s.totalNominalTunggakan)`
   - If `s.totalBulanMenunggak > 1`, display: `(${s.totalBulanMenunggak} Bulan: ${s.daftarTunggakan.map(d => d.namaBulan.slice(0, 3)).join(', ')})`
3. Kehadiran info:
   - Display current month: `📅 Kehadiran: ${s.hadir}/${s.totalSesi} sesi (${s.persen}%)`
   - If `s.totalBulanMenunggak > 1` and `s.totalSesiTunggakan > 0`: `(Total ${s.totalHadirTunggakan}x hadir selama tunggakan)`

- [ ] **Step 3: Update CSV Export for Tagihan Ortu**

In `exportData`:
```typescript
downloadCSV(`tagihan-iuran-${bul}-${filterTahun}.csv`,
  filteredTagihan.map(s => [
    s.nama,
    s.programKelas,
    s.no_hp_ortu,
    s.totalBulanMenunggak,
    s.totalNominalTunggakan,
    s.daftarTunggakan.map(d => `${d.namaBulan} ${d.tahun}`).join('; ') || 'Lunas',
    s.statusIuran,
    s.hadir,
    s.totalSesi,
    `${s.persen}%`,
    s.totalHadirTunggakan
  ]),
  ['Nama Siswa', 'Program Kelas', 'No HP Ortu', 'Bulan Menunggak', 'Total Tunggakan', 'Rincian Bulan', 'Status Periode Ini', 'Hadir Bulan Ini', 'Total Sesi Bulan Ini', '% Kehadiran', 'Total Hadir Periode Menunggak']
)
```

- [ ] **Step 4: Verify build and UI styles**

Run: `npm run build`
Expected: Build passes with 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/laporan/page.tsx
git commit -m "feat: add multi-month unpaid filter, badges, and csv export in admin laporan"
```

---

### Task 4: End-to-End Verification & Sanity Checks

**Files:**
- All touched files

- [ ] **Step 1: Run unit tests**

Run: `node --experimental-strip-types src/lib/__tests__/tunggakan.test.ts`
Expected: All assertions PASS.

- [ ] **Step 2: Run linter and type-checker**

Run: `npm run lint && npm run build`
Expected: Clean output, no lint warnings/errors.

- [ ] **Step 3: Final sanity verification**

Check git diff to confirm no regressions or unintended modifications to other tabs in `admin/laporan/page.tsx`.
