'use client'

import React from 'react'
import { Button } from '@/components/ui/Button'
import type { FinancialExportItem, FinancialSummaryInfo } from '@/lib/exportKeuangan'

interface PrintReportModalProps {
  isOpen: boolean
  onClose: () => void
  periodeLabel: string
  summary: FinancialSummaryInfo
  transactions: FinancialExportItem[]
  filterInfo?: string
}

function formatRupiah(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
}

export function PrintReportModal({
  isOpen,
  onClose,
  periodeLabel,
  summary,
  transactions,
  filterInfo,
}: PrintReportModalProps) {
  if (!isOpen) return null

  const todayStr = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6 bg-dark/60 backdrop-blur-sm print:p-0 print:bg-white print:static">
      <div className="bg-white border-2 border-dark rounded-3xl shadow-brutal max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden print:border-none print:shadow-none print:max-w-none print:max-h-none print:rounded-none">
        {/* Modal Controls (Hidden in Print) */}
        <div className="flex items-center justify-between p-4 border-b-2 border-dark/10 bg-background print:hidden">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📄</span>
            <div>
              <h3 className="font-bold font-sans text-dark text-lg">Pratinjau Cetak / PDF</h3>
              <p className="text-xs text-dark/60">Gunakan dialog cetak browser untuk menyimpan file sebagai PDF</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="primary" onClick={handlePrint} className="flex items-center gap-2 font-bold shadow-brutal">
              🖨️ Cetak / Simpan PDF
            </Button>
            <Button variant="secondary" onClick={onClose} className="font-bold">
              ✕ Tutup
            </Button>
          </div>
        </div>

        {/* Printable Document Area */}
        <div className="overflow-y-auto p-6 sm:p-10 font-sans text-dark print:p-0 print:overflow-visible" id="printable-financial-report">
          {/* Header Kop Surat Laporan */}
          <div className="border-b-4 border-double border-dark pb-4 mb-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 bg-primary rounded-2xl border-2 border-dark flex items-center justify-center text-3xl font-bold shadow-sm print:border-black">
                  🥋
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight font-sans text-dark uppercase">
                    SIGER TAEKWONDO CLUB
                  </h1>
                  <p className="text-xs sm:text-sm text-dark/70 font-sans">
                    Sistem Manajemen Keuangan & Pembukuan Kas Club
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="inline-block bg-dark text-white px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider print:border print:border-black print:text-black print:bg-white">
                  Laporan Resmi
                </div>
                <div className="text-xs text-dark/60 mt-1">Dicetak: {todayStr}</div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-dark/10 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div>
                <span className="text-dark/60">Periode Laporan:</span>{' '}
                <b className="text-dark text-sm">{periodeLabel}</b>
              </div>
              {filterInfo && (
                <div className="text-dark/60">
                  Filter: <b className="text-dark">{filterInfo}</b>
                </div>
              )}
            </div>
          </div>

          {/* Ringkasan 3 Kotak Utama */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="p-3.5 border-2 border-dark rounded-2xl bg-green-50/60 print:bg-white print:border-black">
              <div className="text-[11px] font-bold text-dark/60 uppercase">Total Pemasukan (Income)</div>
              <div className="text-xl font-bold text-green-700 mt-0.5 print:text-black">
                {formatRupiah(summary.totalIncome)}
              </div>
              <div className="mt-2 pt-2 border-t border-dark/10 text-[10px] text-dark/70 flex flex-col gap-0.5">
                <div className="flex justify-between">
                  <span>Iuran Siswa:</span>
                  <b>{formatRupiah(summary.incomeIuran)}</b>
                </div>
                {summary.iuranTunai !== undefined && summary.iuranTransfer !== undefined && (
                  <div className="text-[9px] text-dark/50 pl-1">
                    (Tunai: {formatRupiah(summary.iuranTunai)} | Bank: {formatRupiah(summary.iuranTransfer)})
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Toko Merchant:</span>
                  <b>{formatRupiah(summary.incomeMerchant)}</b>
                </div>
                <div className="flex justify-between">
                  <span>Kas Manual/Lain:</span>
                  <b>{formatRupiah(summary.incomeManual)}</b>
                </div>
              </div>
            </div>

            <div className="p-3.5 border-2 border-dark rounded-2xl bg-red-50/60 print:bg-white print:border-black">
              <div className="text-[11px] font-bold text-dark/60 uppercase">Total Pengeluaran (Expense)</div>
              <div className="text-xl font-bold text-red-600 mt-0.5 print:text-black">
                {formatRupiah(summary.totalExpense)}
              </div>
              <div className="mt-2 pt-2 border-t border-dark/10 text-[10px] text-dark/70 flex flex-col gap-0.5">
                <div className="flex justify-between">
                  <span>Honor Pelatih:</span>
                  <b>{formatRupiah(summary.expenseHonor)}</b>
                </div>
                <div className="flex justify-between">
                  <span>Operasional & Lainnya:</span>
                  <b>{formatRupiah(summary.expenseManual)}</b>
                </div>
              </div>
            </div>

            <div className={`p-3.5 border-2 border-dark rounded-2xl print:bg-white print:border-black flex flex-col justify-between ${
              summary.saldoBersih >= 0 ? 'bg-primary/20' : 'bg-red-100'
            }`}>
              <div>
                <div className="text-[11px] font-bold text-dark/60 uppercase">Saldo Kas Bersih</div>
                <div className={`text-xl font-bold mt-0.5 ${summary.saldoBersih >= 0 ? 'text-green-800' : 'text-red-700'} print:text-black`}>
                  {formatRupiah(summary.saldoBersih)}
                </div>
                <div className="text-[10px] text-dark/60 mt-1">
                  Status: <b>{summary.saldoBersih >= 0 ? '🟢 Surplus Kas' : '🔴 Defisit Kas'}</b>
                </div>
              </div>
              <div className="text-[10px] text-dark/50 pt-2 border-t border-dark/10">
                Total {transactions.length} mutasi tercatat
              </div>
            </div>
          </div>

          {/* Tabel Mutasi Kas Terperinci */}
          <div className="mb-8">
            <h4 className="font-bold text-sm uppercase text-dark mb-2 tracking-wide">
              Rincian Buku Kas & Mutasi Transaksi
            </h4>
            <div className="border-2 border-dark rounded-xl overflow-hidden print:border-black">
              <table className="w-full text-xs font-sans border-collapse">
                <thead>
                  <tr className="bg-dark text-white print:bg-gray-200 print:text-black border-b-2 border-dark">
                    <th className="py-2 px-2 text-center w-8 font-bold">No</th>
                    <th className="py-2 px-2.5 text-left w-20 font-bold">Tanggal</th>
                    <th className="py-2 px-2 text-left w-20 font-bold">Jenis</th>
                    <th className="py-2 px-2 text-left w-24 font-bold">Sumber</th>
                    <th className="py-2 px-2.5 text-left font-bold">Kategori & Keterangan</th>
                    <th className="py-2 px-2 text-center w-16 font-bold">Metode</th>
                    <th className="py-2 px-2.5 text-right w-24 font-bold">Pemasukan</th>
                    <th className="py-2 px-2.5 text-right w-24 font-bold">Pengeluaran</th>
                    <th className="py-2 px-2.5 text-right w-24 font-bold">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx, idx) => (
                    <tr
                      key={idx}
                      className={`border-b border-dark/15 print:border-gray-300 ${
                        idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/70 print:bg-white'
                      }`}
                    >
                      <td className="py-2 px-2 text-center text-dark/70 font-mono">{tx.no}</td>
                      <td className="py-2 px-2.5 whitespace-nowrap text-dark font-mono text-[11px]">{tx.tgl}</td>
                      <td className="py-2 px-2 whitespace-nowrap">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          tx.jenis === 'Income'
                            ? 'bg-green-100 text-green-800 print:text-black'
                            : 'bg-red-100 text-red-800 print:text-black'
                        }`}>
                          {tx.jenis === 'Income' ? 'Masuk' : 'Keluar'}
                        </span>
                      </td>
                      <td className="py-2 px-2 whitespace-nowrap text-dark/80 text-[11px] font-medium">{tx.sumber}</td>
                      <td className="py-2 px-2.5 text-dark leading-snug">
                        <span className="font-bold text-[11px] block">{tx.kategori}</span>
                        <span className="text-dark/70 text-[10px] block truncate max-w-xs">{tx.keterangan}</span>
                      </td>
                      <td className="py-2 px-2 text-center text-dark/70 text-[10px] capitalize whitespace-nowrap">
                        {tx.metode || '-'}
                      </td>
                      <td className="py-2 px-2.5 text-right text-green-700 font-medium font-mono whitespace-nowrap print:text-black">
                        {tx.pemasukan > 0 ? formatRupiah(tx.pemasukan) : '-'}
                      </td>
                      <td className="py-2 px-2.5 text-right text-red-600 font-medium font-mono whitespace-nowrap print:text-black">
                        {tx.pengeluaran > 0 ? formatRupiah(tx.pengeluaran) : '-'}
                      </td>
                      <td className="py-2 px-2.5 text-right font-bold font-mono whitespace-nowrap text-dark">
                        {formatRupiah(tx.saldoKumulatif)}
                      </td>
                    </tr>
                  ))}
                  {transactions.length === 0 && (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-dark/40 italic">
                        Tidak ada transaksi pada periode yang dipilih.
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-100 font-bold border-t-2 border-dark print:border-black text-xs">
                    <td colSpan={6} className="py-2.5 px-3 text-right uppercase">
                      Total Akumulatif ({transactions.length} Transaksi):
                    </td>
                    <td className="py-2.5 px-2.5 text-right text-green-700 font-mono print:text-black">
                      {formatRupiah(summary.totalIncome)}
                    </td>
                    <td className="py-2.5 px-2.5 text-right text-red-600 font-mono print:text-black">
                      {formatRupiah(summary.totalExpense)}
                    </td>
                    <td className="py-2.5 px-2.5 text-right font-mono text-dark">
                      {formatRupiah(summary.saldoBersih)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Kolom Tanda Tangan & Pengesahan */}
          <div className="pt-6 border-t-2 border-dark/20 flex justify-between items-end text-xs font-sans print:pt-4">
            <div className="text-center w-52">
              <div className="text-dark/70 mb-14">Mengetahui,<br /><b>Ketua / Pelatih Kepala Dojang</b></div>
              <div className="border-b border-dark font-bold pb-1 text-dark uppercase">( ........................................ )</div>
              <div className="text-[10px] text-dark/50 mt-0.5">Siger Taekwondo Club</div>
            </div>

            <div className="text-center w-52">
              <div className="text-dark/70 mb-14">Bandar Lampung, {todayStr}<br /><b>Bendahara / Administrasi</b></div>
              <div className="border-b border-dark font-bold pb-1 text-dark uppercase">( ........................................ )</div>
              <div className="text-[10px] text-dark/50 mt-0.5">Pengelola Kas Dojang</div>
            </div>
          </div>
        </div>
      </div>

      {/* Global Print Style for clean A4 printing */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 10mm;
          }
          body {
            background: white !important;
            color: black !important;
          }
          body * {
            visibility: hidden;
          }
          #printable-financial-report,
          #printable-financial-report * {
            visibility: visible;
          }
          #printable-financial-report {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
        }
      `}</style>
    </div>
  )
}
