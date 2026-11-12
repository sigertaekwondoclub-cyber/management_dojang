'use server'

import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface CheckoutItemPayload {
  produkId: string
  varianId: string
  qty: number
  hargaSatuan: number
}

interface CheckoutRequest {
  siswaId: string
  totalHarga: number
  items: CheckoutItemPayload[]
}

interface CheckoutResult {
  success: boolean
  pesananId?: string
  message?: string
}

export async function checkoutMerchantAction(payload: CheckoutRequest): Promise<CheckoutResult> {
  try {
    const supabase = createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, message: 'Silakan login terlebih dahulu.' }
    }

    if (!payload.siswaId) {
      return { success: false, message: 'Data siswa wajib dipilih.' }
    }

    if (!payload.items || payload.items.length === 0) {
      return { success: false, message: 'Keranjang belanja kosong.' }
    }

    // 1. Verifikasi stok varian sebelum checkout
    const varianIds = payload.items.map(i => i.varianId)
    const { data: variants, error: varErr } = await supabaseAdmin
      .from('produk_varian')
      .select('id, stok, ukuran, produk_id, produk_merchant:produk_id(nama)')
      .in('id', varianIds)

    if (varErr || !variants) {
      return { success: false, message: 'Gagal memverifikasi stok produk: ' + (varErr?.message || '') }
    }

    const variantMap = new Map(variants.map(v => [v.id, v]))

    for (const item of payload.items) {
      const v = variantMap.get(item.varianId)
      if (!v) {
        return { success: false, message: `Varian produk tidak ditemukan di sistem.` }
      }
      if (v.stok < item.qty) {
        const prodName = (v.produk_merchant as any)?.nama || 'Produk'
        return {
          success: false,
          message: `Stok untuk ${prodName} (Ukuran: ${v.ukuran}) tidak mencukupi. Tersedia: ${v.stok}, dipesan: ${item.qty}.`
        }
      }
    }

    // 2. Buat pesanan baru
    const { data: pesanan, error: orderErr } = await supabaseAdmin
      .from('pesanan_merchant')
      .insert({
        siswa_id: payload.siswaId,
        total_harga: payload.totalHarga,
        status: 'menunggu_pembayaran',
      })
      .select()
      .single()

    if (orderErr || !pesanan) {
      return { success: false, message: 'Gagal membuat pesanan: ' + (orderErr?.message || '') }
    }

    // 3. Masukkan item pesanan
    const itemsData = payload.items.map(item => ({
      pesanan_id: pesanan.id,
      produk_id: item.produkId,
      varian_id: item.varianId,
      qty: item.qty,
      harga_satuan: item.hargaSatuan,
    }))

    const { error: itemsErr } = await supabaseAdmin
      .from('pesanan_item')
      .insert(itemsData)

    if (itemsErr) {
      // Rollback pesanan
      await supabaseAdmin.from('pesanan_merchant').delete().eq('id', pesanan.id)
      return { success: false, message: 'Gagal mencatat rincian pesanan: ' + itemsErr.message }
    }

    // 4. Potong stok produk_varian menggunakan Admin client (bypasses RLS pembatasan ortu)
    for (const item of payload.items) {
      const v = variantMap.get(item.varianId)!
      const newStok = Math.max(0, v.stok - item.qty)
      const { error: updateStokErr } = await supabaseAdmin
        .from('produk_varian')
        .update({ stok: newStok })
        .eq('id', item.varianId)

      if (updateStokErr) {
        console.error('Gagal update stok varian:', item.varianId, updateStokErr)
      }
    }

    return {
      success: true,
      pesananId: pesanan.id,
      message: 'Pesanan berhasil dibuat dan stok produk telah diperbarui.'
    }
  } catch (error) {
    console.error('Checkout error:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Terjadi kesalahan sistem saat checkout.'
    }
  }
}

