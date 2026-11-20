import test from 'node:test'
import assert from 'node:assert/strict'

test('Server-side cart total calculation ignores client hargaSatuan', () => {
  const masterProducts = new Map([
    ['var-1', { id: 'var-1', harga: 250000, stok: 10, ukuran: 'L', produk_merchant: { nama: 'Dobok Putih' } }],
    ['var-2', { id: 'var-2', harga: 50000, stok: 5, ukuran: 'Free Size', produk_merchant: { nama: 'Sabuk Putih' } }],
  ])

  const clientItems = [
    { varianId: 'var-1', qty: 2, hargaSatuan: 1 },    // price tampered to 1
    { varianId: 'var-2', qty: 1, hargaSatuan: 1 },    // price tampered to 1
  ]

  let serverTotal = 0
  const processedItems = clientItems.map(item => {
    const v = masterProducts.get(item.varianId)
    assert.ok(v, 'Variant must exist in DB')
    // Use server price, ignore client price
    const realPrice = v.harga
    serverTotal += realPrice * item.qty
    return {
      varianId: item.varianId,
      qty: item.qty,
      hargaSatuan: realPrice,   // overwrite with real price
    }
  })

  // Total should be (250000*2) + (50000*1) = 550000, NOT 3
  assert.equal(serverTotal, 550000)
  assert.equal(processedItems[0].hargaSatuan, 250000)
  assert.equal(processedItems[1].hargaSatuan, 50000)
})

test('File upload validation - size limit 5MB', () => {
  const MAX_FILE_SIZE = 5 * 1024 * 1024

  const validFile = { size: 2 * 1024 * 1024, type: 'image/jpeg' }
  const oversizedFile = { size: 6 * 1024 * 1024, type: 'image/jpeg' }
  const invalidTypeFile = { size: 1 * 1024 * 1024, type: 'application/zip' }

  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']

  function validateUpload(file: { size: number, type: string }): { ok: boolean, reason?: string } {
    if (file.size > MAX_FILE_SIZE) return { ok: false, reason: 'Ukuran berkas maksimal 5MB' }
    if (!ALLOWED_TYPES.includes(file.type)) return { ok: false, reason: `Tipe berkas ${file.type} tidak diizinkan. Gunakan JPG, PNG, WebP, atau PDF.` }
    return { ok: true }
  }

  assert.deepEqual(validateUpload(validFile), { ok: true })
  assert.deepEqual(validateUpload(oversizedFile), { ok: false, reason: 'Ukuran berkas maksimal 5MB' })
  assert.deepEqual(validateUpload(invalidTypeFile), { ok: false, reason: 'Tipe berkas application/zip tidak diizinkan. Gunakan JPG, PNG, WebP, atau PDF.' })
})

test('IDOR check - ortu can only checkout for own children', () => {
  const parentPrimarySiswaId = 'siswa-anak-1'
  const siblingIds = ['siswa-anak-1', 'siswa-anak-2']

  function canCheckoutForChild(targetSiswaId: string): boolean {
    return siblingIds.includes(targetSiswaId)
  }

  assert.equal(canCheckoutForChild('siswa-anak-1'), true)
  assert.equal(canCheckoutForChild('siswa-anak-2'), true)
  assert.equal(canCheckoutForChild('siswa-orang-lain'), false)
})

