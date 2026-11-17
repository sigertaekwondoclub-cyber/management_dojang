import assert from 'node:assert'
import {
  hitungTunggakanSiswa,
  generatePesanTagihan,
  generatePesanRekapLengkap,
  generateTeksSalinSemuaBelumBayar,
  formatRupiah,
  BULAN_NAMES
// @ts-expect-error - Node --experimental-strip-types requires explicit .ts extension
} from '../tunggakan.ts'

console.log('--- RUNNING TUNGGAKAN UNIT TESTS ---')

// ==========================================
// Test Case 1: Student joined 3 months ago, only paid 1st month
// ==========================================
console.log('Test 1: Student joined 3 months ago, paid 1 month, 2 months unpaid')
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
  // Month 11 (November 2026) has not been generated yet in DB
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
assert.strictEqual(res1.izin, 1, 'November izin count should be 1')
assert.strictEqual(res1.totalSesi, 3, 'November total sessions should be 3')
assert.strictEqual(res1.persen, 67, 'November attendance percentage should be 67% (2/3 rounded)')
assert.strictEqual(res1.totalHadirTunggakan, 4, 'Cumulative attendance across Oct & Nov should be 4')
assert.strictEqual(res1.totalSesiTunggakan, 5, 'Cumulative sessions across Oct & Nov should be 5')
assert.strictEqual(res1.daftarTunggakan.length, 2)
assert.strictEqual(res1.daftarTunggakan[0].bulan, 10)
assert.strictEqual(res1.daftarTunggakan[0].status, 'belum_bayar')
assert.strictEqual(res1.daftarTunggakan[0].iuranId, 'i-2')
assert.strictEqual(res1.daftarTunggakan[1].bulan, 11)
assert.strictEqual(res1.daftarTunggakan[1].status, 'belum_bayar')
assert.strictEqual(res1.daftarTunggakan[1].iuranId, undefined)

// Test WhatsApp formatting for Tagihan
const waMsg = generatePesanTagihan(res1, {
  nama_club: 'Siger Taekwondo Club',
  rekening_bank: 'BCA',
  rekening_nomor: '1234567890',
  rekening_atas_nama: 'Siger TC'
}, 11, 2026)

assert.ok(waMsg.includes('Budi Santoso'), 'Message should contain student name')
assert.ok(waMsg.includes('2 Bulan'), 'Message should mention 2 Bulan')
assert.ok(waMsg.includes('300.000'), 'Message should contain formatted 300.000')
assert.ok(waMsg.includes('1234567890'), 'Message should contain bank account')
assert.ok(waMsg.includes('4x latihan'), 'Message should mention 4x latihan cumulative')

// ==========================================
// Test Case 2: Student joined this month and already paid (lunas)
// ==========================================
console.log('Test 2: Student with lunas status and 0 tunggakan')
const mockSiswa2 = {
  id: 'siswa-2',
  nama: 'Siti Aminah',
  no_hp_ortu: '08987654321',
  tgl_gabung: '2026-11-01',
  program_kelas: { nama_program: 'Reguler Pemula', biaya_bulanan: 120000 }
}

const mockIuran2 = [
  { id: 'i-201', siswa_id: 'siswa-2', bulan: 11, tahun: 2026, nominal: 120000, status_bayar: 'lunas' }
]

const res2 = hitungTunggakanSiswa({
  siswa: mockSiswa2,
  iuranRows: mockIuran2,
  absensiRows: [],
  filterBulan: 11,
  filterTahun: 2026
})

assert.strictEqual(res2.totalBulanMenunggak, 0, 'Lunas student should have 0 unpaid months')
assert.strictEqual(res2.totalNominalTunggakan, 0, 'Lunas student should have 0 nominal tunggakan')
assert.strictEqual(res2.statusIuran, 'lunas', 'Status for period should be lunas')
assert.strictEqual(res2.nominalIuran, 120000)

const rekapMsg = generatePesanRekapLengkap(res2, {
  nama_club: 'Siger Taekwondo Club',
  rekening_bank: 'BCA',
  rekening_nomor: '1234567890',
  rekening_atas_nama: 'Siger TC'
}, 11, 2026)

assert.ok(rekapMsg.includes('Siti Aminah'))
assert.ok(rekapMsg.includes('LUNAS'))
assert.ok(!rekapMsg.includes('Total Tunggakan:'), 'Should not mention tunggakan when 0 months')

// ==========================================
// Test Case 3: Student with 'ditolak' status
// ==========================================
console.log('Test 3: Student with ditolak iuran status')
const mockSiswa3 = {
  id: 'siswa-3',
  nama: 'Andi Pratama',
  no_hp_ortu: '08111222333',
  tgl_gabung: '2026-11-01',
  program_kelas: { nama_program: 'Privat', biaya_bulanan: 250000 }
}

const mockIuran3 = [
  { id: 'i-301', siswa_id: 'siswa-3', bulan: 11, tahun: 2026, nominal: 250000, status_bayar: 'ditolak' }
]

const res3 = hitungTunggakanSiswa({
  siswa: mockSiswa3,
  iuranRows: mockIuran3,
  absensiRows: [],
  filterBulan: 11,
  filterTahun: 2026
})

assert.strictEqual(res3.totalBulanMenunggak, 1)
assert.strictEqual(res3.daftarTunggakan[0].status, 'ditolak')
assert.strictEqual(res3.totalNominalTunggakan, 250000)

// Single month tagihan WhatsApp format
const tagihanMsg1Bulan = generatePesanTagihan(res3, null, 11, 2026)
assert.ok(tagihanMsg1Bulan.includes('Tagihan November 2026: *Rp 250.000*') || tagihanMsg1Bulan.includes('250.000'))
assert.ok(!tagihanMsg1Bulan.includes('Jumlah Tunggakan: *1 Bulan*'), '1 month should not show multi-month breakdown')

// ==========================================
// Test Case 4: Student joined > 24 months ago (safeguard check)
// ==========================================
console.log('Test 4: Safeguard max 24 months lookback')
const mockSiswaOld = {
  id: 'siswa-old',
  nama: 'Siswa Lawas',
  tgl_gabung: '2020-01-01',
  program_kelas: { nama_program: 'Reguler', biaya_bulanan: 100000 }
}

const resOld = hitungTunggakanSiswa({
  siswa: mockSiswaOld,
  iuranRows: [],
  absensiRows: [],
  filterBulan: 11,
  filterTahun: 2026
})

// Max lookback is 24 months back + current month = 25 months max
assert.ok(resOld.totalBulanMenunggak <= 25, `Should not exceed 25 months (got ${resOld.totalBulanMenunggak})`)
assert.ok(resOld.totalBulanMenunggak >= 24, `Should be at least 24 months (got ${resOld.totalBulanMenunggak})`)

// ==========================================
// Test Case 5: generateTeksSalinSemuaBelumBayar
// ==========================================
console.log('Test 5: generateTeksSalinSemuaBelumBayar')
const salinText = generateTeksSalinSemuaBelumBayar([res1, res3], 11, 2026)
assert.ok(salinText.includes('DAFTAR SISWA BELUM BAYAR IURAN'))
assert.ok(salinText.includes('Total: 2 Siswa'))
assert.ok(salinText.includes('550.000'))
assert.ok(salinText.includes('1. *Budi Santoso*'))
assert.ok(salinText.includes('2. *Andi Pratama*'))

assert.strictEqual(BULAN_NAMES[11], 'November')
assert.strictEqual(formatRupiah(150000), 'Rp 150.000')

console.log('✅ ALL TUNGGAKAN UNIT TESTS PASSED!')
