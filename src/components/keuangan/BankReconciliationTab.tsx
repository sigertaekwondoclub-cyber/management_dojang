'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import {
  toggleReconcileStatus,
  bulkMarkReconciled,
  saveBankReconciliation,
  getReconciliationHistory,
} from '@/app/admin/keuangan/actions'
import type { RekonsiliasiBank } from '@/lib/types'

interface TransaksiItem {
  id: string
  tgl: string
  jenis: 'income' | 'expense'
  sumber: string
  kategori: string
  keterangan: string
  nominal: number
  is_reconciled?: boolean
}

interface BankReconciliationTabProps {
  transaksiList: TransaksiItem[]
  saldoSistem: number
  onRefresh: () => Promise<void>
}

function formatRupiah(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
}

function formatTgl(tgl: string) {
  return new Date(tgl + 'T00:00:00').toLocaleDateString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric'
  })
}

export function BankReconciliationTab({
  transaksiList,
  saldoSistem,
  onRefresh,
}: BankReconciliationTabProps) {
  const [bankBalanceInput, setBankBalanceInput] = useState('2183500')
  const [filterStatus, setFilterStatus] = useState<'semua' | 'unreconciled' | 'reconciled'>('semua')
  const [history, setHistory] = useState<RekonsiliasiBank[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)

  // Local state for reconciled tracking (instant UI feedback)
  const [localReconciledMap, setLocalReconciledMap] = useState<Record<string, boolean>>({})

  // Modal Save Snapshot
  const [modalOpen, setModalOpen] = useState(false)
  const [modalTgl, setModalTgl] = useState(new Date().toISOString().split('T')[0])
  const [modalCatatan, setModalCatatan] = useState('')
  const [modalSaving, setModalSaving] = useState(false)
  const [modalError, setModalError] = useState('')
  const [toastMsg, setToastMsg] = useState('')

  const showToast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 3500)
  }

  // Load history on mount
  useEffect(() => {
    async function loadHistory() {
      setHistoryLoading(true)
      const res = await getReconciliationHistory()
      if (res.success && res.data.length > 0) {
        setHistory(res.data)
        // If there is recent history, set bank balance input to recent bank balance
        setBankBalanceInput(String(res.data[0].saldo_bank_riil))
      }
      setHistoryLoading(false)
    }
    loadHistory()
  }, [])

  // Sync initial reconciled status from props
  useEffect(() => {
    const map: Record<string, boolean> = {}
    transaksiList.forEach(t => {
      if (t.is_reconciled !== undefined) {
        map[t.id] = t.is_reconciled
      }
    })
    setLocalReconciledMap(map)
  }, [transaksiList])

  const parsedBankBalance = parseFloat(bankBalanceInput) || 0
  const unreconciledDiff = Math.round(parsedBankBalance - saldoSistem)
  const isBalanced = unreconciledDiff === 0

  // Count metrics
  const totalItems = transaksiList.length
  const reconciledCount = transaksiList.filter(t => localReconciledMap[t.id] ?? t.is_reconciled).length
  const unreconciledCount = totalItems - reconciledCount

  // Filtered transactions for reconciliation checklist
  const displayItems = useMemo(() => {
    return transaksiList.filter(t => {
      const isRec = localReconciledMap[t.id] ?? t.is_reconciled ?? false
      if (filterStatus === 'reconciled') return isRec
      if (filterStatus === 'unreconciled') return !isRec
      return true
    })
  }, [transaksiList, localReconciledMap, filterStatus])

  // Toggle single item
  const handleToggle = async (id: string, current: boolean) => {
    const next = !current
    setLocalReconciledMap(prev => ({ ...prev, [id]: next }))
    const res = await toggleReconcileStatus(id, next)
    if (!res.success) {
      // rollback
      setLocalReconciledMap(prev => ({ ...prev, [id]: current }))
      showToast('⚠️ Gagal mengubah status: ' + res.message)
    } else {
      showToast(next ? '✅ Transaksi ditandai cocok (Reconciled)' : 'ℹ️ Transaksi ditandai belum cocok')
    }
  }

  // Mark all reconciled
  const handleMarkAllReconciled = async () => {
    const allIds = transaksiList.map(t => t.id)
    const newMap: Record<string, boolean> = {}
    allIds.forEach(id => { newMap[id] = true })
    setLocalReconciledMap(newMap)
    const res = await bulkMarkReconciled(allIds)
    if (res.success) {
      showToast('✅ Semua transaksi berhasil ditandai cocok (Reconciled)!')
      await onRefresh()
    }
  }

  // Save snapshot
  const handleSaveSnapshot = async () => {
    setModalError('')
    if (!bankBalanceInput || isNaN(parsedBankBalance)) {
      setModalError('Masukkan nominal saldo rekening bank yang valid.')
      return
    }

    setModalSaving(true)
    const res = await saveBankReconciliation({
      tgl_rekon: modalTgl,
      saldo_bank_riil: parsedBankBalance,
      saldo_buku_sistem: saldoSistem,
      catatan: modalCatatan,
    })
    setModalSaving(false)

    if (res.success) {
      setModalOpen(false)
      setModalCatatan('')
      showToast('🎉 Snapshot rekonsiliasi bank berhasil disimpan!')
      // Refresh history
      const histRes = await getReconciliationHistory()
      if (histRes.success) setHistory(histRes.data)
    } else {
      setModalError(res.message || 'Gagal menyimpan rekonsiliasi')
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Toast Feedback */}
      {toastMsg && (
        <div className="fixed bottom-5 right-5 z-50 bg-dark text-white px-5 py-3 rounded-2xl shadow-brutal border-2 border-primary font-bold text-sm animate-bounce">
          {toastMsg}
        </div>
      )}

      {/* ── Top Header Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Saldo Buku Sistem */}
        <Card className="border-2 border-dark flex flex-col justify-between">
          <div>
            <div className="text-xs font-bold text-dark/60 uppercase tracking-wide">📚 Saldo Buku Sistem (Aplikasi)</div>
            <div className="text-2xl font-bold font-sans text-dark mt-1">{formatRupiah(saldoSistem)}</div>
          </div>
          <div className="text-xs text-dark/50 mt-3 pt-2 border-t border-dark/10 flex justify-between items-center">
            <span>Total Catatan Kas</span>
            <span className="font-bold">{totalItems} entri</span>
          </div>
        </Card>

        {/* Card 2: Saldo Rekening Bank Riil */}
        <Card className="border-2 border-dark flex flex-col justify-between bg-blue-50/50">
          <div>
            <div className="text-xs font-bold text-blue-900 uppercase tracking-wide flex items-center justify-between">
              <span>🏦 Saldo Rekening Koran Bank</span>
              <span className="text-[10px] bg-blue-200 px-2 py-0.5 rounded-full font-bold">Bank Jago Syariah</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-lg font-bold text-dark">Rp</span>
              <input
                type="number"
                value={bankBalanceInput}
                onChange={e => setBankBalanceInput(e.target.value)}
                className="w-full text-2xl font-bold font-sans text-blue-800 bg-white border border-dark/20 rounded-xl px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="2183500"
              />
            </div>
          </div>
          <div className="text-xs text-dark/60 mt-3 pt-2 border-t border-dark/10 flex justify-between items-center">
            <span>Rekening: 502747384058</span>
            <span className="text-[11px] text-blue-700 italic">Dapat disesuaikan</span>
          </div>
        </Card>

        {/* Card 3: Selisih Rekonsiliasi */}
        <Card className={`border-2 ${isBalanced ? 'border-green-600 bg-green-50' : 'border-accent bg-red-50'} flex flex-col justify-between`}>
          <div>
            <div className="text-xs font-bold uppercase tracking-wide flex items-center justify-between">
              <span>⚖️ Selisih Rekonsiliasi</span>
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${isBalanced ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
                {isBalanced ? '✅ SEIMBANG (0)' : '⚠️ ADA SELISIH'}
              </span>
            </div>
            <div className={`text-2xl font-bold font-sans mt-1 ${isBalanced ? 'text-green-700' : 'text-red-700'}`}>
              {unreconciledDiff > 0 ? `+${formatRupiah(unreconciledDiff)}` : formatRupiah(unreconciledDiff)}
            </div>
          </div>
          <div className="text-xs mt-3 pt-2 border-t border-dark/10 flex justify-between items-center">
            <span className="text-dark/60">
              {isBalanced ? 'Saldo sistem & bank cocok sempurna' : 'Perlu pencocokan / penyesuaian'}
            </span>
            <button
              onClick={() => setModalOpen(true)}
              className="text-xs font-bold text-dark underline hover:text-primary transition-colors"
            >
              Simpan Audit
            </button>
          </div>
        </Card>
      </div>

      {/* ── Action Toolbar ── */}
      <Card className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
          <span className="text-xs font-bold text-dark/60">Filter Checklist:</span>
          <button
            onClick={() => setFilterStatus('semua')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-all ${filterStatus === 'semua' ? 'bg-dark text-white border-dark' : 'bg-white text-dark border-dark/20'}`}
          >
            Semua ({totalItems})
          </button>
          <button
            onClick={() => setFilterStatus('unreconciled')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-all ${filterStatus === 'unreconciled' ? 'bg-accent text-white border-dark' : 'bg-white text-dark border-dark/20'}`}
          >
            ⏳ Belum Cocok ({unreconciledCount})
          </button>
          <button
            onClick={() => setFilterStatus('reconciled')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-all ${filterStatus === 'reconciled' ? 'bg-primary text-dark border-dark' : 'bg-white text-dark border-dark/20'}`}
          >
            ✅ Sudah Cocok ({reconciledCount})
          </button>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Button
            variant="secondary"
            onClick={handleMarkAllReconciled}
            className="text-xs font-bold"
          >
            ✓ Tandai Semua Cocok
          </Button>
          <Button
            variant="primary"
            onClick={() => setModalOpen(true)}
            className="text-xs font-bold shadow-brutal"
          >
            💾 Simpan Snapshot Rekonsiliasi
          </Button>
        </div>
      </Card>

      {/* ── Table Checklist Rekonsiliasi ── */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold font-sans text-dark text-lg">Pencocokan Mutasi Transaksi (Checklist Rekon)</h3>
            <p className="text-xs text-dark/60">Centang transaksi yang sudah tertera pada Rekening Koran Bank Jago</p>
          </div>
          <Badge color={reconciledCount === totalItems ? 'primary' : 'accent'}>
            {reconciledCount} / {totalItems} Terekonsiliasi
          </Badge>
        </div>

        {displayItems.length === 0 ? (
          <div className="text-center py-10 text-dark/40 font-sans text-sm">
            Tidak ada transaksi pada filter ini.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-sans">
              <thead>
                <tr className="border-b-2 border-dark text-dark/70 text-xs">
                  <th className="text-center py-2 px-3 w-16">Status</th>
                  <th className="text-left py-2 px-3">Tanggal</th>
                  <th className="text-left py-2 px-3">Jenis</th>
                  <th className="text-left py-2 px-3">Sumber</th>
                  <th className="text-left py-2 px-3">Keterangan</th>
                  <th className="text-right py-2 px-3">Nominal</th>
                  <th className="text-center py-2 px-3">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {displayItems.map((tx) => {
                  const isRec = localReconciledMap[tx.id] ?? tx.is_reconciled ?? false
                  const isIncome = tx.jenis === 'income'

                  return (
                    <tr
                      key={tx.id}
                      className={`border-b border-dark/10 transition-colors ${isRec ? 'bg-green-50/40' : 'hover:bg-yellow-50/30'}`}
                    >
                      <td className="py-2.5 px-3 text-center">
                        <button
                          onClick={() => handleToggle(tx.id, isRec)}
                          className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center font-bold text-xs transition-all ${
                            isRec
                              ? 'bg-green-500 border-green-700 text-white shadow-sm'
                              : 'bg-white border-dark/30 text-transparent hover:border-dark'
                          }`}
                          title={isRec ? 'Klik untuk batal cocok' : 'Klik untuk menandai cocok'}
                        >
                          ✓
                        </button>
                      </td>
                      <td className="py-2.5 px-3 font-medium text-dark">{formatTgl(tx.tgl)}</td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${isIncome ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                          {isIncome ? '💵 Masuk' : '💸 Keluar'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-xs text-dark/60 font-bold uppercase">{tx.sumber}</td>
                      <td className="py-2.5 px-3 font-sans text-dark">{tx.keterangan}</td>
                      <td className={`py-2.5 px-3 text-right font-bold ${isIncome ? 'text-green-700' : 'text-red-600'}`}>
                        {formatRupiah(tx.nominal)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          onClick={() => handleToggle(tx.id, isRec)}
                          className={`text-xs px-2.5 py-1 rounded-lg border font-bold transition-all ${
                            isRec
                              ? 'bg-green-100 text-green-800 border-green-300 hover:bg-green-200'
                              : 'bg-white text-dark/70 border-dark/20 hover:border-dark'
                          }`}
                        >
                          {isRec ? '✅ Cocok' : '⏳ Belum'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── Riwayat Snapshot Audit Rekonsiliasi ── */}
      <Card>
        <h3 className="font-bold font-sans text-dark text-lg mb-2">📜 Riwayat Audit Rekonsiliasi Bank</h3>
        <p className="text-xs text-dark/60 mb-4">Log historis penutupan dan audit rekonsiliasi perbankan</p>

        {historyLoading ? (
          <div className="text-center py-6 text-dark/40 text-sm font-sans">Memuat riwayat audit...</div>
        ) : history.length === 0 ? (
          <div className="text-center py-6 text-dark/40 text-sm font-sans">
            Belum ada snapshot rekonsiliasi yang disimpan. Klik tombol <b>"Simpan Snapshot Rekonsiliasi"</b> di atas.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-sans">
              <thead>
                <tr className="border-b-2 border-dark text-dark/70 text-xs">
                  <th className="text-left py-2 px-3">Tanggal Audit</th>
                  <th className="text-left py-2 px-3">Bank & No Rekening</th>
                  <th className="text-right py-2 px-3">Saldo Buku Sistem</th>
                  <th className="text-right py-2 px-3">Saldo Bank Riil</th>
                  <th className="text-right py-2 px-3">Selisih</th>
                  <th className="text-center py-2 px-3">Status</th>
                  <th className="text-left py-2 px-3">Catatan</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id} className="border-b border-dark/10">
                    <td className="py-2 px-3 font-bold text-dark">{formatTgl(h.tgl_rekon)}</td>
                    <td className="py-2 px-3 text-xs text-dark/70">
                      {h.nama_bank} ({h.no_rekening})
                    </td>
                    <td className="py-2 px-3 text-right">{formatRupiah(h.saldo_buku_sistem)}</td>
                    <td className="py-2 px-3 text-right font-bold text-blue-800">{formatRupiah(h.saldo_bank_riil)}</td>
                    <td className={`py-2 px-3 text-right font-bold ${h.selisih === 0 ? 'text-green-700' : 'text-red-600'}`}>
                      {h.selisih === 0 ? 'Rp 0' : formatRupiah(h.selisih)}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${h.status === 'cocok' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                        {h.status === 'cocok' ? '✅ Cocok' : '⚠️ Selisih'}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-xs text-dark/60">{h.catatan || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── Modal Simpan Snapshot Rekonsiliasi ── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark/60 backdrop-blur-sm">
          <div className="bg-white border-2 border-dark rounded-3xl p-6 shadow-brutal max-w-md w-full flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b-2 border-dark/10 pb-3">
              <div>
                <h3 className="font-bold font-sans text-dark text-lg">💾 Simpan Snapshot Rekonsiliasi</h3>
                <p className="text-xs text-dark/60">Audit perbandingan saldo buku sistem vs rekening koran bank</p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="w-8 h-8 rounded-full border border-dark flex items-center justify-center text-dark/60 hover:text-dark font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <Input
                label="Tanggal Rekonsiliasi"
                type="date"
                value={modalTgl}
                onChange={e => setModalTgl(e.target.value)}
              />

              <div className="p-3 bg-background border-2 border-dark/10 rounded-2xl flex flex-col gap-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-dark/60">Saldo Buku Sistem:</span>
                  <span className="font-bold text-dark">{formatRupiah(saldoSistem)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dark/60">Saldo Rekening Bank Riil:</span>
                  <span className="font-bold text-blue-800">{formatRupiah(parsedBankBalance)}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-dark/10">
                  <span className="font-bold text-dark">Selisih:</span>
                  <span className={`font-bold ${isBalanced ? 'text-green-700' : 'text-red-600'}`}>
                    {unreconciledDiff > 0 ? `+${formatRupiah(unreconciledDiff)}` : formatRupiah(unreconciledDiff)}
                  </span>
                </div>
              </div>

              <Input
                label="Catatan Audit / No. Rekening Koran"
                type="text"
                placeholder="Contoh: Rekonsiliasi mutasi Bank Jago per 10 Okt 2026"
                value={modalCatatan}
                onChange={e => setModalCatatan(e.target.value)}
              />

              {modalError && (
                <div className="p-3 bg-red-100 border-2 border-red-400 text-red-700 text-xs rounded-xl font-bold font-sans">
                  ⚠️ {modalError}
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="primary"
                onClick={handleSaveSnapshot}
                disabled={modalSaving}
                className="flex-1 font-bold shadow-brutal"
              >
                {modalSaving ? '⏳ Menyimpan...' : '💾 Simpan Audit'}
              </Button>
              <Button
                variant="secondary"
                onClick={() => setModalOpen(false)}
                className="flex-1 font-bold"
              >
                Batal
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
