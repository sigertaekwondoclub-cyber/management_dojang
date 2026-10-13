'use client'

import React from 'react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

export interface PnLDataDetailed {
  revIuran: number
  revMerchant: number
  revUjianEvent: number
  revOthers: number
  grossRev: number

  expHonor: number
  expPerlengkapan: number
  expSewa: number
  expKonsumsi: number
  expAtkAdmin: number
  expOthers: number
  totalExp: number

  operatingProfit: number
  operatingMargin: number

  nonOpKasbon: number
  nonOpKoreksi: number

  netProfit: number
  netMargin: number
}

interface ProfitLossTabProps {
  pnl: PnLDataDetailed
  saldoKasRiil: number
  periodeLabel: string
}

function formatRupiah(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
}

export function ProfitLossTab({
  pnl,
  saldoKasRiil,
  periodeLabel,
}: ProfitLossTabProps) {
  const isSurplus = pnl.netProfit >= 0
  const cashDifference = Math.round(saldoKasRiil - pnl.netProfit)

  return (
    <div className="flex flex-col gap-6">
      {/* ── Top Header KPI ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Total Pendapatan Operasional */}
        <Card className="border-2 border-dark flex flex-col justify-between bg-green-50/40">
          <div>
            <div className="text-xs font-bold text-dark/60 uppercase tracking-wide">💵 Total Pendapatan Usaha</div>
            <div className="text-2xl font-bold font-sans text-green-800 mt-1">{formatRupiah(pnl.grossRev)}</div>
          </div>
          <div className="text-xs text-dark/60 mt-3 pt-2 border-t border-dark/10 flex justify-between">
            <span>Periode:</span>
            <span className="font-bold">{periodeLabel}</span>
          </div>
        </Card>

        {/* Card 2: Total Beban Operasional */}
        <Card className="border-2 border-dark flex flex-col justify-between bg-red-50/40">
          <div>
            <div className="text-xs font-bold text-dark/60 uppercase tracking-wide">💸 Total Beban Operasional</div>
            <div className="text-2xl font-bold font-sans text-red-700 mt-1">{formatRupiah(pnl.totalExp)}</div>
          </div>
          <div className="text-xs text-dark/60 mt-3 pt-2 border-t border-dark/10 flex justify-between">
            <span>Rasio Beban / Omset:</span>
            <span className="font-bold">{pnl.grossRev > 0 ? Math.round((pnl.totalExp / pnl.grossRev) * 100) : 0}%</span>
          </div>
        </Card>

        {/* Card 3: Laba Bersih (Net Profit) */}
        <Card className={`border-2 ${isSurplus ? 'border-primary bg-primary/10' : 'border-accent bg-accent/10'} flex flex-col justify-between`}>
          <div>
            <div className="text-xs font-bold text-dark/60 uppercase tracking-wide flex justify-between items-center">
              <span>🏆 Laba Bersih (Net Profit)</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${isSurplus ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
                Margin: {pnl.netMargin}%
              </span>
            </div>
            <div className={`text-2xl font-bold font-sans mt-1 ${isSurplus ? 'text-green-700' : 'text-red-600'}`}>
              {formatRupiah(pnl.netProfit)}
            </div>
          </div>
          <div className="text-xs text-dark/60 mt-3 pt-2 border-t border-dark/10 flex justify-between">
            <span>Status Finansial:</span>
            <span className="font-bold">{isSurplus ? 'Surplus / Menguntungkan' : 'Defisit Operasional'}</span>
          </div>
        </Card>
      </div>

      {/* ── Main P&L Statement Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Pendapatan Usaha (Revenue) */}
        <Card className="border-2 border-dark flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b-2 border-dark/10 pb-3 mb-3">
              <h3 className="font-bold font-sans text-dark text-base flex items-center gap-2">
                <span>1.</span> PENDAPATAN OPERASIONAL USAHA (REVENUE)
              </h3>
              <span className="text-xs text-green-700 font-bold bg-green-100 px-2.5 py-1 rounded-full">
                {formatRupiah(pnl.grossRev)}
              </span>
            </div>

            <div className="flex flex-col divide-y divide-dark/5 text-sm font-sans">
              <div className="py-2.5 flex justify-between items-center">
                <div>
                  <div className="font-bold text-dark">Iuran Siswa Bulanan (SPP)</div>
                  <div className="text-xs text-dark/50">Pembayaran iuran rutin atlet/siswa</div>
                </div>
                <div className="font-bold text-dark">{formatRupiah(pnl.revIuran)}</div>
              </div>

              <div className="py-2.5 flex justify-between items-center">
                <div>
                  <div className="font-bold text-dark">Penjualan Merchant & Toko</div>
                  <div className="text-xs text-dark/50">Seragam dobok, jersey club, sabuk, target</div>
                </div>
                <div className="font-bold text-dark">{formatRupiah(pnl.revMerchant)}</div>
              </div>

              <div className="py-2.5 flex justify-between items-center">
                <div>
                  <div className="font-bold text-dark">Pendaftaran Ujian Sabuk & Kejuaraan</div>
                  <div className="text-xs text-dark/50">Penerimaan dari event kenaikan tingkat & turnamen</div>
                </div>
                <div className="font-bold text-dark">{formatRupiah(pnl.revUjianEvent)}</div>
              </div>

              <div className="py-2.5 flex justify-between items-center">
                <div>
                  <div className="font-bold text-dark">Pendapatan Operasional Lainnya</div>
                  <div className="text-xs text-dark/50">Donasi, formulir pendaftaran siswa baru, dsb.</div>
                </div>
                <div className="font-bold text-dark">{formatRupiah(pnl.revOthers)}</div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t-2 border-dark/20 flex justify-between items-center bg-green-50/50 p-3 rounded-2xl">
            <span className="font-bold font-sans text-dark text-sm">TOTAL PENDAPATAN OPERASIONAL</span>
            <span className="font-bold font-sans text-green-800 text-base">{formatRupiah(pnl.grossRev)}</span>
          </div>
        </Card>

        {/* 2. Beban Operasional (Expenses) */}
        <Card className="border-2 border-dark flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b-2 border-dark/10 pb-3 mb-3">
              <h3 className="font-bold font-sans text-dark text-base flex items-center gap-2">
                <span>2.</span> BEBAN OPERASIONAL (OPERATING EXPENSES)
              </h3>
              <span className="text-xs text-red-700 font-bold bg-red-100 px-2.5 py-1 rounded-full">
                {formatRupiah(pnl.totalExp)}
              </span>
            </div>

            <div className="flex flex-col divide-y divide-dark/5 text-sm font-sans">
              <div className="py-2.5 flex justify-between items-center">
                <div>
                  <div className="font-bold text-dark">Honor & Gaji Pelatih (Payroll)</div>
                  <div className="text-xs text-dark/50">Honor mengajar sesi & founder margin pelatih</div>
                </div>
                <div className="font-bold text-dark">{formatRupiah(pnl.expHonor)}</div>
              </div>

              <div className="py-2.5 flex justify-between items-center">
                <div>
                  <div className="font-bold text-dark">Perlengkapan Dojang & Matras</div>
                  <div className="text-xs text-dark/50">Alat agility, target tendangan, sarana latihan</div>
                </div>
                <div className="font-bold text-dark">{formatRupiah(pnl.expPerlengkapan)}</div>
              </div>

              <div className="py-2.5 flex justify-between items-center">
                <div>
                  <div className="font-bold text-dark">Sewa Tempat & Gedung Latihan</div>
                  <div className="text-xs text-dark/50">Biaya sewa dojo / venue latihan</div>
                </div>
                <div className="font-bold text-dark">{formatRupiah(pnl.expSewa)}</div>
              </div>

              <div className="py-2.5 flex justify-between items-center">
                <div>
                  <div className="font-bold text-dark">Konsumsi, Donat & Air Mineral</div>
                  <div className="text-xs text-dark/50">Konsumsi event ujian, minuman latihan atlet</div>
                </div>
                <div className="font-bold text-dark">{formatRupiah(pnl.expKonsumsi)}</div>
              </div>

              <div className="py-2.5 flex justify-between items-center">
                <div>
                  <div className="font-bold text-dark">Administrasi, ATK & Layard ID Card</div>
                  <div className="text-xs text-dark/50">Atribut sertifikat ujian sabuk, layard kartu</div>
                </div>
                <div className="font-bold text-dark">{formatRupiah(pnl.expAtkAdmin)}</div>
              </div>

              <div className="py-2.5 flex justify-between items-center">
                <div>
                  <div className="font-bold text-dark">Beban Operasional Lainnya</div>
                  <div className="text-xs text-dark/50">Operasional umum dojang, jersey vendor, dsb.</div>
                </div>
                <div className="font-bold text-dark">{formatRupiah(pnl.expOthers)}</div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t-2 border-dark/20 flex justify-between items-center bg-red-50/50 p-3 rounded-2xl">
            <span className="font-bold font-sans text-dark text-sm">TOTAL BEBAN OPERASIONAL</span>
            <span className="font-bold font-sans text-red-700 text-base">{formatRupiah(pnl.totalExp)}</span>
          </div>
        </Card>
      </div>

      {/* ── Ringkasan Laba Bersih & Informasi Arus Kas Non-Operasional ── */}
      <Card className="border-2 border-dark bg-background">
        <h3 className="font-bold font-sans text-dark text-base mb-3">
          3. LABA BERSIH OPERASIONAL (NET PROFIT)
        </h3>

        <div className="flex flex-col gap-2 text-sm font-sans">
          <div className={`flex justify-between items-center p-4 border-2 rounded-2xl ${isSurplus ? 'bg-primary/20 border-primary text-dark' : 'bg-accent/20 border-accent text-accent'}`}>
            <div>
              <div className="font-bold font-sans text-base">LABA BERSIH OPERASIONAL (NET PROFIT)</div>
              <div className="text-xs text-dark/60">Keuntungan murni dari aktivitas operasional club (Pendapatan – Beban)</div>
            </div>
            <div className="text-2xl font-bold font-sans">{formatRupiah(pnl.netProfit)}</div>
          </div>

          {/* Informasi Arus Kas Non-Operasional — informatif, bukan komponen laba */}
          {(pnl.nonOpKasbon !== 0 || pnl.nonOpKoreksi !== 0) && (
            <div className="mt-1">
              <div className="text-xs font-bold text-dark/50 uppercase tracking-wide mb-1.5">
                📋 Informasi Arus Kas Non-Operasional (tidak termasuk laba)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-dark/70">
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-2xl flex justify-between">
                  <span>Pergerakan Kas Kasbon Pelatih:</span>
                  <span className={`font-bold ${pnl.nonOpKasbon >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                    {pnl.nonOpKasbon >= 0 ? '+' : ''}{formatRupiah(pnl.nonOpKasbon)}
                  </span>
                </div>
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-2xl flex justify-between">
                  <span>Koreksi Saldo Fisik / Opname:</span>
                  <span className={`font-bold ${pnl.nonOpKoreksi >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                    {pnl.nonOpKoreksi >= 0 ? '+' : ''}{formatRupiah(pnl.nonOpKoreksi)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* ── Edukasi: Laba Bersih vs Saldo Kas ── */}
      <div className="p-4 bg-blue-50 border-2 border-blue-400 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 font-sans">
        <div className="flex items-start gap-3">
          <span className="text-2xl">💡</span>
          <div>
            <h4 className="font-bold text-blue-950 text-sm">Mengapa Laba Bersih ({formatRupiah(pnl.netProfit)}) Berbeda dengan Saldo Kas Riil ({formatRupiah(saldoKasRiil)})?</h4>
            <p className="text-xs text-blue-900/80 mt-0.5 leading-relaxed">
              <b>Laba Bersih</b> mencerminkan keuntungan dari aktivitas usaha dojang (pendapatan dikurangi biaya operasional). 
              Sedangkan <b>Saldo Kas Riil</b> adalah total fisik uang di bank & kas (termasuk modal awal, arus kasbon pelatih, dan koreksi opname fisik).
              Perbedaan keduanya adalah hal yang <b>normal</b> dalam standar akuntansi.
            </p>
          </div>
        </div>
        <div className="shrink-0 bg-white border-2 border-blue-300 px-4 py-2 rounded-2xl text-right">
          <div className="text-[10px] text-dark/50 uppercase font-bold">Selisih Kas vs Laba</div>
          <div className={`font-bold text-sm ${cashDifference >= 0 ? 'text-blue-900' : 'text-red-700'}`}>
            {cashDifference >= 0 ? '+' : ''}{formatRupiah(cashDifference)}
          </div>
        </div>
      </div>
    </div>
  )
}
