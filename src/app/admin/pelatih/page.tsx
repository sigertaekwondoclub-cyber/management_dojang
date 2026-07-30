'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { Pelatih } from '@/lib/types'

const supabase = createClient()

const SABUK_OPTIONS = ['Putih', 'Kuning', 'Kuning Strip', 'Hijau', 'Hijau Strip', 'Biru', 'Biru Strip', 'Merah', 'Merah Strip 1', 'Merah Strip 2', 'Hitam']

const ROLE_OPTIONS = [
  { value: 'head_coach', label: 'Kepala Pelatih (Head Coach)' },
  { value: 'core_coach', label: 'Pelatih Inti (Core Coach)' },
  { value: 'assistant_coach', label: 'Asisten Pelatih (Assistant Coach)' }
]

export default function PelatihAdminPage() {
  const [pelatihList, setPelatihList] = useState<Pelatih[]>([])
  const [loading, setLoading] = useState(true)

  // Form State
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    nama: '',
    sabuk: 'Putih',
    no_hp: '',
    tgl_gabung: new Date().toISOString().split('T')[0],
    rate_honor_per_sesi: '50000',
    status_aktif: true,
    role: 'core_coach' as 'head_coach' | 'core_coach' | 'assistant_coach',
    is_founder: false
  })
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [formSuccess, setFormSuccess] = useState<string | null>(null)

  const fetchPelatih = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('pelatih')
      .select('*')
      .order('nama', { ascending: true })
    
    if (data) setPelatihList(data as Pelatih[])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchPelatih()
  }, [fetchPelatih])

  const openAddForm = () => {
    setEditingId(null)
    setFormData({
      nama: '',
      sabuk: 'Putih',
      no_hp: '',
      tgl_gabung: new Date().toISOString().split('T')[0],
      rate_honor_per_sesi: '50000',
      status_aktif: true,
      role: 'core_coach',
      is_founder: false
    })
    setIsFormOpen(true)
    setFormError(null)
    setFormSuccess(null)
  }

  const openEditForm = (pelatih: Pelatih) => {
    setEditingId(pelatih.id)
    setFormData({
      nama: pelatih.nama,
      sabuk: pelatih.sabuk,
      no_hp: pelatih.no_hp,
      tgl_gabung: pelatih.tgl_gabung,
      rate_honor_per_sesi: String(pelatih.rate_honor_per_sesi || 0),
      status_aktif: pelatih.status_aktif,
      role: pelatih.role || 'core_coach',
      is_founder: pelatih.is_founder || false
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
      sabuk: formData.sabuk,
      no_hp: formData.no_hp,
      tgl_gabung: formData.tgl_gabung,
      rate_honor_per_sesi: Number(formData.rate_honor_per_sesi),
      status_aktif: formData.status_aktif,
      role: formData.role,
      is_founder: formData.is_founder
    }

    let error

    if (editingId) {
      const { error: updateError } = await supabase
        .from('pelatih')
        .update(payload)
        .eq('id', editingId)
      error = updateError
    } else {
      const { error: insertError } = await supabase
        .from('pelatih')
        .insert([payload])
      error = insertError
    }

    if (error) {
      setFormError('Gagal menyimpan data: ' + error.message)
    } else {
      setFormSuccess(editingId ? 'Data pelatih berhasil diperbarui!' : 'Pelatih baru berhasil ditambahkan!')
      await fetchPelatih()
      setTimeout(() => {
        setIsFormOpen(false)
      }, 1500)
    }
    setFormLoading(false)
  }

  const handleDelete = async (id: string, nama: string) => {
    if (!window.confirm(`Apakah Anda yakin ingin menghapus pelatih ${nama}? Data terkait absensi dan honor mungkin terpengaruh.`)) return
    
    const { error } = await supabase.from('pelatih').delete().eq('id', id)
    if (error) {
      alert('Gagal menghapus pelatih: ' + error.message)
    } else {
      await fetchPelatih()
    }
  }

  const getRoleLabel = (val: string) => {
    return ROLE_OPTIONS.find(opt => opt.value === val)?.label || val
  }

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold font-sans text-dark">Data Pelatih</h1>
          <p className="text-dark/60 font-sans mt-1">Kelola data master pelatih Taekwondo</p>
        </div>
        <Button variant="primary" onClick={openAddForm}>➕ Tambah Pelatih</Button>
      </div>
      
      {isFormOpen && (
        <Card className="border-primary border-2 bg-primary/5">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold font-sans text-dark">
              {editingId ? 'Edit Data Pelatih' : 'Tambah Pelatih Baru'}
            </h2>
            <button onClick={() => setIsFormOpen(false)} className="text-dark hover:text-accent font-bold text-lg">✕</button>
          </div>
          
          {formError && <div className="mb-4 p-3 bg-accent/20 text-accent font-bold rounded-xl text-sm border border-accent">{formError}</div>}
          {formSuccess && <div className="mb-4 p-3 bg-primary/20 text-dark font-bold rounded-xl text-sm border border-primary">{formSuccess}</div>}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Nama Lengkap" value={formData.nama} onChange={e => setFormData({...formData, nama: e.target.value})} required />
              
              <div className="flex flex-col gap-2">
                <label className="font-bold text-dark font-sans text-sm">Sabuk</label>
                <select 
                  className="border-2 border-dark rounded-xl px-4 py-2.5 bg-white text-dark font-sans focus:ring-2 focus:ring-primary outline-none"
                  value={formData.sabuk}
                  onChange={e => setFormData({...formData, sabuk: e.target.value})}
                >
                  {SABUK_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="font-bold text-dark font-sans text-sm">Jabatan (Role)</label>
                <select 
                  className="border-2 border-dark rounded-xl px-4 py-2.5 bg-white text-dark font-sans focus:ring-2 focus:ring-primary outline-none"
                  value={formData.role}
                  onChange={e => setFormData({...formData, role: e.target.value as any})}
                >
                  {ROLE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </div>

              <Input label="No HP" type="tel" value={formData.no_hp} onChange={e => setFormData({...formData, no_hp: e.target.value})} required />
              <Input label="Tanggal Gabung" type="date" value={formData.tgl_gabung} onChange={e => setFormData({...formData, tgl_gabung: e.target.value})} required />
              <Input label="Rate Honor / Sesi (Rp) — Legacy" type="number" value={formData.rate_honor_per_sesi} onChange={e => setFormData({...formData, rate_honor_per_sesi: e.target.value})} required />
              
              <div className="flex flex-col gap-4 justify-center mt-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="w-5 h-5 border-2 border-dark rounded accent-primary"
                    checked={formData.is_founder}
                    onChange={e => setFormData({...formData, is_founder: e.target.checked})}
                  />
                  <span className="font-bold font-sans text-dark">Pendiri / Kepala Klub (Dapat Margin Founder)</span>
                </label>
                
                <label className="flex items-center gap-3 cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="w-5 h-5 border-2 border-dark rounded accent-primary"
                    checked={formData.status_aktif}
                    onChange={e => setFormData({...formData, status_aktif: e.target.checked})}
                  />
                  <span className="font-bold font-sans text-dark">Status Aktif (Bisa Mengajar)</span>
                </label>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-4">
              <Button type="button" variant="secondary" onClick={() => setIsFormOpen(false)}>Batal</Button>
              <Button type="submit" variant="primary" disabled={formLoading}>
                {formLoading ? 'Menyimpan...' : '💾 Simpan Data'}
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
                <th className="p-4 font-bold">Nama</th>
                <th className="p-4 font-bold">Jabatan</th>
                <th className="p-4 font-bold">Sabuk</th>
                <th className="p-4 font-bold">No HP</th>
                <th className="p-4 font-bold text-center">Founder</th>
                <th className="p-4 font-bold text-center">Status</th>
                <th className="p-4 font-bold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {pelatihList.map((item) => (
                <tr key={item.id} className="border-b border-dark/10 hover:bg-background transition-colors">
                  <td className="p-4 font-bold text-dark">{item.nama}</td>
                  <td className="p-4 font-bold text-dark/70">{getRoleLabel(item.role)}</td>
                  <td className="p-4">{item.sabuk}</td>
                  <td className="p-4">{item.no_hp}</td>
                  <td className="p-4 text-center">
                    {item.is_founder ? (
                      <span className="text-xl">⭐</span>
                    ) : (
                      <span className="text-dark/20">—</span>
                    )}
                  </td>
                  <td className="p-4 text-center">
                    {item.status_aktif ? (
                      <Badge color="primary">Aktif</Badge>
                    ) : (
                      <Badge color="accent">Nonaktif</Badge>
                    )}
                  </td>
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
              {pelatihList.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-dark/50">Belum ada data pelatih.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
