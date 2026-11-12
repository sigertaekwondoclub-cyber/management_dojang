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

export async function uploadBuktiTransferMerchantAction(formData: FormData): Promise<{ success: boolean; message?: string; url?: string }> {
  try {
    const supabase = createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, message: 'Silakan login terlebih dahulu.' }
    }

    const pesananId = formData.get('pesananId') as string
    const file = formData.get('file') as File | null

    if (!pesananId || !file) {
      return { success: false, message: 'Pesanan ID dan berkas bukti transfer wajib disertakan.' }
    }

    // Cek pesanan
    const { data: pesanan, error: pErr } = await supabaseAdmin
      .from('pesanan_merchant')
      .select('id, siswa_id, status')
      .eq('id', pesananId)
      .single()

    if (pErr || !pesanan) {
      return { success: false, message: 'Data pesanan tidak ditemukan.' }
    }

    // Ambil data profile user untuk validasi hak akses
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role, siswa_id')
      .eq('id', user.id)
      .single()

    const isAdmin = profile?.role === 'admin'
    if (!isAdmin) {
      // Pastikan pesanan adalah milik anak dari user
      let isAllowed = profile?.siswa_id === pesanan.siswa_id

      if (!isAllowed && profile?.siswa_id) {
        const { data: primSiswa } = await supabaseAdmin
          .from('siswa')
          .select('no_hp_ortu')
          .eq('id', profile.siswa_id)
          .single()
        if (primSiswa?.no_hp_ortu) {
          const { data: targetSiswa } = await supabaseAdmin
            .from('siswa')
            .select('no_hp_ortu')
            .eq('id', pesanan.siswa_id)
            .single()
          if (targetSiswa?.no_hp_ortu && targetSiswa.no_hp_ortu.trim() === primSiswa.no_hp_ortu.trim()) {
            isAllowed = true
          }
        }
      }

      if (!isAllowed) {
        return { success: false, message: 'Anda tidak memiliki akses ke pesanan ini.' }
      }
    }

    // Upload file
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const buffer = Buffer.from(await file.arrayBuffer())
    const filePath = `bukti/${pesananId}_${Date.now()}.${ext}`

    const { error: upErr } = await supabaseAdmin.storage
      .from('merchant')
      .upload(filePath, buffer, {
        contentType: file.type || 'image/jpeg',
        upsert: true
      })

    if (upErr) {
      return { success: false, message: 'Gagal mengupload berkas bukti: ' + upErr.message }
    }

    const { data: urlData } = supabaseAdmin.storage.from('merchant').getPublicUrl(filePath)
    const publicUrl = urlData.publicUrl

    // Update pesanan_merchant
    const { error: updateErr } = await supabaseAdmin
      .from('pesanan_merchant')
      .update({
        bukti_transfer_url: publicUrl,
        status: 'menunggu_verifikasi'
      })
      .eq('id', pesananId)

    if (updateErr) {
      return { success: false, message: 'Gagal memperbarui status pesanan: ' + updateErr.message }
    }

    return {
      success: true,
      url: publicUrl,
      message: 'Bukti transfer berhasil diunggah! Menunggu verifikasi admin.'
    }
  } catch (err: any) {
    console.error('Upload bukti transfer error:', err)
    return { success: false, message: err?.message || 'Terjadi kesalahan sistem saat upload bukti transfer.' }
  }
}

export async function batalkanPesananMerchantAction(pesananId: string): Promise<{ success: boolean; message?: string }> {
  try {
    const supabase = createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, message: 'Silakan login terlebih dahulu.' }
    }

    if (!pesananId) {
      return { success: false, message: 'ID pesanan tidak valid.' }
    }

    // Ambil detail pesanan & items
    const { data: pesanan, error: pErr } = await supabaseAdmin
      .from('pesanan_merchant')
      .select('id, siswa_id, status, pesanan_item(id, varian_id, qty)')
      .eq('id', pesananId)
      .single()

    if (pErr || !pesanan) {
      return { success: false, message: 'Data pesanan tidak ditemukan.' }
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role, siswa_id')
      .eq('id', user.id)
      .single()

    const isAdmin = profile?.role === 'admin'

    if (!isAdmin) {
      // Ortu hanya boleh membatalkan jika statusnya menunggu_pembayaran
      if (pesanan.status !== 'menunggu_pembayaran') {
        return {
          success: false,
          message: 'Pesanan yang sudah diunggah buktinya atau telah diverifikasi tidak dapat dibatalkan mandiri. Hubungi admin.'
        }
      }

      // Validasi hak akses ortu
      let isAllowed = profile?.siswa_id === pesanan.siswa_id
      if (!isAllowed && profile?.siswa_id) {
        const { data: primSiswa } = await supabaseAdmin
          .from('siswa')
          .select('no_hp_ortu')
          .eq('id', profile.siswa_id)
          .single()
        if (primSiswa?.no_hp_ortu) {
          const { data: targetSiswa } = await supabaseAdmin
            .from('siswa')
            .select('no_hp_ortu')
            .eq('id', pesanan.siswa_id)
            .single()
          if (targetSiswa?.no_hp_ortu && targetSiswa.no_hp_ortu.trim() === primSiswa.no_hp_ortu.trim()) {
            isAllowed = true
          }
        }
      }

      if (!isAllowed) {
        return { success: false, message: 'Anda tidak memiliki izin membatalkan pesanan ini.' }
      }
    }

    // 1. Kembalikan stok produk_varian
    const items = (pesanan as any).pesanan_item || []
    for (const item of items) {
      if (item.varian_id && item.qty > 0) {
        const { data: v } = await supabaseAdmin
          .from('produk_varian')
          .select('stok')
          .eq('id', item.varian_id)
          .single()

        if (v) {
          await supabaseAdmin
            .from('produk_varian')
            .update({ stok: v.stok + item.qty })
            .eq('id', item.varian_id)
        }
      }
    }

    // 2. Jika tercatat di keuangan_club, hapus record keuangan
    const orderTag = `[Pesanan #${pesananId.slice(0, 8)}]`
    await supabaseAdmin
      .from('keuangan_club')
      .delete()
      .ilike('keterangan', `%${orderTag}%`)

    // 3. Hapus pesanan (cascade ke pesanan_item)
    const { error: delErr } = await supabaseAdmin
      .from('pesanan_merchant')
      .delete()
      .eq('id', pesananId)

    if (delErr) {
      return { success: false, message: 'Gagal menghapus data pesanan: ' + delErr.message }
    }

    return {
      success: true,
      message: 'Pesanan berhasil dibatalkan dan stok produk telah dikembalikan ke inventaris.'
    }
  } catch (err: any) {
    console.error('Batalkan pesanan error:', err)
    return { success: false, message: err?.message || 'Terjadi kesalahan sistem saat membatalkan pesanan.' }
  }
}

