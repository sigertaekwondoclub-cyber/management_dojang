'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import type { EventKompetisi, EventPeserta, Siswa } from '@/lib/types'

function formatRupiah(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
}

export default function OrtuEventPage() {
  const [eventList, setEventList] = useState<EventKompetisi[]>([])
  const [riwayat, setRiwayat] = useState<EventPeserta[]>([])
  const [siswaInfo, setSiswaInfo] = useState<Siswa | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const supabase = createClient()

  const fetchData = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data: profile } = await supabase
      .from('profiles')
      .select('siswa_id')
      .eq('id', user.id)
      .single()

    if (!profile?.siswa_id) {
      setError('Akun belum terhubung ke data siswa. Hubungi admin.')
      setLoading(false)
      return
    }

    // Get Siswa Info
    const { data: sData } = await supabase
      .from('siswa')
      .select('*')
      .eq('id', profile.siswa_id)
      .single()
    if (sData) setSiswaInfo(sData as Siswa)

    // Get All Events (Upcoming)
    const today = new Date().toISOString().split('T')[0]
    const { data: eData } = await supabase
      .from('event_kompetisi')
      .select('*')
      .gte('tgl', today)
      .order('tgl', { ascending: true })
    if (eData) setEventList(eData as EventKompetisi[])

    // Get Riwayat Pendaftaran anak ini
    const { data: pData } = await supabase
      .from('event_peserta')
      .select('*, event_kompetisi(*)')
      .eq('siswa_id', profile.siswa_id)
      .order('created_at', { ascending: false })
    if (pData) setRiwayat(pData as EventPeserta[])

    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleDaftar = async (event: EventKompetisi) => {
    if (!siswaInfo) return
    setActionLoading(event.id)
    setError(null)
    setSuccess(null)

    const { error: insertErr } = await supabase
      .from('event_peserta')
      .insert({
        event_id: event.id,
        siswa_id: siswaInfo.id,
        status_daftar: 'terdaftar'
      })

    if (insertErr) {
      setError('Gagal mendaftar: ' + insertErr.message)
    } else {
      setSuccess(`Berhasil mendaftar ke ${event.nama}! Silakan selesaikan pembayaran ke admin.`)
      await fetchData()
    }
    setActionLoading(null)
  }

  // Pisahkan riwayat pendaftaran aktif (mendatang) vs selesai (sudah ada hasil / lewat)
  const registeredEventIds = riwayat.map(r => r.event_id)
  const availableEvents = eventList.filter(e => !registeredEventIds.includes(e.id))

  if (loading) {
    return <div className="max-w-4xl mx-auto py-12 text-center text-dark/50 font-bold font-sans">Memuat data event...</div>
  }

  if (error && !siswaInfo) {
    return (
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold font-sans text-dark mb-8">🥋 Pendaftaran Kompetisi</h1>
        <Card className="bg-accent/10 border-accent text-center py-16 text-dark font-bold font-sans">{error}</Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold font-sans text-dark">🥋 Event & Kompetisi</h1>
        {siswaInfo && (
          <p className="text-dark/60 font-sans mt-1">
            Daftarkan <span className="font-bold text-dark">{siswaInfo.nama}</span> untuk mengikuti event kejuaraan
          </p>
        )}
      </div>

      {error && <div className="p-4 bg-accent/20 text-accent font-bold rounded-xl text-sm border border-accent">{error}</div>}
      {success && <div className="p-4 bg-primary/20 text-dark font-bold rounded-xl text-sm border border-primary">{success}</div>}

      {/* Event Mendatang (Tersedia) */}
      <Card>
        <h2 className="font-bold font-sans text-dark mb-4 text-xl border-b-2 border-dark pb-2">📅 Event Mendatang (Tersedia)</h2>
        
        {availableEvents.length === 0 ? (
          <div className="py-8 text-center text-dark/50 font-sans">Belum ada event kompetisi baru yang tersedia saat ini.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {availableEvents.map(event => (
              <Card key={event.id} className="p-5 border-2 border-dark flex flex-col justify-between hover:shadow-brutal transition-all">
                <div>
                  <h3 className="font-bold text-lg text-dark leading-tight">{event.nama}</h3>
                  <div className="mt-2 text-sm text-dark/70 font-sans flex flex-col gap-1">
                    <div>📍 {event.lokasi}</div>
                    <div>🗓️ {new Date(event.tgl).toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year:'numeric'})}</div>
                    <div className="font-bold text-dark bg-background p-2 rounded-lg border border-dark/20 mt-1 inline-block w-max">
                      💰 {event.biaya_pendaftaran > 0 ? formatRupiah(event.biaya_pendaftaran) : 'Gratis'}
                    </div>
                  </div>
                  {event.keterangan && (
                    <p className="text-xs text-dark/60 mt-3 italic line-clamp-2">"{event.keterangan}"</p>
                  )}
                </div>
                <div className="mt-5">
                  <Button 
                    variant="primary" 
                    className="w-full font-bold"
                    onClick={() => handleDaftar(event)}
                    disabled={actionLoading === event.id}
                  >
                    {actionLoading === event.id ? 'Mendaftar...' : 'Pilih & Daftarkan Anak'}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>

      {/* Riwayat Pendaftaran / Hasil */}
      <Card>
        <h2 className="font-bold font-sans text-dark mb-4 text-xl border-b-2 border-dark pb-2">🎖️ Riwayat Event Anak</h2>
        
        {riwayat.length === 0 ? (
          <div className="py-8 text-center text-dark/50 font-sans">Anak Anda belum terdaftar di event kompetisi manapun.</div>
        ) : (
          <div className="flex flex-col gap-3">
            {riwayat.map(item => {
              const ev = item.event_kompetisi
              const isPast = ev ? new Date(ev.tgl) < new Date() : false
              
              return (
                <Card key={item.id} className="p-4 border border-dark/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-background">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold font-sans text-dark">{ev?.nama}</h3>
                      {item.status_daftar === 'batal' ? (
                        <Badge color="accent">Dibatalkan</Badge>
                      ) : (
                        isPast ? <Badge color="dark">Selesai</Badge> : <Badge color="secondary">Terdaftar / Mendatang</Badge>
                      )}
                    </div>
                    <div className="text-sm text-dark/60 font-sans">
                      {ev && new Date(ev.tgl).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year:'numeric'})} · {ev?.lokasi}
                    </div>
                  </div>
                  
                  {/* Bagian Hasil */}
                  {item.status_daftar === 'terdaftar' && (
                    <div className="sm:text-right border-t sm:border-t-0 sm:border-l border-dark/20 pt-3 sm:pt-0 sm:pl-4 mt-2 sm:mt-0 min-w-[200px]">
                      {item.hasil ? (
                        <div className="flex flex-col sm:items-end">
                          <span className="text-xs text-dark/50 uppercase tracking-wider font-bold mb-1">Pencapaian</span>
                          <Badge color="primary" className="text-sm py-1">{item.hasil}</Badge>
                        </div>
                      ) : (
                        <div className="text-sm text-dark/50 italic">
                          {isPast ? 'Menunggu penilaian pelatih...' : 'Belum dipertandingkan'}
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}
