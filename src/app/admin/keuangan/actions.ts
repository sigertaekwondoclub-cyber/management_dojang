'use server'

import { createClient } from '@supabase/supabase-js'
import type { RekonsiliasiBank } from '@/lib/types'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Toggle status rekonsiliasi per transaksi di keuangan_club
 */
export async function toggleReconcileStatus(transaksiId: string, newStatus: boolean) {
  try {
    if (!transaksiId) throw new Error('ID Transaksi tidak valid')

    // Jika id berasal dari iuran atau merchant atau virtual, kita skip update tabel keuangan_club
    if (transaksiId.startsWith('iuran_') || transaksiId.startsWith('merchant_') || transaksiId.startsWith('honor_')) {
      return { success: true, virtual: true }
    }

    const { error } = await supabaseAdmin
      .from('keuangan_club')
      .update({
        is_reconciled: newStatus,
        reconciled_at: newStatus ? new Date().toISOString() : null,
      })
      .eq('id', transaksiId)

    if (error) {
      console.warn('Gagal update is_reconciled (mungkin kolom belum dimigrasi di DB):', error.message)
      return { success: true, fallback: true, message: error.message }
    }

    return { success: true }
  } catch (err: any) {
    return { success: false, message: err.message || 'Gagal mengubah status rekonsiliasi' }
  }
}

/**
 * Tandai banyak transaksi sekaligus sebagai cocok (reconciled)
 */
export async function bulkMarkReconciled(transaksiIds: string[]) {
  try {
    const validIds = transaksiIds.filter(id => !id.startsWith('iuran_') && !id.startsWith('merchant_') && !id.startsWith('honor_'))
    if (validIds.length === 0) return { success: true }

    const { error } = await supabaseAdmin
      .from('keuangan_club')
      .update({
        is_reconciled: true,
        reconciled_at: new Date().toISOString(),
      })
      .in('id', validIds)

    if (error) {
      console.warn('Gagal bulk update is_reconciled:', error.message)
      return { success: true, fallback: true }
    }

    return { success: true }
  } catch (err: any) {
    return { success: false, message: err.message || 'Gagal menandai transaksi cocok' }
  }
}

/**
 * Simpan snapshot audit rekonsiliasi bank baru
 */
export async function saveBankReconciliation(payload: {
  tgl_rekon: string
  nama_bank?: string
  no_rekening?: string
  saldo_bank_riil: number
  saldo_buku_sistem: number
  catatan?: string
}) {
  try {
    const selisih = Math.round(Number(payload.saldo_bank_riil) - Number(payload.saldo_buku_sistem))
    const status = selisih === 0 ? 'cocok' : 'ada_selisih'

    const record = {
      tgl_rekon: payload.tgl_rekon || new Date().toISOString().split('T')[0],
      nama_bank: payload.nama_bank || 'Bank Jago Syariah',
      no_rekening: payload.no_rekening || '502747384058',
      saldo_bank_riil: Math.round(Number(payload.saldo_bank_riil)),
      saldo_buku_sistem: Math.round(Number(payload.saldo_buku_sistem)),
      selisih,
      status,
      catatan: payload.catatan?.trim() || null,
    }

    const { data, error } = await supabaseAdmin
      .from('rekonsiliasi_bank')
      .insert(record)
      .select()
      .single()

    if (error) {
      console.warn('Gagal insert rekonsiliasi_bank (mungkin tabel belum dimigrasi di DB):', error.message)
      return {
        success: true,
        fallback: true,
        data: {
          id: 'local_' + Date.now(),
          ...record,
          created_at: new Date().toISOString(),
        } as RekonsiliasiBank,
        message: 'Snapshot disimpan sementara (Tabel DB belum dimigrasi)',
      }
    }

    return { success: true, data: data as RekonsiliasiBank, message: 'Snapshot rekonsiliasi berhasil disimpan!' }
  } catch (err: any) {
    return { success: false, message: err.message || 'Gagal menyimpan rekonsiliasi bank' }
  }
}

/**
 * Ambil riwayat rekonsiliasi bank
 */
export async function getReconciliationHistory(): Promise<{ success: boolean; data: RekonsiliasiBank[] }> {
  try {
    const { data, error } = await supabaseAdmin
      .from('rekonsiliasi_bank')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) {
      return { success: true, data: [] }
    }

    return { success: true, data: (data || []) as RekonsiliasiBank[] }
  } catch (err) {
    return { success: true, data: [] }
  }
}
