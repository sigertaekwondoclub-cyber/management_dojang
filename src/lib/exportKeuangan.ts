import * as XLSX from 'xlsx'

export interface FinancialExportItem {
  no: number
  tgl: string
  jenis: 'Income' | 'Expense'
  sumber: string
  kategori: string
  keterangan: string
  metode: string
  pemasukan: number
  pengeluaran: number
  saldoKumulatif: number
}

export interface FinancialSummaryInfo {
  totalIncome: number
  totalExpense: number
  saldoBersih: number
  incomeIuran: number
  incomeMerchant: number
  incomeManual: number
  expenseHonor: number
  expenseManual: number
  iuranTunai?: number
  iuranTransfer?: number
}

function formatRupiahNum(n: number): string {
  return 'Rp ' + Number(n || 0).toLocaleString('id-ID')
}

export function exportKeuanganToExcel({
  filename,
  periodeLabel,
  summary,
  transactions,
}: {
  filename?: string
  periodeLabel: string
  summary: FinancialSummaryInfo
  transactions: FinancialExportItem[]
}) {
  const wb = XLSX.utils.book_new()
  const todayStr = new Date().toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

  // 1. Header & Metadata
  const wsData: (string | number)[][] = [
    ['SIGER TAEKWONDO CLUB'],
    ['LAPORAN ARUS KAS & KEUANGAN RESMI'],
    [`Periode: ${periodeLabel}`],
    [`Tanggal Ekspor: ${todayStr}`],
    [],
    ['RINGKASAN KEUANGAN:'],
    ['Total Pemasukan (Income)', summary.totalIncome],
    ['  - Iuran Siswa Bulanan', summary.incomeIuran],
    ...(summary.iuranTunai !== undefined && summary.iuranTransfer !== undefined ? [
      ['      * Tunai (Fisik)', summary.iuranTunai],
      ['      * Transfer / Bank', summary.iuranTransfer],
    ] : []),
    ['  - Penjualan Toko Merchant', summary.incomeMerchant],
    ['  - Kas Manual / Lainnya', summary.incomeManual],
    ['Total Pengeluaran (Expense)', summary.totalExpense],
    ['  - Honor Pelatih (Bersih)', summary.expenseHonor],
    ['  - Operasional & Kas Manual', summary.expenseManual],
    ['Saldo Kas Bersih (Surplus / Defisit)', summary.saldoBersih],
    [],
    [
      'No',
      'Tanggal',
      'Jenis',
      'Sumber',
      'Kategori',
      'Keterangan / Rincian',
      'Metode',
      'Pemasukan (Rp)',
      'Pengeluaran (Rp)',
      'Saldo Kumulatif (Rp)',
    ],
  ]

  // 2. Baris Transaksi Terperinci
  transactions.forEach((tx) => {
    wsData.push([
      tx.no,
      tx.tgl,
      tx.jenis,
      tx.sumber,
      tx.kategori,
      tx.keterangan,
      tx.metode || '-',
      tx.pemasukan,
      tx.pengeluaran,
      tx.saldoKumulatif,
    ])
  })

  // 3. Baris Total Akumulatif di Akhir
  wsData.push([
    'TOTAL',
    '',
    '',
    '',
    '',
    `Total ${transactions.length} Transaksi`,
    '',
    summary.totalIncome,
    summary.totalExpense,
    summary.saldoBersih,
  ])

  const ws = XLSX.utils.aoa_to_sheet(wsData)

  // 4. Atur Lebar Kolom (Column Widths)
  ws['!cols'] = [
    { wch: 6 },  // No
    { wch: 13 }, // Tanggal
    { wch: 11 }, // Jenis
    { wch: 18 }, // Sumber
    { wch: 22 }, // Kategori
    { wch: 45 }, // Keterangan
    { wch: 14 }, // Metode
    { wch: 18 }, // Pemasukan
    { wch: 18 }, // Pengeluaran
    { wch: 22 }, // Saldo Kumulatif
  ]

  XLSX.utils.book_append_sheet(wb, ws, 'Mutasi Kas')

  // 5. Download File Excel
  const safeFilename = filename || `Laporan_Kas_Siger_TKD_${periodeLabel.replace(/[^a-zA-Z0-9_-]/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`
  XLSX.writeFile(wb, safeFilename)
}
