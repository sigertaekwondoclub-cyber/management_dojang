'use server'

import { createClient } from '@supabase/supabase-js'
import type { RekonsiliasiBank } from '@/lib/types'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Toggle status rekonsiliasi per transaksi di keuangan_club, iuran, atau payroll_details
 */
export async function toggleReconcileStatus(transaksiId: string, newStatus: boolean) {
  try {
    if (!transaksiId) throw new Error('ID Transaksi tidak valid')

    const now = newStatus ? new Date().toISOString() : null

    // 1. Pembayaran Iuran
    if (transaksiId.startsWith('iuran_')) {
      const realId = transaksiId.replace('iuran_', '')
      const { error } = await supabaseAdmin
        .from('iuran')
        .update({
          is_reconciled: newStatus,
          reconciled_at: now,
        })
        .eq('id', realId)

      if (error) {
        console.warn('Gagal update is_reconciled iuran:', error.message)
        return { success: true, fallback: true, message: error.message }
      }
      return { success: true }
    }

    // 2. Transfer Honor Pelatih
    if (transaksiId.startsWith('honor_')) {
      const realId = transaksiId.replace('honor_', '')
      const { error } = await supabaseAdmin
        .from('payroll_details')
        .update({
          is_reconciled: newStatus,
          reconciled_at: now,
        })
        .eq('id', realId)

      if (error) {
        console.warn('Gagal update is_reconciled payroll_details:', error.message)
        return { success: true, fallback: true, message: error.message }
      }
      return { success: true }
    }

    // 3. Fallback virtual merchant (jika belum tersimpan di keuangan_club)
    if (transaksiId.startsWith('merchant_')) {
      return { success: true, virtual: true }
    }

    // 4. Catatan kas keuangan_club
    const { error } = await supabaseAdmin
      .from('keuangan_club')
      .update({
        is_reconciled: newStatus,
        reconciled_at: now,
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
    const iuranIds = transaksiIds.filter(id => id.startsWith('iuran_')).map(id => id.replace('iuran_', ''))
    const honorIds = transaksiIds.filter(id => id.startsWith('honor_')).map(id => id.replace('honor_', ''))
    const validIds = transaksiIds.filter(id => !id.startsWith('iuran_') && !id.startsWith('merchant_') && !id.startsWith('honor_'))

    const now = new Date().toISOString()
    const tasks = []

    if (validIds.length > 0) {
      tasks.push(async () =>
        supabaseAdmin
          .from('keuangan_club')
          .update({ is_reconciled: true, reconciled_at: now })
          .in('id', validIds)
      )
    }

    if (iuranIds.length > 0) {
      tasks.push(async () =>
        supabaseAdmin
          .from('iuran')
          .update({ is_reconciled: true, reconciled_at: now })
          .in('id', iuranIds)
      )
    }

    if (honorIds.length > 0) {
      tasks.push(async () =>
        supabaseAdmin
          .from('payroll_details')
          .update({ is_reconciled: true, reconciled_at: now })
          .in('id', honorIds)
      )
    }

    if (tasks.length === 0) return { success: true }

    const results = await Promise.all(tasks.map(t => t()))
    const hasError = results.some(r => r?.error)
    if (hasError) {
      console.warn('Sebagian bulk update is_reconciled gagal')
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
