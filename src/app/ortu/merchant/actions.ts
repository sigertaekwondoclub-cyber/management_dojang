'use server'

import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import type { PesananMerchant, StatusPesanan } from '@/lib/types'

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

export async function getOrtuPesananAction(): Promise<{
  success: boolean
  pesanan: PesananMerchant[]
  message?: string
}> {
  try {
    const supabase = createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, pesanan: [], message: 'Silakan login terlebih dahulu.' }
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role, siswa_id')
      .eq('id', user.id)
      .single()

    if (!profile?.siswa_id) {
      return { success: false, pesanan: [], message: 'Akun belum terhubung ke data siswa.' }
    }

    // Ambil data siswa utama dan saudara (berdasarkan no_hp_ortu)
    let childIds: string[] = [profile.siswa_id]

    const { data: primSiswa } = await supabaseAdmin
      .from('siswa')
      .select('no_hp_ortu')
      .eq('id', profile.siswa_id)
      .single()

    if (primSiswa?.no_hp_ortu && primSiswa.no_hp_ortu.trim() !== '') {
      const { data: siblings } = await supabaseAdmin
        .from('siswa')
        .select('id')
        .eq('no_hp_ortu', primSiswa.no_hp_ortu.trim())
        .eq('status_aktif', true)

      if (siblings && siblings.length > 0) {
        childIds = Array.from(new Set([profile.siswa_id, ...siblings.map(s => s.id)]))
      }
    }

    const { data, error } = await supabaseAdmin
      .from('pesanan_merchant')
      .select('*, siswa:siswa_id(nama), pesanan_item(*, produk_merchant:produk_id(nama, foto_url), produk_varian:varian_id(ukuran))')
      .in('siswa_id', childIds)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error getOrtuPesananAction:', error)
      return { success: false, pesanan: [], message: error.message }
    }

    return { success: true, pesanan: (data || []) as PesananMerchant[] }
  } catch (err: any) {
    console.error('Error getOrtuPesananAction:', err)
    return { success: false, pesanan: [], message: err?.message || 'Terjadi kesalahan sistem' }
  }
}

export async function getAdminPesananAction(filterStatus?: string): Promise<{
  success: boolean
  pesanan: PesananMerchant[]
  stats?: {
    menungguPembayaran: number
    menungguVerifikasi: number
    totalBaru: number
  }
  message?: string
}> {
  try {
    const supabase = createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, pesanan: [], message: 'Silakan login terlebih dahulu.' }
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return { success: false, pesanan: [], message: 'Hanya admin yang memiliki akses.' }
    }

    let query = supabaseAdmin
      .from('pesanan_merchant')
      .select('*, siswa:siswa_id(nama), pesanan_item(*, produk_merchant:produk_id(nama, foto_url), produk_varian:varian_id(ukuran))')
      .order('created_at', { ascending: false })

    if (filterStatus && filterStatus !== 'semua') {
      query = query.eq('status', filterStatus)
    }

    const { data, error } = await query
    if (error) {
      console.error('Error getAdminPesananAction:', error)
      return { success: false, pesanan: [], message: error.message }
    }

    // Hitung status pesanan baru/menunggu
    const { data: allPending } = await supabaseAdmin
      .from('pesanan_merchant')
      .select('status')
      .in('status', ['menunggu_pembayaran', 'menunggu_verifikasi'])

    const menungguPembayaran = allPending?.filter(p => p.status === 'menunggu_pembayaran').length || 0
    const menungguVerifikasi = allPending?.filter(p => p.status === 'menunggu_verifikasi').length || 0

    return {
      success: true,
      pesanan: (data || []) as PesananMerchant[],
      stats: {
        menungguPembayaran,
        menungguVerifikasi,
        totalBaru: menungguPembayaran + menungguVerifikasi
      }
    }
  } catch (err: any) {
    console.error('Error getAdminPesananAction:', err)
    return { success: false, pesanan: [], message: err?.message || 'Terjadi kesalahan sistem' }
  }
}

export async function getAdminPendingOrdersCountAction(): Promise<{
  menungguPembayaran: number
  menungguVerifikasi: number
  total: number
}> {
  try {
    const { data } = await supabaseAdmin
      .from('pesanan_merchant')
      .select('status')
      .in('status', ['menunggu_pembayaran', 'menunggu_verifikasi'])

    const menungguPembayaran = data?.filter(p => p.status === 'menunggu_pembayaran').length || 0
    const menungguVerifikasi = data?.filter(p => p.status === 'menunggu_verifikasi').length || 0

    return {
      menungguPembayaran,
      menungguVerifikasi,
      total: menungguPembayaran + menungguVerifikasi
    }
  } catch (err) {
    console.error('getAdminPendingOrdersCountAction error:', err)
    return { menungguPembayaran: 0, menungguVerifikasi: 0, total: 0 }
  }
}

export async function updatePesananStatusAdminAction(
  pesananId: string,
  newStatus: StatusPesanan,
  catatanAdmin?: string
): Promise<{ success: boolean; message?: string }> {
  try {
    const supabase = createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, message: 'Silakan login terlebih dahulu.' }
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return { success: false, message: 'Hanya admin yang memiliki izin mengubah status pesanan.' }
    }

    // Ambil pesanan saat ini
    const { data: pesanan, error: pErr } = await supabaseAdmin
      .from('pesanan_merchant')
      .select('*, siswa:siswa_id(nama)')
      .eq('id', pesananId)
      .single()

    if (pErr || !pesanan) {
      return { success: false, message: 'Pesanan tidak ditemukan.' }
    }

    // 1. Update status pesanan & catatan admin
    const { error: updateErr } = await supabaseAdmin
      .from('pesanan_merchant')
      .update({
        status: newStatus,
        catatan_admin: catatanAdmin || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', pesananId)

    if (updateErr) {
      return { success: false, message: 'Gagal update status pesanan: ' + updateErr.message }
    }

    // 2. Sinkronisasi keuangan_club
    const isPaid = ['lunas', 'diproses', 'siap_diambil'].includes(newStatus)
    const orderTag = `[Pesanan #${pesananId.slice(0, 8)}]`

    if (isPaid) {
      const { data: existing } = await supabaseAdmin
        .from('keuangan_club')
        .select('id')
        .ilike('keterangan', `%${orderTag}%`)
        .maybeSingle()

      if (!existing) {
        const siswaNama = (pesanan.siswa as any)?.nama || 'Siswa'
        const { error: insErr } = await supabaseAdmin.from('keuangan_club').insert({
          tgl: new Date().toISOString().split('T')[0],
          jenis: 'income',
          kategori: 'Penjualan Merchant',
          nominal: Number(pesanan.total_harga || 0),
          keterangan: `Penjualan Toko ${orderTag} — ${siswaNama}`,
          sumber: 'merchant'
        })
        if (insErr) {
          console.error('Gagal mencatat kas masuk keuangan_club:', insErr)
        }
      }
    } else {
      // Jika status dikembalikan ke belum lunas
      await supabaseAdmin
        .from('keuangan_club')
        .delete()
        .ilike('keterangan', `%${orderTag}%`)
    }

    return { success: true, message: 'Status pesanan berhasil diperbarui.' }
  } catch (err: any) {
    console.error('updatePesananStatusAdminAction error:', err)
    return { success: false, message: err?.message || 'Terjadi kesalahan sistem' }
  }
}

export async function getAdminDashboardMerchantStatsAction(startBulan: string): Promise<{
  menungguCount: number
  omzetBulanIni: number
}> {
  try {
    const [pendingRes, omzetRes] = await Promise.all([
      supabaseAdmin
        .from('pesanan_merchant')
        .select('id', { count: 'exact', head: true })
        .in('status', ['menunggu_pembayaran', 'menunggu_verifikasi']),
      supabaseAdmin
        .from('pesanan_merchant')
        .select('total_harga')
        .in('status', ['lunas', 'diproses', 'siap_diambil'])
        .gte('created_at', `${startBulan}T00:00:00`),
    ])

    const menungguCount = pendingRes.count || 0
    const omzetBulanIni = (omzetRes.data || []).reduce((acc, c) => acc + Number(c.total_harga || 0), 0)

    return { menungguCount, omzetBulanIni }
  } catch (err) {
    console.error('getAdminDashboardMerchantStatsAction error:', err)
    return { menungguCount: 0, omzetBulanIni: 0 }
  }
}

export async function getOrtuPesananTerbaruAction(siswaId: string): Promise<{
  data: { id: string; status: StatusPesanan; total_harga: number; created_at: string } | null
}> {
  try {
    const { data } = await supabaseAdmin
      .from('pesanan_merchant')
      .select('id, status, total_harga, created_at')
      .eq('siswa_id', siswaId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    return { data: data as any }
  } catch (err) {
    console.error('getOrtuPesananTerbaruAction error:', err)
    return { data: null }
  }
}

export async function getAdminMerchantSalesAction(startDate: string, endDate: string): Promise<{
  data: any[]
}> {
  try {
    const { data, error } = await supabaseAdmin
      .from('pesanan_merchant')
      .select('id, total_harga, status, created_at, updated_at, siswa:siswa_id(nama)')
      .in('status', ['lunas', 'diproses', 'siap_diambil'])
      .gte('created_at', `${startDate}T00:00:00`)
      .lte('created_at', `${endDate}T23:59:59`)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('getAdminMerchantSalesAction error:', error)
      return { data: [] }
    }
    return { data: data || [] }
  } catch (err) {
    console.error('getAdminMerchantSalesAction error:', err)
    return { data: [] }
  }
}

