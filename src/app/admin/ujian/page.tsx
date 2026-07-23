'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
const supabase = createClient()
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { Siswa, UjianSabuk } from '@/lib/types'

const BELT_ORDER = ['Putih', 'Kuning', 'Kuning Strip', 'Hijau', 'Hijau Strip', 'Biru', 'Biru Strip', 'Merah', 'Merah Strip 1', 'Merah Strip 2', 'Hitam']

function getNextBelt(currentBelt: string) {
  const index = BELT_ORDER.indexOf(currentBelt)
  if (index === -1 || index === BELT_ORDER.length - 1) return currentBelt // Already highest or unknown
  return BELT_ORDER[index + 1]
}

export default function AdminUjianSabukPage() {
  const [ujianList, setUjianList] = useState<UjianSabuk[]>([])
  const [siswaList, setSiswaList] = useState<Siswa[]>([])
  const [loading, setLoading] = useState(true)

  // Form State
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [formTglUjian, setFormTglUjian] = useState('')
  const [formPenguji, setFormPenguji] = useState('')
  const [selectedSiswaIds, setSelectedSiswaIds] = useState<string[]>([])
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  
  // Update Nilai State
  const [evalUjianId, setEvalUjianId] = useState<string | null>(null)
  const [evalHasil, setEvalHasil] = useState<'lulus' | 'tidak_lulus' | null>(null)
  const [evalCatatan, setEvalCatatan] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    
    // Fetch Ujian
    const { data: uData } = await supabase
      .from('ujian_sabuk')
      .select('*, siswa:siswa_id(nama)')
      .order('tgl_ujian', { ascending: false })
    
    if (uData) setUjianList(uData as UjianSabuk[])

    // Fetch Siswa Aktif
    const { data: sData } = await supabase
      .from('siswa')
      .select('*')
      .eq('status_aktif', true)
      .order('nama', { ascending: true })
    
    if (sData) setSiswaList(sData as Siswa[])

    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const toggleSiswaSelection = (siswaId: string) => {
    setSelectedSiswaIds(prev => 
      prev.includes(siswaId) ? prev.filter(id => id !== siswaId) : [...prev, siswaId]
    )
  }

  const handleJadwalkan = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedSiswaIds.length === 0) {
      setFormError('Pilih minimal 1 siswa untuk dijadwalkan.')
      return
    }

    setFormLoading(true)
    setFormError(null)

    // Build payload array
    const payload = selectedSiswaIds.map(siswaId => {
      const siswa = siswaList.find(s => s.id === siswaId)
      const sabukAsal = siswa?.sabuk_saat_ini || 'Putih'
      return {
        siswa_id: siswaId,
        tgl_ujian: formTglUjian,
        sabuk_asal: sabukAsal,
        sabuk_tujuan: getNextBelt(sabukAsal),
        penguji: formPenguji,
      }
    })

    const { error } = await supabase
      .from('ujian_sabuk')
      .insert(payload)

    if (error) {
      setFormError('Gagal menjadwalkan: ' + error.message)
    } else {
      setIsFormOpen(false)
      setFormTglUjian('')
      setFormPenguji('')
      setSelectedSiswaIds([])
      await fetchData()
    }
    setFormLoading(false)
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus jadwal ujian ini?')) return
    
    const { error } = await supabase.from('ujian_sabuk').delete().eq('id', id)
    if (error) {
      alert('Gagal menghapus ujian: ' + error.message)
    } else {
      await fetchData()
    }
  }

  const openEval = (ujian: UjianSabuk) => {
    setEvalUjianId(ujian.id)
    setEvalHasil(ujian.hasil)
    setEvalCatatan(ujian.catatan || '')
  }

  const submitEval = async () => {
    if (!evalUjianId || !evalHasil) return
    setFormLoading(true)

    const { error } = await supabase
      .from('ujian_sabuk')
      .update({
        hasil: evalHasil,
        catatan: evalCatatan
      })
      .eq('id', evalUjianId)

    if (!error) {
      setEvalUjianId(null)
      await fetchData() // refresh
    }
    setFormLoading(false)
  }

  // Split ujian by status
  const pendingUjian = ujianList.filter(u => u.hasil === null)
  const completedUjian = ujianList.filter(u => u.hasil !== null)

  return (
    <div className="flex flex-col gap-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold font-sans text-dark">🏅 Manajemen Ujian Sabuk</h1>
          <p className="text-dark/60 font-sans mt-1">Jadwalkan ujian dan input hasil kelulusan</p>
        </div>
        <Button variant="primary" onClick={() => setIsFormOpen(!isFormOpen)}>
          {isFormOpen ? 'Batal' : '➕ Jadwalkan Ujian'}
        </Button>
      </div>
      
      {isFormOpen && (
        <Card className="border-primary border-2 bg-primary/5">
          <h2 className="text-xl font-bold font-sans text-dark mb-4">Buat Jadwal Ujian Baru</h2>
          {formError && <div className="mb-4 p-3 bg-accent/20 text-accent font-bold rounded-xl text-sm border border-accent">{formError}</div>}
          
          <form onSubmit={handleJadwalkan} className="flex flex-col gap-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Tanggal Ujian" type="date" value={formTglUjian} onChange={e => setFormTglUjian(e.target.value)} required />
              <Input label="Nama Penguji" placeholder="Sabeum..." value={formPenguji} onChange={e => setFormPenguji(e.target.value)} required />
            </div>

            <div>
              <label className="font-bold text-dark font-sans text-sm mb-2 block">Pilih Peserta Ujian ({selectedSiswaIds.length} dipilih)</label>
              <div className="max-h-64 overflow-y-auto border-2 border-dark/20 rounded-xl bg-white p-2 flex flex-col gap-1">
                {siswaList.map(siswa => {
                  const targetBelt = getNextBelt(siswa.sabuk_saat_ini)
                  const isMaxBelt = siswa.sabuk_saat_ini === targetBelt
                  return (
                    <label key={siswa.id} className="flex items-center gap-3 p-3 hover:bg-background rounded-lg cursor-pointer transition-colors border-b border-dark/5 last:border-0">
                      <input 
                        type="checkbox" 
                        className="w-5 h-5 accent-primary border-2 border-dark"
                        checked={selectedSiswaIds.includes(siswa.id)}
                        onChange={() => toggleSiswaSelection(siswa.id)}
                        disabled={isMaxBelt}
                      />
                      <div className="flex-1">
                        <div className="font-bold font-sans text-dark">{siswa.nama}</div>
                        <div className="text-xs text-dark/60 font-sans">
                          {isMaxBelt ? (
                            <span className="text-accent font-bold">Sudah sabuk tertinggi ({siswa.sabuk_saat_ini})</span>
                          ) : (
                            <span>Akan ujian: {siswa.sabuk_saat_ini} → <span className="font-bold text-dark">{targetBelt}</span></span>
                          )}
                        </div>
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit" variant="primary" disabled={formLoading || selectedSiswaIds.length === 0}>
                {formLoading ? 'Menyimpan...' : '💾 Simpan Jadwal'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Menunggu Evaluasi */}
      <Card>
        <h2 className="font-bold font-sans text-dark mb-4 text-lg border-b-2 border-dark pb-2">⏳ Menunggu Hasil Ujian</h2>
        
        {loading ? <p className="py-4 text-center text-dark/50 font-sans">Memuat data...</p> : 
         pendingUjian.length === 0 ? <p className="py-4 text-center text-dark/50 font-sans">Tidak ada ujian yang menunggu hasil.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left font-sans text-sm">
              <thead className="bg-dark text-white">
                <tr>
                  <th className="p-3 font-bold">Tanggal</th>
                  <th className="p-3 font-bold">Siswa</th>
                  <th className="p-3 font-bold">Ujian Sabuk</th>
                  <th className="p-3 font-bold">Penguji</th>
                  <th className="p-3 font-bold text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {pendingUjian.map(u => (
                  <tr key={u.id} className="border-b border-dark/10 hover:bg-background">
                    <td className="p-3">{new Date(u.tgl_ujian).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year:'numeric'})}</td>
                    <td className="p-3 font-bold text-dark">{u.siswa?.nama}</td>
                    <td className="p-3">
                      {u.sabuk_asal} → <span className="font-bold">{u.sabuk_tujuan}</span>
                    </td>
                    <td className="p-3 text-dark/70">{u.penguji}</td>
                    <td className="p-3 text-right">
                      <div className="flex gap-2 justify-end">
                        <Button variant="secondary" onClick={() => openEval(u)}>📝 Input Hasil</Button>
                        <button 
                          onClick={() => handleDelete(u.id)}
                          className="text-white bg-accent hover:bg-red-700 px-3 py-1.5 rounded-lg font-bold text-xs border border-dark transition-colors"
                        >
                          🗑️ Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Riwayat Ujian (Selesai) */}
      <Card>
        <h2 className="font-bold font-sans text-dark mb-4 text-lg border-b-2 border-dark pb-2">✅ Riwayat Ujian (Selesai)</h2>
        
        {loading ? <p className="py-4 text-center text-dark/50 font-sans">Memuat data...</p> : 
         completedUjian.length === 0 ? <p className="py-4 text-center text-dark/50 font-sans">Belum ada riwayat ujian.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left font-sans text-sm">
              <thead className="bg-background border-b-2 border-dark">
                <tr>
                  <th className="p-3 font-bold text-dark">Tanggal</th>
                  <th className="p-3 font-bold text-dark">Siswa</th>
                  <th className="p-3 font-bold text-dark">Ujian Sabuk</th>
                  <th className="p-3 font-bold text-dark">Hasil</th>
                  <th className="p-3 font-bold text-dark">Catatan</th>
                </tr>
              </thead>
              <tbody>
                {completedUjian.map(u => (
                  <tr key={u.id} className="border-b border-dark/10">
                    <td className="p-3">{new Date(u.tgl_ujian).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year:'numeric'})}</td>
                    <td className="p-3 font-bold text-dark">{u.siswa?.nama}</td>
                    <td className="p-3">{u.sabuk_asal} → <span className="font-bold">{u.sabuk_tujuan}</span></td>
                    <td className="p-3">
                      {u.hasil === 'lulus' ? (
                        <Badge color="primary">Lulus</Badge>
                      ) : (
                        <Badge color="accent">Tidak Lulus</Badge>
                      )}
                    </td>
                    <td className="p-3 text-dark/70 italic text-xs">{u.catatan || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modal Input Hasil */}
      {evalUjianId && (
        <div className="fixed inset-0 bg-dark/50 flex items-center justify-center p-4 z-50">
          <Card className="max-w-md w-full flex flex-col gap-4">
            <h3 className="font-bold font-sans text-xl text-dark">Input Hasil Ujian</h3>
            
            <div className="flex flex-col gap-2">
              <label className="font-bold text-dark font-sans text-sm">Hasil Keputusan</label>
              <div className="flex gap-2">
                <button 
                  onClick={() => setEvalHasil('lulus')}
                  className={`flex-1 py-3 rounded-xl border-2 font-bold font-sans transition-all ${evalHasil === 'lulus' ? 'bg-primary border-dark shadow-brutal' : 'bg-white border-dark/30 hover:border-dark'}`}
                >✅ Lulus</button>
                <button 
                  onClick={() => setEvalHasil('tidak_lulus')}
                  className={`flex-1 py-3 rounded-xl border-2 font-bold font-sans transition-all ${evalHasil === 'tidak_lulus' ? 'bg-accent border-dark shadow-brutal text-white' : 'bg-white border-dark/30 hover:border-dark'}`}
                >❌ Tidak Lulus</button>
              </div>
            </div>

            <Input 
              label="Catatan Penguji (Opsional)" 
              placeholder="Perbaiki kuda-kuda..."
              value={evalCatatan}
              onChange={e => setEvalCatatan(e.target.value)}
            />

            <div className="flex justify-end gap-3 mt-4 pt-4 border-t-2 border-dark/10">
              <Button variant="secondary" onClick={() => setEvalUjianId(null)}>Batal</Button>
              <Button variant="primary" onClick={submitEval} disabled={!evalHasil || formLoading}>
                {formLoading ? 'Menyimpan...' : 'Simpan Hasil'}
              </Button>
            </div>
            
            {evalHasil === 'lulus' && (
              <p className="text-xs font-bold text-primary font-sans text-center mt-2">
                *Sabuk siswa akan otomatis diperbarui.
              </p>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}
