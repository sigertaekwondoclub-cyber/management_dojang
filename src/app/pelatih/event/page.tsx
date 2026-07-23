'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { EventKompetisi, EventPeserta } from '@/lib/types'

export default function PelatihEventPage() {
  const [eventList, setEventList] = useState<EventKompetisi[]>([])
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [pesertaList, setPesertaList] = useState<EventPeserta[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  // Form State
  const [evalPesertaId, setEvalPesertaId] = useState<string | null>(null)
  const [formHasil, setFormHasil] = useState('')
  const [formCatatan, setFormCatatan] = useState('')
  const [formLoading, setFormLoading] = useState(false)

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('event_kompetisi')
      .select('*')
      .order('tgl', { ascending: false })
    
    if (data) setEventList(data as EventKompetisi[])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  const fetchPeserta = useCallback(async (eventId: string) => {
    setLoading(true)
    const { data } = await supabase
      .from('event_peserta')
      .select('*, siswa:siswa_id(nama, sabuk_saat_ini)')
      .eq('event_id', eventId)
      .eq('status_daftar', 'terdaftar')
      .order('created_at', { ascending: true })
    
    if (data) setPesertaList(data as EventPeserta[])
    setSelectedEventId(eventId)
    setLoading(false)
  }, [supabase])

  const openEval = (peserta: EventPeserta) => {
    setEvalPesertaId(peserta.id)
    setFormHasil(peserta.hasil || '')
    setFormCatatan(peserta.catatan || '')
  }

  const submitEval = async () => {
    if (!evalPesertaId || !selectedEventId) return
    setFormLoading(true)

    const { error } = await supabase
      .from('event_peserta')
      .update({
        hasil: formHasil || null,
        catatan: formCatatan || null
      })
      .eq('id', evalPesertaId)

    if (!error) {
      setEvalPesertaId(null)
      await fetchPeserta(selectedEventId)
    }
    setFormLoading(false)
  }

  return (
    <div className="flex flex-col gap-8 max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold font-sans text-dark">🥋 Input Prestasi Event</h1>
        <p className="text-dark/60 font-sans mt-1">Pilih event kompetisi dan masukkan hasil/medali siswa</p>
      </div>

      {!selectedEventId ? (
        <Card className="p-0 border-2 border-dark overflow-hidden">
          <h2 className="p-4 bg-dark text-white font-bold font-sans text-lg">Pilih Event</h2>
          {loading ? (
            <p className="p-8 text-center text-dark/50 font-sans">Memuat data...</p>
          ) : eventList.length === 0 ? (
            <p className="p-8 text-center text-dark/50 font-sans">Belum ada event tersedia.</p>
          ) : (
            <div className="flex flex-col">
              {eventList.map(item => (
                <button
                  key={item.id}
                  onClick={() => fetchPeserta(item.id)}
                  className="p-4 text-left border-b border-dark/10 hover:bg-primary/10 transition-colors flex justify-between items-center group"
                >
                  <div>
                    <div className="font-bold text-dark text-lg group-hover:text-primary transition-colors">{item.nama}</div>
                    <div className="text-sm text-dark/60 mt-1">
                      {new Date(item.tgl).toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year:'numeric'})} · {item.lokasi}
                    </div>
                  </div>
                  <div className="text-dark/50 font-bold font-sans">Lihat Peserta →</div>
                </button>
              ))}
            </div>
          )}
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          <Button variant="secondary" onClick={() => setSelectedEventId(null)} className="w-max">← Kembali ke Daftar Event</Button>
          
          <Card className="p-0 overflow-x-auto border-2 border-dark">
            <div className="p-4 bg-secondary/20 border-b-2 border-dark flex justify-between items-center">
              <div>
                <h2 className="font-bold font-sans text-dark text-xl">Daftar Peserta</h2>
                <p className="text-sm text-dark/60">
                  {eventList.find(e => e.id === selectedEventId)?.nama}
                </p>
              </div>
              <Badge color="dark">{pesertaList.length} Peserta</Badge>
            </div>
            
            {loading ? (
              <p className="p-8 text-center text-dark/50 font-sans">Memuat peserta...</p>
            ) : pesertaList.length === 0 ? (
              <p className="p-12 text-center text-dark/50 font-sans">Belum ada siswa yang mendaftar di event ini.</p>
            ) : (
              <table className="w-full text-left font-sans text-sm">
                <thead className="bg-background border-b-2 border-dark">
                  <tr>
                    <th className="p-4 font-bold text-dark">Siswa</th>
                    <th className="p-4 font-bold text-dark">Sabuk</th>
                    <th className="p-4 font-bold text-dark">Hasil/Pencapaian</th>
                    <th className="p-4 font-bold text-dark">Catatan</th>
                    <th className="p-4 font-bold text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {pesertaList.map(item => (
                    <tr key={item.id} className="border-b border-dark/10 hover:bg-background transition-colors">
                      <td className="p-4 font-bold text-dark">{item.siswa?.nama}</td>
                      <td className="p-4 text-dark/70">{item.siswa?.sabuk_saat_ini}</td>
                      <td className="p-4">
                        {item.hasil ? <Badge color="primary">{item.hasil}</Badge> : <span className="text-dark/40 italic">-</span>}
                      </td>
                      <td className="p-4 text-dark/70 italic text-xs">{item.catatan || '-'}</td>
                      <td className="p-4 text-right">
                        <Button variant="secondary" onClick={() => openEval(item)} className="px-3 py-1.5 text-xs">
                          {item.hasil ? '✏️ Edit' : '📝 Input Hasil'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      )}

      {/* Modal Input Hasil */}
      {evalPesertaId && (
        <div className="fixed inset-0 bg-dark/50 flex items-center justify-center p-4 z-50">
          <Card className="max-w-md w-full flex flex-col gap-4 border-2 border-dark shadow-[8px_8px_0px_0px_rgba(30,42,56,1)]">
            <h3 className="font-bold font-sans text-xl text-dark">Input Hasil Event</h3>
            
            <Input 
              label="Hasil / Pencapaian" 
              placeholder="Contoh: Juara 1 Kyorugi U-45kg"
              value={formHasil}
              onChange={e => setFormHasil(e.target.value)}
            />
            
            <Input 
              label="Catatan (Opsional)" 
              placeholder="Bermain agresif..."
              value={formCatatan}
              onChange={e => setFormCatatan(e.target.value)}
            />

            <div className="flex justify-end gap-3 mt-4 pt-4 border-t-2 border-dark/10">
              <Button variant="secondary" onClick={() => setEvalPesertaId(null)}>Batal</Button>
              <Button variant="primary" onClick={submitEval} disabled={formLoading || !formHasil.trim()}>
                {formLoading ? 'Menyimpan...' : '💾 Simpan Hasil'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
