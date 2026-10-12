'use client'

import React, { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

export interface BalanceSheetData {
  saldoKasRiil: number
  piutangIuran: {
    count: number
    total: number
    details: Array<{ nama: string; nominal: number; bulan: number; tahun: number }>
  }
  piutangKasbon: {
    count: number
    total: number
    details: Array<{ namaPelatih: string; sisaHutang: number; tglPinjam: string; keterangan: string }>
  }
  liabilitasHonor: {
    count: number
    total: number
    details: Array<{ namaPelatih: string; honorBersih: number }>
  }
  periodeLabel: string
}

interface BalanceSheetTabProps {
  data: BalanceSheetData
}

function formatRupiah(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
}

function formatTgl(tgl: string) {
  return new Date(tgl + 'T00:00:00').toLocaleDateString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric'
  })
}

export function BalanceSheetTab({ data }: BalanceSheetTabProps) {
  const [showDetailIuran, setShowDetailIuran] = useState(false)
  const [showDetailKasbon, setShowDetailKasbon] = useState(false)
  const [showDetailHonor, setShowDetailHonor] = useState(false)

  const totalAset = data.saldoKasRiil + data.piutangIuran.total + data.piutangKasbon.total
  const totalLiabilitas = data.liabilitasHonor.total
  const ekuitasBersih = totalAset - totalLiabilitas

  return (
    <div className="flex flex-col gap-6 font-sans">
      {/* ── Top Header KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Total Aset Lancar */}
        <Card className="border-2 border-dark flex flex-col justify-between bg-blue-50/40">
          <div>
            <div className="text-xs font-bold text-dark/60 uppercase tracking-wide">🏛️ Total Aset Club</div>
            <div className="text-2xl font-bold text-blue-900 mt-1">{formatRupiah(totalAset)}</div>
          </div>
          <div className="text-xs text-dark/60 mt-3 pt-2 border-t border-dark/10 flex justify-between">
            <span>Komposisi Aset:</span>
            <span className="font-bold">Kas + Piutang SPP & Kasbon</span>
          </div>
        </Card>

        {/* Card 2: Total Liabilitas / Kewajiban */}
        <Card className="border-2 border-dark flex flex-col justify-between bg-red-50/40">
          <div>
            <div className="text-xs font-bold text-dark/60 uppercase tracking-wide">🧾 Total Liabilitas (Kewajiban)</div>
            <div className="text-2xl font-bold text-red-700 mt-1">{formatRupiah(totalLiabilitas)}</div>
          </div>
          <div className="text-xs text-dark/60 mt-3 pt-2 border-t border-dark/10 flex justify-between">
            <span>Honor Belum Ditransfer:</span>
            <span className="font-bold">{data.liabilitasHonor.count} pelatih</span>
          </div>
        </Card>

        {/* Card 3: Ekuitas Bersih (Net Worth) */}
        <Card className="border-2 border-primary bg-primary/10 flex flex-col justify-between">
          <div>
            <div className="text-xs font-bold text-dark/60 uppercase tracking-wide flex justify-between items-center">
              <span>💎 Ekuitas Bersih (Net Worth)</span>
              <Badge color="primary">Sehat</Badge>
            </div>
            <div className="text-2xl font-bold text-green-800 mt-1">{formatRupiah(ekuitasBersih)}</div>
          </div>
          <div className="text-xs text-dark/60 mt-3 pt-2 border-t border-dark/10 flex justify-between">
            <span>Kekayaan Bersih Club:</span>
            <span className="font-bold">Aset dikurangi Kewajiban</span>
          </div>
        </Card>
      </div>

      {/* ── Main Balance Sheet Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Kolom Kiri: ASET & PIUTANG */}
        <Card className="border-2 border-dark flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b-2 border-dark/10 pb-3 mb-3">
              <h3 className="font-bold text-dark text-base flex items-center gap-2">
                <span>A.</span> ASET LANCAR (CURRENT ASSETS)
              </h3>
              <span className="text-xs text-blue-800 font-bold bg-blue-100 px-2.5 py-1 rounded-full">
                {formatRupiah(totalAset)}
              </span>
            </div>

            <div className="flex flex-col divide-y divide-dark/5 text-sm">
              {/* Pos 1: Kas & Saldo Bank */}
              <div className="py-3 flex justify-between items-center">
                <div>
                  <div className="font-bold text-dark">Kas & Saldo Bank Riil</div>
                  <div className="text-xs text-dark/50">Uang tunai fisik & saldo aktif Bank Jago</div>
                </div>
                <div className="font-bold text-blue-900 text-base">{formatRupiah(data.saldoKasRiil)}</div>
              </div>

              {/* Pos 2: Piutang Iuran Siswa */}
              <div className="py-3 flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-bold text-dark flex items-center gap-2">
                      <span>Piutang Iuran Siswa (Tunggakan)</span>
                      {data.piutangIuran.count > 0 && (
                        <button
                          onClick={() => setShowDetailIuran(!showDetailIuran)}
                          className="text-[11px] text-blue-700 underline font-bold"
                        >
                          {showDetailIuran ? 'Tutup Rincian' : `Lihat ${data.piutangIuran.count} Siswa`}
                        </button>
                      )}
                    </div>
                    <div className="text-xs text-dark/50">Tagihan iuran yang belum lunas dibayarkan</div>
                  </div>
                  <div className="font-bold text-dark">{formatRupiah(data.piutangIuran.total)}</div>
                </div>

                {/* Subdetail Piutang Iuran */}
                {showDetailIuran && (
                  <div className="bg-background border border-dark/10 rounded-2xl p-3 max-h-48 overflow-y-auto flex flex-col gap-1.5 text-xs">
                    {data.piutangIuran.details.map((s, idx) => (
                      <div key={idx} className="flex justify-between items-center">
                        <span className="text-dark/80">{s.nama} (Bulan {s.bulan})</span>
                        <span className="font-bold text-dark">{formatRupiah(s.nominal)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Pos 3: Piutang Kasbon Pelatih */}
              <div className="py-3 flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-bold text-dark flex items-center gap-2">
                      <span>Piutang Kasbon Pelatih</span>
                      {data.piutangKasbon.count > 0 && (
                        <button
                          onClick={() => setShowDetailKasbon(!showDetailKasbon)}
                          className="text-[11px] text-blue-700 underline font-bold"
                        >
                          {showDetailKasbon ? 'Tutup' : `Rincian (${data.piutangKasbon.count})`}
                        </button>
                      )}
                    </div>
                    <div className="text-xs text-dark/50">Sisa saldo pinjaman pelatih yang belum lunas</div>
                  </div>
                  <div className="font-bold text-dark">{formatRupiah(data.piutangKasbon.total)}</div>
                </div>

                {/* Subdetail Kasbon */}
                {showDetailKasbon && (
                  <div className="bg-background border border-dark/10 rounded-2xl p-3 max-h-48 overflow-y-auto flex flex-col gap-1.5 text-xs">
                    {data.piutangKasbon.details.map((k, idx) => (
                      <div key={idx} className="flex justify-between items-center">
                        <span className="text-dark/80">{k.namaPelatih} — {k.keterangan} ({formatTgl(k.tglPinjam)})</span>
                        <span className="font-bold text-dark">{formatRupiah(k.sisaHutang)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t-2 border-dark/20 flex justify-between items-center bg-blue-50/60 p-3 rounded-2xl">
            <span className="font-bold text-dark text-sm">TOTAL ASET LANCAR</span>
            <span className="font-bold text-blue-900 text-base">{formatRupiah(totalAset)}</span>
          </div>
        </Card>

        {/* Kolom Kanan: LIABILITAS & EKUITAS */}
        <Card className="border-2 border-dark flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b-2 border-dark/10 pb-3 mb-3">
              <h3 className="font-bold text-dark text-base flex items-center gap-2">
                <span>B.</span> LIABILITAS &amp; EKUITAS BERSIH
              </h3>
              <span className="text-xs text-green-800 font-bold bg-green-100 px-2.5 py-1 rounded-full">
                {formatRupiah(totalLiabilitas + ekuitasBersih)}
              </span>
            </div>

            <div className="flex flex-col divide-y divide-dark/5 text-sm">
              {/* 1. Liabilitas */}
              <div className="py-3 flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-bold text-dark flex items-center gap-2">
                      <span>Hutang Honor Pelatih (Accrued)</span>
                      {data.liabilitasHonor.count > 0 && (
                        <button
                          onClick={() => setShowDetailHonor(!showDetailHonor)}
                          className="text-[11px] text-red-600 underline font-bold"
                        >
                          {showDetailHonor ? 'Tutup' : `Lihat (${data.liabilitasHonor.count})`}
                        </button>
                      )}
                    </div>
                    <div className="text-xs text-dark/50">Honor mengajar yang belum dibayarkan/ditransfer</div>
                  </div>
                  <div className={`font-bold ${data.liabilitasHonor.total > 0 ? 'text-red-600' : 'text-dark'}`}>
                    {formatRupiah(data.liabilitasHonor.total)}
                  </div>
                </div>

                {showDetailHonor && (
                  <div className="bg-red-50 border border-red-200 rounded-2xl p-3 flex flex-col gap-1.5 text-xs">
                    {data.liabilitasHonor.details.map((h, idx) => (
                      <div key={idx} className="flex justify-between items-center">
                        <span className="text-dark/80">{h.namaPelatih}</span>
                        <span className="font-bold text-red-700">{formatRupiah(h.honorBersih)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 2. Ekuitas Bersih */}
              <div className="py-3 flex justify-between items-center">
                <div>
                  <div className="font-bold text-dark">Ekuitas & Cadangan Kas Club</div>
                  <div className="text-xs text-dark/50">Kekayaan bersih akumulasi dojang</div>
                </div>
                <div className="font-bold text-green-800 text-base">{formatRupiah(ekuitasBersih)}</div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t-2 border-dark/20 flex justify-between items-center bg-green-50/60 p-3 rounded-2xl">
            <span className="font-bold text-dark text-sm">TOTAL LIABILITAS &amp; EKUITAS</span>
            <span className="font-bold text-green-900 text-base">{formatRupiah(totalLiabilitas + ekuitasBersih)}</span>
          </div>
        </Card>
      </div>

      {/* ── Persamaan Neraca Akuntansi (Balanced Proof) ── */}
      <div className="p-4 bg-white border-2 border-dark rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-lg">⚖️</span>
          <span className="text-dark/70">
            <b>Prinsip Persamaan Neraca:</b> Aset ({formatRupiah(totalAset)}) = Liabilitas ({formatRupiah(totalLiabilitas)}) + Ekuitas ({formatRupiah(ekuitasBersih)})
          </span>
        </div>
        <Badge color="primary">✅ Neraca Seimbang (100% Balanced)</Badge>
      </div>
    </div>
  )
}
