'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
const supabase = createClient()
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import type { EventKompetisi } from '@/lib/types'

function formatRupiah(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
}

interface SiswaItem {
  id: string
  nama: string
  sabuk_saat_ini: string
  program_kelas_id?: string
  program_kelas?: {
    nama_program: string
  } | null
}

interface PesertaWithSiswa {
  id: string
  event_id: string
  siswa_id: string
  status_daftar: string
  hasil: string | null
  catatan: string | null
  created_at: string
  siswa?: {
    id: string
    nama: string
    sabuk_saat_ini: string
    no_hp_ortu: string
    program_kelas?: {
      nama_program: string
    } | null
  }
}

export default function AdminEventPage() {
  const [eventList, setEventList] = useState<EventKompetisi[]>([])
  const [pesertaCountMap, setPesertaCountMap] = useState<Record<string, number>>({})
  const [siswaList, setSiswaList] = useState<SiswaItem[]>([])
  const [loading, setLoading] = useState(true)

  // Form State (Buat / Edit Event)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    nama: '',
    tgl: '',
    lokasi: '',
    biaya_pendaftaran: '0',
    keterangan: ''
  })
  const [selectedSiswaIds, setSelectedSiswaIds] = useState<string[]>([])
  const [siswaSearchQuery, setSiswaSearchQuery] = useState('')
  const [siswaFilterKelas, setSiswaFilterKelas] = useState<'semua' | 'prestasi' | 'reguler'>('semua')
  const [showDirectSiswaPicker, setShowDirectSiswaPicker] = useState(false)
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [formSuccess, setFormSuccess] = useState<string | null>(null)

  // Modal State (Kelola Peserta)
  const [kelolaEvent, setKelolaEvent] = useState<EventKompetisi | null>(null)
  const [pesertaList, setPesertaList] = useState<PesertaWithSiswa[]>([])
  const [loadingPeserta, setLoadingPeserta] = useState(false)
  const [addPesertaSelectedId, setAddPesertaSelectedId] = useState('')
  const [addingPesertaLoading, setAddingPesertaLoading] = useState(false)
  const [pesertaMsg, setPesertaMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [copyToast, setCopyToast] = useState(false)

  // Hasil / Medali Modal State
  const [evalPeserta, setEvalPeserta] = useState<PesertaWithSiswa | null>(null)
  const [formHasil, setFormHasil] = useState('')
  const [formCatatan, setFormCatatan] = useState('')
  const [savingHasil, setSavingHasil] = useState(false)

  // 1. Fetch Events, Peserta Count, & Siswa Aktif
  const fetchEvents = useCallback(async () => {
    setLoading(true)
    try {
      const [eventRes, pesertaRes, siswaRes] = await Promise.all([
        supabase
          .from('event_kompetisi')
          .select('*')
          .order('tgl', { ascending: false }),
        supabase
          .from('event_peserta')
          .select('id, event_id, status_daftar'),
        supabase
          .from('siswa')
          .select('id, nama, sabuk_saat_ini, program_kelas_id, program_kelas:program_kelas_id(nama_program)')
          .eq('status_aktif', true)
          .order('nama', { ascending: true })
      ])

      if (eventRes.data) setEventList(eventRes.data as EventKompetisi[])

      // Hitung peserta per event
      const countMap: Record<string, number> = {}
      if (pesertaRes.data) {
        pesertaRes.data.forEach((p: any) => {
          if (p.status_daftar === 'terdaftar') {
            countMap[p.event_id] = (countMap[p.event_id] || 0) + 1
          }
        })
      }
      setPesertaCountMap(countMap)

      if (siswaRes.data) {
        setSiswaList(siswaRes.data as unknown as SiswaItem[])
      }
    } catch (err: any) {
      console.error('Gagal mengambil data event:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  // 2. Fetch Peserta Khusus Event Tertentu (Modal)
  const fetchPesertaModal = useCallback(async (eventId: string) => {
    setLoadingPeserta(true)
    setPesertaMsg(null)
    try {
      const { data, error } = await supabase
        .from('event_peserta')
        .select('*, siswa:siswa_id(id, nama, sabuk_saat_ini, no_hp_ortu, program_kelas:program_kelas_id(nama_program))')
        .eq('event_id', eventId)
        .order('created_at', { ascending: true })

      if (error) throw error
      setPesertaList((data || []) as unknown as PesertaWithSiswa[])
    } catch (err: any) {
      setPesertaMsg({ text: 'Gagal memuat peserta: ' + err.message, type: 'error' })
    } finally {
      setLoadingPeserta(false)
    }
  }, [])

  const openKelolaPeserta = (event: EventKompetisi) => {
    setKelolaEvent(event)
    setAddPesertaSelectedId('')
    setPesertaMsg(null)
    fetchPesertaModal(event.id)
  }

  const closeKelolaPeserta = () => {
    setKelolaEvent(null)
    setPesertaList([])
    setAddPesertaSelectedId('')
    setPesertaMsg(null)
    fetchEvents() // refresh counts
  }

  // 3. Tambah Peserta Cepat dari Modal
  const handleAddSinglePeserta = async () => {
    if (!kelolaEvent || !addPesertaSelectedId) return
    setAddingPesertaLoading(true)
    setPesertaMsg(null)

    try {
      const { error } = await supabase
        .from('event_peserta')
        .insert({
          event_id: kelolaEvent.id,
          siswa_id: addPesertaSelectedId,
          status_daftar: 'terdaftar'
        })

      if (error) throw error

      setPesertaMsg({ text: '✅ Peserta berhasil didaftarkan ke event!', type: 'success' })
      setAddPesertaSelectedId('')
      await fetchPesertaModal(kelolaEvent.id)
      setPesertaCountMap(prev => ({
        ...prev,
        [kelolaEvent.id]: (prev[kelolaEvent.id] || 0) + 1
      }))
    } catch (err: any) {
      setPesertaMsg({ text: '⚠️ Gagal mendaftarkan: ' + err.message, type: 'error' })
    } finally {
      setAddingPesertaLoading(false)
    }
  }

  // 4. Hapus Peserta dari Modal
  const handleDeletePeserta = async (pesertaId: string, namaSiswa: string) => {
    if (!window.confirm(`Hapus ${namaSiswa} dari daftar peserta event ini?`)) return
    if (!kelolaEvent) return

    try {
      const { error } = await supabase
        .from('event_peserta')
        .delete()
        .eq('id', pesertaId)

      if (error) throw error

      setPesertaMsg({ text: `✅ ${namaSiswa} berhasil dihapus dari peserta event.`, type: 'success' })
      await fetchPesertaModal(kelolaEvent.id)
      setPesertaCountMap(prev => ({
        ...prev,
        [kelolaEvent.id]: Math.max(0, (prev[kelolaEvent.id] || 0) - 1)
      }))
    } catch (err: any) {
      setPesertaMsg({ text: '⚠️ Gagal menghapus peserta: ' + err.message, type: 'error' })
    }
  }

  // 4b. Input / Edit Hasil Prestasi Atlet
  const openHasilModal = (peserta: PesertaWithSiswa) => {
    setEvalPeserta(peserta)
    setFormHasil(peserta.hasil || '')
    setFormCatatan(peserta.catatan || '')
  }

  const handleSaveHasil = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!evalPeserta || !kelolaEvent) return
    setSavingHasil(true)

    try {
      const { error } = await supabase
        .from('event_peserta')
        .update({
          hasil: formHasil.trim() || null,
          catatan: formCatatan.trim() || null
        })
        .eq('id', evalPeserta.id)

      if (error) throw error

      setPesertaMsg({ 
        text: `✅ Prestasi untuk ${evalPeserta.siswa?.nama || 'atlet'} berhasil diperbarui!`, 
        type: 'success' 
      })
      setEvalPeserta(null)
      await fetchPesertaModal(kelolaEvent.id)
    } catch (err: any) {
      alert('Gagal menyimpan hasil: ' + err.message)
    } finally {
      setSavingHasil(false)
    }
  }

  // 5. Salin Rekap Atlet untuk WhatsApp
  const handleCopyWAText = () => {
    if (!kelolaEvent) return
    const activePeserta = pesertaList.filter(p => p.status_daftar === 'terdaftar')
    const tglFormatted = new Date(kelolaEvent.tgl).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })

    const text = `🥋 *DAFTAR KONTINGEN ATLET*\n*SIGER TAEKWONDO CLUB*\n\n` +
      `🏆 *Event*: ${kelolaEvent.nama}\n` +
      `📅 *Tanggal*: ${tglFormatted}\n` +
      `📍 *Lokasi*: ${kelolaEvent.lokasi}\n` +
      `💰 *Biaya*: ${formatRupiah(kelolaEvent.biaya_pendaftaran)}\n\n` +
      `📋 *Daftar Atlet (${activePeserta.length} Orang)*:\n` +
      activePeserta.map((p, idx) => {
        const s = p.siswa
        const prog = s?.program_kelas?.nama_program ? ` (${s.program_kelas.nama_program})` : ''
        return `${idx + 1}. ${s?.nama || 'Atlet'} — Sabuk ${s?.sabuk_saat_ini || 'Putih'}${prog}`
      }).join('\n') +
      `\n\nSemoga seluruh atlet bertanding dengan sportivitas dan meraih prestasi terbaik! 🥇🥋`

    navigator.clipboard.writeText(text)
    setCopyToast(true)
    setTimeout(() => setCopyToast(false), 3000)
  }

  // 6. Form Tambah / Edit Event Handlers
  const openAddForm = () => {
    setEditingId(null)
    setFormData({ nama: '', tgl: '', lokasi: '', biaya_pendaftaran: '0', keterangan: '' })
    setSelectedSiswaIds([])
    setShowDirectSiswaPicker(false)
    setSiswaSearchQuery('')
    setSiswaFilterKelas('semua')
    setIsFormOpen(true)
    setFormError(null)
    setFormSuccess(null)
  }

  const openEditForm = (event: EventKompetisi) => {
    setEditingId(event.id)
    setFormData({
      nama: event.nama,
      tgl: event.tgl,
      lokasi: event.lokasi,
      biaya_pendaftaran: String(event.biaya_pendaftaran),
      keterangan: event.keterangan || ''
    })
    setSelectedSiswaIds([])
    setShowDirectSiswaPicker(false)
    setSiswaSearchQuery('')
    setSiswaFilterKelas('semua')
    setIsFormOpen(true)
    setFormError(null)
    setFormSuccess(null)
  }

  // Filtered Siswa untuk Form Buat Event
  const filteredSiswaForForm = useMemo(() => {
    return siswaList.filter(s => {
      const matchSearch = s.nama.toLowerCase().includes(siswaSearchQuery.toLowerCase()) ||
        s.sabuk_saat_ini.toLowerCase().includes(siswaSearchQuery.toLowerCase())
      if (!matchSearch) return false

      if (siswaFilterKelas === 'prestasi') {
        return s.program_kelas?.nama_program.toLowerCase().includes('prestasi')
      }
      if (siswaFilterKelas === 'reguler') {
        return !s.program_kelas?.nama_program.toLowerCase().includes('prestasi')
      }
      return true
    })
  }, [siswaList, siswaSearchQuery, siswaFilterKelas])

  const toggleSelectSiswa = (siswaId: string) => {
    setSelectedSiswaIds(prev => 
      prev.includes(siswaId) ? prev.filter(id => id !== siswaId) : [...prev, siswaId]
    )
  }

  const handleSelectAllFiltered = () => {
    const ids = filteredSiswaForForm.map(s => s.id)
    setSelectedSiswaIds(prev => Array.from(new Set([...prev, ...ids])))
  }

  const handleResetSelected = () => {
    setSelectedSiswaIds([])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormLoading(true)
    setFormError(null)
    setFormSuccess(null)

    const payload = {
      nama: formData.nama,
      tgl: formData.tgl,
      lokasi: formData.lokasi,
      biaya_pendaftaran: Number(formData.biaya_pendaftaran),
      keterangan: formData.keterangan || null
    }

    try {
      let savedEventId = editingId

      if (editingId) {
        const { error: updateError } = await supabase
          .from('event_kompetisi')
          .update(payload)
          .eq('id', editingId)
        if (updateError) throw updateError
      } else {
        const { data: newEvent, error: insertError } = await supabase
          .from('event_kompetisi')
          .insert([payload])
          .select('id')
          .single()
        if (insertError) throw insertError
        savedEventId = newEvent.id
      }

      // Jika ada siswa yang dipilih langsung, daftarkan ke event_peserta
      if (savedEventId && selectedSiswaIds.length > 0) {
        const rows = selectedSiswaIds.map(siswa_id => ({
          event_id: savedEventId as string,
          siswa_id,
          status_daftar: 'terdaftar'
        }))

        const { error: pesertaErr } = await supabase
          .from('event_peserta')
          .upsert(rows, { onConflict: 'event_id, siswa_id' })

        if (pesertaErr) {
          console.warn('Event tersimpan namun sebagian peserta gagal didaftarkan:', pesertaErr.message)
        }
      }

      setFormSuccess(editingId 
        ? `✅ Event diperbarui! (${selectedSiswaIds.length > 0 ? `${selectedSiswaIds.length} peserta ditambahkan` : ''})`
        : `✅ Event baru ditambahkan! (${selectedSiswaIds.length} peserta berhasil didaftarkan langsung)`
      )

      await fetchEvents()
      setTimeout(() => setIsFormOpen(false), 1500)
    } catch (err: any) {
      setFormError('Gagal menyimpan: ' + err.message)
    } finally {
      setFormLoading(false)
    }
  }

  const handleDelete = async (id: string, nama: string) => {
    if (!window.confirm(`Apakah Anda yakin ingin menghapus event "${nama}"? Data pendaftaran peserta juga akan terhapus.`)) return
    
    const { error } = await supabase.from('event_kompetisi').delete().eq('id', id)
    if (error) {
      alert('Gagal menghapus event: ' + error.message)
    } else {
      await fetchEvents()
    }
  }

  // Siswa yang belum terdaftar di modal saat ini
  const registeredSiswaIdsInModal = useMemo(() => {
    return new Set(pesertaList.map(p => p.siswa_id))
  }, [pesertaList])

  const unregisteredSiswaForModal = useMemo(() => {
    return siswaList.filter(s => !registeredSiswaIdsInModal.has(s.id))
  }, [siswaList, registeredSiswaIdsInModal])

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold font-sans text-dark">🥋 Kelola Event & Kejuaraan</h1>
          <p className="text-dark/60 font-sans mt-1">Buat kejuaraan baru, kelola kontingen atlet, dan daftarkan siswa secara langsung</p>
        </div>
        <Button variant="primary" onClick={openAddForm}>➕ Tambah Event Baru</Button>
      </div>

      {/* FORM BUAT / EDIT EVENT */}
      {isFormOpen && (
        <Card className="border-primary border-2 bg-primary/5">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold font-sans text-dark">
              {editingId ? 'Edit Event' : 'Tambah Event Baru & Daftarkan Siswa Langsung'}
            </h2>
            <button onClick={() => setIsFormOpen(false)} className="text-dark hover:text-accent font-bold text-lg">✕</button>
          </div>
          
          {formError && <div className="mb-4 p-3 bg-accent/20 text-accent font-bold rounded-xl text-sm border border-accent">{formError}</div>}
          {formSuccess && <div className="mb-4 p-3 bg-primary/20 text-dark font-bold rounded-xl text-sm border border-primary">{formSuccess}</div>}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Nama Event / Kejuaraan" value={formData.nama} onChange={e => setFormData({...formData, nama: e.target.value})} placeholder="Contoh: Kejuaraan Daerah Lampung Open 2026" required />
              <Input label="Tanggal Pelaksanaan" type="date" value={formData.tgl} onChange={e => setFormData({...formData, tgl: e.target.value})} required />
              <Input label="Lokasi / Venue" value={formData.lokasi} onChange={e => setFormData({...formData, lokasi: e.target.value})} placeholder="Contoh: GOR Saburai, Bandar Lampung" required />
              <Input label="Biaya Pendaftaran (Rp)" type="number" value={formData.biaya_pendaftaran} onChange={e => setFormData({...formData, biaya_pendaftaran: e.target.value})} required />
              <div className="md:col-span-2">
                <Input label="Keterangan / Persyaratan (Opsional)" value={formData.keterangan} onChange={e => setFormData({...formData, keterangan: e.target.value})} placeholder="Contoh: Kategori Kyorugi & Poomsae Cadet/Junior" />
              </div>
            </div>

            {/* SECTION: DAFTARKAN SISWA LANGSUNG */}
            <div className="border-2 border-dark/20 rounded-2xl p-4 bg-white">
              <div className="flex justify-between items-center flex-wrap gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">👥</span>
                  <div>
                    <h3 className="font-bold text-dark font-sans text-sm">
                      Daftarkan Atlet / Siswa Langsung (Opsional)
                    </h3>
                    <p className="text-xs text-dark/60 font-sans">
                      {selectedSiswaIds.length > 0 
                        ? `✅ ${selectedSiswaIds.length} siswa dipilih untuk diikutsertakan otomatis`
                        : 'Pilih siswa sekarang tanpa perlu menunggu orang tua mendaftar sendiri'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDirectSiswaPicker(!showDirectSiswaPicker)}
                  className="text-xs font-bold font-sans px-3 py-1.5 rounded-lg border-2 border-dark bg-secondary hover:bg-secondary/80 text-dark transition-all"
                >
                  {showDirectSiswaPicker ? '▲ Sembunyikan Daftar Siswa' : '▼ Tampilkan & Pilih Siswa'}
                </button>
              </div>

              {showDirectSiswaPicker && (
                <div className="flex flex-col gap-3 pt-3 border-t border-dark/10">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <input
                      type="text"
                      placeholder="🔍 Cari nama siswa / sabuk..."
                      value={siswaSearchQuery}
                      onChange={e => setSiswaSearchQuery(e.target.value)}
                      className="border-2 border-dark rounded-xl px-3 py-1.5 text-xs bg-background text-dark font-sans focus:outline-none focus:ring-1 focus:ring-primary w-full sm:w-64"
                    />
                    <div className="flex gap-2 flex-wrap items-center">
                      <div className="flex rounded-lg border border-dark overflow-hidden text-xs">
                        <button
                          type="button"
                          onClick={() => setSiswaFilterKelas('semua')}
                          className={`px-2.5 py-1 font-bold ${siswaFilterKelas === 'semua' ? 'bg-dark text-white' : 'bg-white text-dark'}`}
                        >
                          Semua
                        </button>
                        <button
                          type="button"
                          onClick={() => setSiswaFilterKelas('prestasi')}
                          className={`px-2.5 py-1 font-bold ${siswaFilterKelas === 'prestasi' ? 'bg-dark text-white' : 'bg-white text-dark'}`}
                        >
                          Prestasi
                        </button>
                        <button
                          type="button"
                          onClick={() => setSiswaFilterKelas('reguler')}
                          className={`px-2.5 py-1 font-bold ${siswaFilterKelas === 'reguler' ? 'bg-dark text-white' : 'bg-white text-dark'}`}
                        >
                          Reguler
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={handleSelectAllFiltered}
                        className="text-xs font-bold text-dark px-2.5 py-1 bg-primary/20 rounded border border-dark hover:bg-primary/30"
                      >
                        Pilih Semua ({filteredSiswaForForm.length})
                      </button>
                      {selectedSiswaIds.length > 0 && (
                        <button
                          type="button"
                          onClick={handleResetSelected}
                          className="text-xs font-bold text-accent px-2.5 py-1 bg-accent/10 rounded border border-accent hover:bg-accent/20"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-56 overflow-y-auto p-1">
                    {filteredSiswaForForm.map(s => {
                      const isSelected = selectedSiswaIds.includes(s.id)
                      return (
                        <label
                          key={s.id}
                          className={`flex items-center gap-2.5 p-2 rounded-xl border-2 cursor-pointer transition-all ${
                            isSelected 
                              ? 'border-primary bg-primary/10 shadow-sm' 
                              : 'border-dark/10 bg-white hover:border-dark/30'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectSiswa(s.id)}
                            className="w-4 h-4 rounded border-2 border-dark accent-primary cursor-pointer"
                          />
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs font-bold text-dark truncate font-sans">{s.nama}</span>
                            <div className="flex items-center gap-1.5 text-[10px] text-dark/60 font-sans">
                              <span>Sabuk {s.sabuk_saat_ini}</span>
                              {s.program_kelas?.nama_program && (
                                <span className="text-primary font-bold">· {s.program_kelas.nama_program}</span>
                              )}
                            </div>
                          </div>
                        </label>
                      )
                    })}
                    {filteredSiswaForForm.length === 0 && (
                      <p className="col-span-full py-4 text-center text-xs text-dark/50 font-sans">
                        Tidak ada siswa yang sesuai pencarian.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex justify-end gap-3 mt-2">
              <Button type="button" variant="secondary" onClick={() => setIsFormOpen(false)}>Batal</Button>
              <Button type="submit" variant="primary" disabled={formLoading}>
                {formLoading ? 'Menyimpan...' : (
                  editingId ? '💾 Simpan Perubahan' : `⚡ Simpan Event ${selectedSiswaIds.length > 0 ? `+ ${selectedSiswaIds.length} Atlet` : ''}`
                )}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* TABEL EVENT KOMPETISI */}
      <Card className="overflow-x-auto p-0 border-2 border-dark">
        {loading ? (
          <p className="p-8 text-center text-dark/50 font-sans font-bold">Memuat data event & kompetisi...</p>
        ) : (
          <table className="w-full text-left font-sans text-sm">
            <thead className="bg-dark text-white">
              <tr>
                <th className="p-4 font-bold">Tanggal</th>
                <th className="p-4 font-bold">Nama Event & Venue</th>
                <th className="p-4 font-bold">Biaya</th>
                <th className="p-4 font-bold text-center">Peserta Terdaftar</th>
                <th className="p-4 font-bold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {eventList.map(item => {
                const count = pesertaCountMap[item.id] || 0
                return (
                  <tr key={item.id} className="border-b border-dark/10 hover:bg-background transition-colors">
                    <td className="p-4 text-dark/70 whitespace-nowrap">
                      {new Date(item.tgl).toLocaleDateString('id-ID', {day: '2-digit', month: 'short', year:'numeric'})}
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-dark text-base">{item.nama}</div>
                      <div className="text-xs text-dark/70 flex items-center gap-1 mt-0.5">
                        <span>📍 {item.lokasi}</span>
                      </div>
                      {item.keterangan && <div className="text-xs text-dark/50 mt-1 line-clamp-1">{item.keterangan}</div>}
                    </td>
                    <td className="p-4 text-primary font-bold">{formatRupiah(item.biaya_pendaftaran)}</td>
                    <td className="p-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border-2 border-dark ${
                        count > 0 ? 'bg-primary/20 text-dark' : 'bg-gray-100 text-dark/60'
                      }`}>
                        👥 {count} Atlet
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex gap-2 justify-end flex-wrap">
                        <button 
                          onClick={() => openKelolaPeserta(item)}
                          className="text-dark bg-primary hover:bg-primary/80 px-3 py-1.5 rounded-lg font-bold text-xs border-2 border-dark transition-all flex items-center gap-1 shadow-sm"
                          title="Kelola & Tambah Peserta Langsung"
                        >
                          👥 Kelola Peserta
                        </button>
                        <button 
                          onClick={() => openEditForm(item)}
                          className="text-dark bg-secondary hover:bg-secondary/80 px-3 py-1.5 rounded-lg font-bold text-xs border border-dark transition-colors"
                        >
                          ✏️ Edit
                        </button>
                        <button 
                          onClick={() => handleDelete(item.id, item.nama)}
                          className="text-white bg-accent hover:bg-red-700 px-3 py-1.5 rounded-lg font-bold text-xs border border-dark transition-colors"
                        >
                          🗑️ Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {eventList.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-dark/50">Belum ada data event/kompetisi.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </Card>

      {/* MODAL KELOLA PESERTA EVENT */}
      {kelolaEvent && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border-4 border-dark rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="p-6 bg-dark text-white flex justify-between items-start gap-4">
              <div>
                <span className="text-xs uppercase tracking-wider text-primary font-bold font-sans">
                  Kelola Kontingen Event
                </span>
                <h2 className="text-2xl font-bold font-sans mt-0.5">{kelolaEvent.nama}</h2>
                <div className="flex flex-wrap items-center gap-3 text-xs text-white/80 font-sans mt-1">
                  <span>📅 {new Date(kelolaEvent.tgl).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                  <span>📍 {kelolaEvent.lokasi}</span>
                  <span>💰 {formatRupiah(kelolaEvent.biaya_pendaftaran)}</span>
                </div>
              </div>
              <button 
                onClick={closeKelolaPeserta}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold flex items-center justify-center text-lg transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Modal Feedback */}
            {pesertaMsg && (
              <div className={`px-6 py-2.5 text-xs font-bold border-b-2 border-dark ${
                pesertaMsg.type === 'success' ? 'bg-primary/20 text-dark' : 'bg-accent/20 text-accent'
              }`}>
                {pesertaMsg.text}
              </div>
            )}

            {/* Modal Content */}
            <div className="p-6 flex-1 overflow-y-auto flex flex-col gap-5">
              {/* Box Tambah Peserta Cepat */}
              <div className="p-4 border-2 border-dark rounded-2xl bg-secondary/10 flex flex-col gap-2">
                <h3 className="font-bold text-dark font-sans text-sm flex items-center gap-1.5">
                  <span>➕</span> Tambahkan Atlet / Siswa ke Event Ini
                </h3>
                <p className="text-xs text-dark/70 font-sans">
                  Pilih siswa aktif untuk langsung didaftarkan tanpa menunggu orang tua mendaftar.
                </p>
                <div className="flex flex-col sm:flex-row gap-2 mt-1">
                  <select
                    value={addPesertaSelectedId}
                    onChange={e => setAddPesertaSelectedId(e.target.value)}
                    className="border-2 border-dark rounded-xl px-3 py-2 bg-white text-dark text-xs font-sans focus:outline-none focus:ring-2 focus:ring-primary flex-1"
                  >
                    <option value="">-- Pilih Siswa Aktif ({unregisteredSiswaForModal.length} tersedia) --</option>
                    {unregisteredSiswaForModal.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.nama} · Sabuk {s.sabuk_saat_ini} {s.program_kelas?.nama_program ? `(${s.program_kelas.nama_program})` : ''}
                      </option>
                    ))}
                  </select>
                  <Button
                    variant="primary"
                    onClick={handleAddSinglePeserta}
                    disabled={!addPesertaSelectedId || addingPesertaLoading}
                    className="text-xs py-2 px-4 whitespace-nowrap"
                  >
                    {addingPesertaLoading ? '⏳ Menambahkan...' : '➕ Daftarkan Atlet'}
                  </Button>
                </div>
              </div>

              {/* Tabel Peserta Terdaftar */}
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center flex-wrap gap-2">
                  <h3 className="font-bold text-dark font-sans text-sm">
                    Daftar Atlet Terdaftar ({pesertaList.filter(p => p.status_daftar === 'terdaftar').length} Orang)
                  </h3>
                  {pesertaList.length > 0 && (
                    <button
                      onClick={handleCopyWAText}
                      className="text-xs font-bold font-sans px-3 py-1.5 rounded-lg border-2 border-dark bg-white hover:bg-background text-dark transition-all flex items-center gap-1.5 shadow-sm"
                    >
                      {copyToast ? '✅ Tersalin ke Clipboard!' : '📋 Salin Format WhatsApp'}
                    </button>
                  )}
                </div>

                <div className="border-2 border-dark rounded-2xl overflow-hidden">
                  {loadingPeserta ? (
                    <p className="p-6 text-center text-xs text-dark/50 font-sans">Memuat daftar peserta...</p>
                  ) : pesertaList.length === 0 ? (
                    <p className="p-6 text-center text-xs text-dark/50 font-sans">
                      Belum ada atlet yang terdaftar di event ini. Gunakan form di atas untuk mendaftarkan siswa.
                    </p>
                  ) : (
                    <table className="w-full text-left font-sans text-xs">
                      <thead className="bg-dark/5 border-b border-dark/20 text-dark font-bold">
                        <tr>
                          <th className="p-3 w-10 text-center">No</th>
                          <th className="p-3">Nama Atlet</th>
                          <th className="p-3">Sabuk & Kelas</th>
                          <th className="p-3">No HP Ortu</th>
                          <th className="p-3">Pencapaian / Medali</th>
                          <th className="p-3 text-center">Status</th>
                          <th className="p-3 text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pesertaList.map((p, idx) => (
                          <tr key={p.id} className="border-b border-dark/10 hover:bg-background/80 transition-colors">
                            <td className="p-3 text-center font-bold text-dark/50">{idx + 1}</td>
                            <td className="p-3 font-bold text-dark">{p.siswa?.nama || 'Siswa'}</td>
                            <td className="p-3">
                              <span className="font-semibold text-dark">Sabuk {p.siswa?.sabuk_saat_ini || 'Putih'}</span>
                              {p.siswa?.program_kelas?.nama_program && (
                                <span className="text-dark/50 block text-[10px]">{p.siswa.program_kelas.nama_program}</span>
                              )}
                            </td>
                            <td className="p-3 text-dark/70 font-mono">{p.siswa?.no_hp_ortu || '-'}</td>
                            <td className="p-3">
                              {p.hasil ? (
                                <div className="flex flex-col gap-0.5">
                                  <span className="inline-block px-2 py-0.5 rounded font-bold text-[10px] bg-secondary border border-dark text-dark w-max">
                                    🏅 {p.hasil}
                                  </span>
                                  {p.catatan && (
                                    <span className="text-[10px] text-dark/60 italic truncate max-w-[150px]" title={p.catatan}>
                                      {p.catatan}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-dark/40 italic text-[11px]">-</span>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              <Badge color={p.status_daftar === 'terdaftar' ? 'primary' : 'accent'}>
                                {p.status_daftar}
                              </Badge>
                            </td>
                            <td className="p-3 text-right">
                              <div className="flex gap-1.5 justify-end items-center">
                                <button
                                  type="button"
                                  onClick={() => openHasilModal(p)}
                                  className="text-dark bg-secondary/60 hover:bg-secondary font-bold px-2 py-1 rounded border border-dark transition-colors text-[10px] flex items-center gap-1"
                                  title="Input / Ubah Hasil Medali"
                                >
                                  🏅 {p.hasil ? 'Ubah' : 'Input Hasil'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeletePeserta(p.id, p.siswa?.nama || 'Siswa')}
                                  className="text-accent hover:text-red-700 font-bold px-2 py-1 rounded hover:bg-accent/10 transition-colors text-[10px]"
                                  title="Hapus dari event"
                                >
                                  🗑️ Hapus
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t-2 border-dark bg-background flex justify-end">
              <Button variant="secondary" onClick={closeKelolaPeserta}>
                Tutup
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL INPUT HASIL PRESTASI */}
      {evalPeserta && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border-4 border-dark rounded-3xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 flex flex-col gap-4">
            <div className="flex justify-between items-center border-b-2 border-dark/10 pb-3">
              <div>
                <span className="text-xs uppercase font-bold text-primary font-sans">Prestasi Atlet</span>
                <h3 className="text-lg font-bold font-sans text-dark">{evalPeserta.siswa?.nama || 'Atlet'}</h3>
              </div>
              <button 
                onClick={() => setEvalPeserta(null)}
                className="w-7 h-7 rounded-full bg-dark/10 hover:bg-dark/20 text-dark font-bold flex items-center justify-center text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveHasil} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-dark font-sans">Pencapaian / Medali</label>
                <div className="flex flex-wrap gap-1.5 mb-1">
                  {['Juara 1 (Emas)', 'Juara 2 (Perak)', 'Juara 3 (Perunggu)', 'Peserta'].map(pPreset => (
                    <button
                      key={pPreset}
                      type="button"
                      onClick={() => setFormHasil(pPreset)}
                      className="text-[10px] font-bold px-2 py-1 rounded-lg border border-dark bg-background hover:bg-secondary/40 text-dark transition-colors"
                    >
                      {pPreset}
                    </button>
                  ))}
                </div>
                <Input
                  value={formHasil}
                  onChange={e => setFormHasil(e.target.value)}
                  placeholder="Contoh: Juara 1 Emas Poomsae Cadet Putra"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-dark font-sans">Catatan / Evaluasi (Opsional)</label>
                <textarea
                  value={formCatatan}
                  onChange={e => setFormCatatan(e.target.value)}
                  placeholder="Contoh: Teknik tendangan sangat konsisten, tingkatkan stamina ronde 3."
                  className="border-2 border-dark rounded-xl p-3 text-xs font-sans text-dark bg-white focus:outline-none focus:ring-2 focus:ring-primary h-20 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-dark/10">
                <Button type="button" variant="secondary" onClick={() => setEvalPeserta(null)}>
                  Batal
                </Button>
                <Button type="submit" variant="primary" disabled={savingHasil}>
                  {savingHasil ? 'Menyimpan...' : '💾 Simpan Hasil'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
