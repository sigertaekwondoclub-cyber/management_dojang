'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
const supabase = createClient()
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { EventKompetisi } from '@/lib/types'

function formatRupiah(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
}

export default function AdminEventPage() {
  const [eventList, setEventList] = useState<EventKompetisi[]>([])
  const [loading, setLoading] = useState(true)

  // Form State
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    nama: '',
    tgl: '',
    lokasi: '',
    biaya_pendaftaran: '0',
    keterangan: ''
  })
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [formSuccess, setFormSuccess] = useState<string | null>(null)

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

  const openAddForm = () => {
    setEditingId(null)
    setFormData({ nama: '', tgl: '', lokasi: '', biaya_pendaftaran: '0', keterangan: '' })
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
    setIsFormOpen(true)
    setFormError(null)
    setFormSuccess(null)
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

    let error;

    if (editingId) {
      const { error: updateError } = await supabase
        .from('event_kompetisi')
        .update(payload)
        .eq('id', editingId)
      error = updateError
    } else {
      const { error: insertError } = await supabase
        .from('event_kompetisi')
        .insert([payload])
      error = insertError
    }

    if (error) {
      setFormError('Gagal menyimpan: ' + error.message)
    } else {
      setFormSuccess(editingId ? 'Event diperbarui!' : 'Event baru ditambahkan!')
      await fetchEvents()
      setTimeout(() => setIsFormOpen(false), 1500)
    }
    setFormLoading(false)
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

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold font-sans text-dark">🥋 Kelola Event / Kompetisi</h1>
          <p className="text-dark/60 font-sans mt-1">Daftar kejuaraan, ujian, atau acara klub</p>
        </div>
        <Button variant="primary" onClick={openAddForm}>➕ Tambah Event</Button>
      </div>
      
      {isFormOpen && (
        <Card className="border-primary border-2 bg-primary/5">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold font-sans text-dark">
              {editingId ? 'Edit Event' : 'Tambah Event Baru'}
            </h2>
            <button onClick={() => setIsFormOpen(false)} className="text-dark hover:text-accent font-bold text-lg">✕</button>
          </div>
          
          {formError && <div className="mb-4 p-3 bg-accent/20 text-accent font-bold rounded-xl text-sm border border-accent">{formError}</div>}
          {formSuccess && <div className="mb-4 p-3 bg-primary/20 text-dark font-bold rounded-xl text-sm border border-primary">{formSuccess}</div>}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Nama Event" value={formData.nama} onChange={e => setFormData({...formData, nama: e.target.value})} required />
              <Input label="Tanggal" type="date" value={formData.tgl} onChange={e => setFormData({...formData, tgl: e.target.value})} required />
              <Input label="Lokasi" value={formData.lokasi} onChange={e => setFormData({...formData, lokasi: e.target.value})} required />
              <Input label="Biaya Pendaftaran (Rp)" type="number" value={formData.biaya_pendaftaran} onChange={e => setFormData({...formData, biaya_pendaftaran: e.target.value})} required />
              <div className="md:col-span-2">
                <Input label="Keterangan (Opsional)" value={formData.keterangan} onChange={e => setFormData({...formData, keterangan: e.target.value})} />
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-4">
              <Button type="button" variant="secondary" onClick={() => setIsFormOpen(false)}>Batal</Button>
              <Button type="submit" variant="primary" disabled={formLoading}>
                {formLoading ? 'Menyimpan...' : '💾 Simpan'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card className="overflow-x-auto p-0">
        {loading ? (
          <p className="p-8 text-center text-dark/50 font-sans">Memuat data...</p>
        ) : (
          <table className="w-full text-left font-sans text-sm">
            <thead className="bg-dark text-white">
              <tr>
                <th className="p-4 font-bold">Tanggal</th>
                <th className="p-4 font-bold">Nama Event</th>
                <th className="p-4 font-bold">Lokasi</th>
                <th className="p-4 font-bold">Biaya</th>
                <th className="p-4 font-bold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {eventList.map(item => (
                <tr key={item.id} className="border-b border-dark/10 hover:bg-background transition-colors">
                  <td className="p-4 text-dark/70 whitespace-nowrap">
                    {new Date(item.tgl).toLocaleDateString('id-ID', {day: '2-digit', month: 'short', year:'numeric'})}
                  </td>
                  <td className="p-4">
                    <div className="font-bold text-dark text-base">{item.nama}</div>
                    {item.keterangan && <div className="text-xs text-dark/60 mt-1 line-clamp-2">{item.keterangan}</div>}
                  </td>
                  <td className="p-4">{item.lokasi}</td>
                  <td className="p-4 text-primary font-bold">{formatRupiah(item.biaya_pendaftaran)}</td>
                  <td className="p-4 text-right">
                    <div className="flex gap-2 justify-end">
                      <button 
                        onClick={() => openEditForm(item)}
                        className="text-dark bg-secondary hover:bg-dark hover:text-white px-3 py-1.5 rounded-lg font-bold text-xs border border-dark transition-colors"
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
              ))}
              {eventList.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-dark/50">Belum ada data event.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
