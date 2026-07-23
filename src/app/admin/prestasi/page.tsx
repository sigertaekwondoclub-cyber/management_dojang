'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
const supabase = createClient()
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import type { EventPeserta } from '@/lib/types'

export default function AdminPrestasiPage() {
  const [prestasiList, setPrestasiList] = useState<EventPeserta[]>([])
  const [loading, setLoading] = useState(true)

  const fetchPrestasi = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('event_peserta')
      .select('*, siswa:siswa_id(nama, sabuk_saat_ini, program_kelas_id), event_kompetisi:event_id(nama, tgl, lokasi)')
      .not('hasil', 'is', null) // Hanya peserta yang punya hasil/medali
      .order('created_at', { ascending: false })
    
    if (data) {
      // Filter out empty results if any slipped through as empty strings
      setPrestasiList(data.filter(p => p.hasil && p.hasil.trim() !== '') as EventPeserta[])
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchPrestasi()
  }, [fetchPrestasi])

  return (
    <div className="flex flex-col gap-8 max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold font-sans text-dark">🌟 Rekap Prestasi</h1>
        <p className="text-dark/60 font-sans mt-1">Daftar pencapaian medali/hasil event dari seluruh siswa</p>
      </div>

      <Card className="overflow-x-auto p-0 border-2 border-dark">
        {loading ? (
          <p className="p-12 text-center text-dark/50 font-sans">Memuat data...</p>
        ) : prestasiList.length === 0 ? (
          <div className="p-16 text-center text-dark/50 font-sans flex flex-col items-center gap-3">
            <span className="text-6xl">🌟</span>
            <p>Belum ada catatan prestasi atau hasil event.</p>
          </div>
        ) : (
          <table className="w-full text-left font-sans text-sm">
            <thead className="bg-primary/20 text-dark border-b-2 border-dark">
              <tr>
                <th className="p-4 font-bold">Siswa</th>
                <th className="p-4 font-bold">Event & Tanggal</th>
                <th className="p-4 font-bold">Pencapaian / Hasil</th>
                <th className="p-4 font-bold">Catatan Pelatih</th>
              </tr>
            </thead>
            <tbody>
              {prestasiList.map(item => (
                <tr key={item.id} className="border-b border-dark/10 hover:bg-background transition-colors">
                  <td className="p-4">
                    <div className="font-bold text-dark text-base">{item.siswa?.nama}</div>
                    <div className="text-xs text-dark/60 mt-1">Sabuk: {item.siswa?.sabuk_saat_ini}</div>
                  </td>
                  <td className="p-4">
                    <div className="font-bold text-dark">{item.event_kompetisi?.nama}</div>
                    <div className="text-xs text-dark/70 mt-1">
                      {item.event_kompetisi?.tgl && new Date(item.event_kompetisi.tgl).toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'})}
                      {item.event_kompetisi?.lokasi && ` · ${item.event_kompetisi.lokasi}`}
                    </div>
                  </td>
                  <td className="p-4">
                    <Badge color="secondary">{item.hasil}</Badge>
                  </td>
                  <td className="p-4 text-dark/70 italic max-w-xs truncate" title={item.catatan || ''}>
                    {item.catatan || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
