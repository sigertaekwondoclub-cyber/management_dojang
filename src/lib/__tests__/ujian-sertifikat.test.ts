/**
 * Unit Test: Logika No. Registrasi Sertifikat Kenaikan Sabuk
 *
 * Aturan bisnis:
 * 1. No. Reg pertama kali diinput saat ujian Putih → Kuning (atau saat siswa belum punya nomor).
 * 2. Setelah ditetapkan, nomor bersifat permanen — tidak berubah pada ujian sabuk berikutnya.
 * 3. Form input di-lock (read-only) jika siswa sudah punya no_reg_sertifikat.
 */

import test from 'node:test'
import assert from 'node:assert/strict'

// ── Pure business-logic helpers (cerminan dari logika UI/server action) ───────

/**
 * Menentukan no_reg_sertifikat yang akan disimpan ke ujian_sabuk.
 * - Jika siswa sudah punya nomor → gunakan yang ada (abaikan input baru)
 * - Jika belum ada → gunakan input admin (boleh null/kosong)
 */
function resolveNoReg(existingSiswaNoReg: string | null | undefined, adminInput: string | null): string | null {
  if (existingSiswaNoReg) return existingSiswaNoReg
  return adminInput || null
}

/**
 * Menentukan apakah form input no_reg harus di-lock (read-only).
 */
function isRegLocked(siswaNoReg: string | null | undefined): boolean {
  return Boolean(siswaNoReg)
}

/**
 * Simulasi logika trigger DB:
 * - Saat lulus, siswa.no_reg_sertifikat di-update HANYA jika belum terisi
 * - Jika sudah terisi, pertahankan nilai lama
 */
function applyLulusToSiswa(
  siswa: { sabuk_saat_ini: string; no_reg_sertifikat: string | null },
  ujian: { sabuk_tujuan: string; hasil: string; no_reg_sertifikat: string | null }
): { sabuk_saat_ini: string; no_reg_sertifikat: string | null } {
  if (ujian.hasil !== 'lulus') return siswa
  return {
    sabuk_saat_ini: ujian.sabuk_tujuan,
    no_reg_sertifikat: siswa.no_reg_sertifikat ?? ujian.no_reg_sertifikat,
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test('resolveNoReg — pertama kali: nomor dari input admin dipakai', () => {
  assert.equal(resolveNoReg(null, 'STKD-2026-0001'), 'STKD-2026-0001')
  assert.equal(resolveNoReg(undefined, 'STKD-2026-0001'), 'STKD-2026-0001')
})

test('resolveNoReg — sudah ada: nomor lama dipertahankan, input baru diabaikan', () => {
  assert.equal(resolveNoReg('STKD-2026-0001', 'STKD-2026-9999'), 'STKD-2026-0001')
  assert.equal(resolveNoReg('STKD-2026-0001', null), 'STKD-2026-0001')
})

test('resolveNoReg — tidak ada input, hasilnya null', () => {
  assert.equal(resolveNoReg(null, null), null)
  assert.equal(resolveNoReg(null, ''), null)
})

test('isRegLocked — form dikunci jika siswa sudah punya no_reg', () => {
  assert.equal(isRegLocked('STKD-2026-0001'), true)
  assert.equal(isRegLocked(null), false)
  assert.equal(isRegLocked(undefined), false)
  assert.equal(isRegLocked(''), false) // string kosong = belum ada
})

test('applyLulusToSiswa — kenaikan pertama: sabuk & no_reg diperbarui', () => {
  const siswa = { sabuk_saat_ini: 'putih', no_reg_sertifikat: null }
  const ujian = { sabuk_tujuan: 'kuning', hasil: 'lulus', no_reg_sertifikat: 'STKD-2026-0001' }
  const result = applyLulusToSiswa(siswa, ujian)
  assert.equal(result.sabuk_saat_ini, 'kuning')
  assert.equal(result.no_reg_sertifikat, 'STKD-2026-0001')
})

test('applyLulusToSiswa — kenaikan berikutnya: no_reg tidak berubah', () => {
  const siswa = { sabuk_saat_ini: 'kuning', no_reg_sertifikat: 'STKD-2026-0001' }
  const ujian = { sabuk_tujuan: 'hijau', hasil: 'lulus', no_reg_sertifikat: 'NO-BARU-9999' }
  const result = applyLulusToSiswa(siswa, ujian)
  assert.equal(result.sabuk_saat_ini, 'hijau')
  assert.equal(result.no_reg_sertifikat, 'STKD-2026-0001') // tetap nomor lama
})

test('applyLulusToSiswa — tidak lulus: siswa tidak berubah', () => {
  const siswa = { sabuk_saat_ini: 'kuning', no_reg_sertifikat: 'STKD-2026-0001' }
  const ujian = { sabuk_tujuan: 'hijau', hasil: 'tidak_lulus', no_reg_sertifikat: null }
  const result = applyLulusToSiswa(siswa, ujian)
  assert.equal(result.sabuk_saat_ini, 'kuning') // tidak berubah
  assert.equal(result.no_reg_sertifikat, 'STKD-2026-0001') // tidak berubah
})

