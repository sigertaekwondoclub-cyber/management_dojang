import assert from 'node:assert'
import {
  getStudentProgramName,
  isSiswaEligibleForKelas,
  filterSiswaByKelas,
  sanitizeFokusPrestasi,
// @ts-expect-error - Node --experimental-strip-types requires explicit .ts extension
} from '../absensi.ts'

console.log('--- RUNNING ABSENSI FILTER & SANITIZE UNIT TESTS ---')

// Mock students
const studentUmum = {
  id: 's-1',
  nama: 'Budi (Umum Murni)',
  fokus_prestasi: null,
  program_kelas: { nama_program: 'Umum' },
}

const studentPrestasiPomsae = {
  id: 's-2',
  nama: 'Siti (Prestasi Poomsae)',
  fokus_prestasi: 'pomsae',
  program_kelas: { nama_program: 'Prestasi' },
}

const studentPrestasiKyurugi = {
  id: 's-3',
  nama: 'Andi (Prestasi Kyorugi)',
  fokus_prestasi: 'kyurugi',
  program_kelas: { nama_program: 'Prestasi' },
}

// Case where student changed from Prestasi to Umum, but DB still has zombie fokus_prestasi
const studentMovedToUmumWithZombieFokus = {
  id: 's-4',
  nama: 'Dimas (Pindah ke Umum tapi fokus_prestasi masih tersimpan)',
  fokus_prestasi: 'kyurugi',
  program_kelas: { nama_program: 'Umum' },
}

const allStudents = [
  studentUmum,
  studentPrestasiPomsae,
  studentPrestasiKyurugi,
  studentMovedToUmumWithZombieFokus,
]

// Test 1: Class 'Umum' should include ALL active students
console.log("Test 1: Class 'Umum' includes all active students")
const umumFiltered = filterSiswaByKelas(allStudents, 'Umum')
assert.strictEqual(umumFiltered.length, 4, 'All 4 students should attend Umum class')

// Test 2: Class 'Pomsae' should ONLY include students enrolled in Prestasi with fokus_prestasi === 'pomsae'
console.log("Test 2: Class 'Pomsae' only includes Prestasi Pomsae students")
const pomsaeFiltered = filterSiswaByKelas(allStudents, 'Pomsae')
assert.strictEqual(pomsaeFiltered.length, 1)
assert.strictEqual(pomsaeFiltered[0].id, 's-2')

// Test 3: Class 'Kyurugi' should ONLY include students enrolled in Prestasi with fokus_prestasi === 'kyurugi'
console.log("Test 3: Class 'Kyurugi' only includes Prestasi Kyurugi students (excludes students moved to Umum)")
const kyurugiFiltered = filterSiswaByKelas(allStudents, 'Kyurugi')
assert.strictEqual(kyurugiFiltered.length, 1, 'Only active Prestasi student s-3 should be in Kyurugi')
assert.strictEqual(kyurugiFiltered[0].id, 's-3')
// Ensure s-4 (Dimas) is NOT in Kyurugi
assert.ok(!kyurugiFiltered.some(s => s.id === 's-4'), 'Dimas must NOT appear in Kyurugi attendance list')

// Test 4: Array-shaped program_kelas join from Supabase
console.log('Test 4: Array-shaped program_kelas from Supabase join')
const studentWithArrayProg = {
  id: 's-5',
  nama: 'Test Array',
  fokus_prestasi: 'pomsae',
  program_kelas: [{ nama_program: 'Prestasi' }],
}
assert.strictEqual(isSiswaEligibleForKelas(studentWithArrayProg, 'Pomsae'), true)
assert.strictEqual(isSiswaEligibleForKelas(studentWithArrayProg, 'Kyurugi'), false)

// Test 5: Sanitize fokus_prestasi
console.log('Test 5: sanitizeFokusPrestasi resets to null when moving to Umum')
assert.strictEqual(sanitizeFokusPrestasi('Umum', 'kyurugi'), null)
assert.strictEqual(sanitizeFokusPrestasi('Umum', 'pomsae'), null)
assert.strictEqual(sanitizeFokusPrestasi('Umum', null), null)
assert.strictEqual(sanitizeFokusPrestasi('Prestasi', 'kyurugi'), 'kyurugi')
assert.strictEqual(sanitizeFokusPrestasi('Prestasi', 'pomsae'), 'pomsae')
assert.strictEqual(sanitizeFokusPrestasi('Prestasi', ''), null)
assert.strictEqual(sanitizeFokusPrestasi(null, 'kyurugi'), null)

console.log('✅ ALL ABSENSI FILTER & SANITIZE UNIT TESTS PASSED!')

