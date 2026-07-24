'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
const supabase = createClient()
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { Siswa } from '@/lib/types'

const SABUK_OPTIONS = ['Putih', 'Kuning', 'Kuning Strip', 'Hijau', 'Hijau Strip', 'Biru', 'Biru Strip', 'Merah', 'Merah Strip 1', 'Merah Strip 2', 'Hitam']

export default function SiswaAdminPage() {
  const [siswaList, setSiswaList] = useState<Siswa[]>([])
  const [programList, setProgramList] = useState<{id: string, nama_program: string}[]>([])
  const [loading, setLoading] = useState(true)

  // Form State
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    nama: '',
    tgl_lahir: '',
    sabuk_saat_ini: 'Putih',
    tgl_gabung: new Date().toISOString().split('T')[0],
    no_hp_ortu: '',
    status_aktif: true,
    program_kelas_id: '',
    fokus_prestasi: '' as 'pomsae' | 'kyurugi' | ''
  })
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [formSuccess, setFormSuccess] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    
    // Fetch Siswa
    const { data: sData } = await supabase
      .from('siswa')
      .select('*, program_kelas(nama_program)')
      .order('nama', { ascending: true })
    
    if (sData) setSiswaList(sData as Siswa[])

    // Fetch Program Kelas
    const { data: pData } = await supabase
      .from('program_kelas')
      .select('id, nama_program')
      .eq('status_aktif', true)
    
    if (pData) setProgramList(pData)

    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const openAddForm = () => {
    setEditingId(null)
    setFormData({
      nama: '',
      tgl_lahir: '',
      sabuk_saat_ini: 'Putih',
      tgl_gabung: new Date().toISOString().split('T')[0],
      no_hp_ortu: '',
      status_aktif: true,
      program_kelas_id: programList[0]?.id || '',
      fokus_prestasi: ''
    })
    setIsFormOpen(true)
    setFormError(null)
    setFormSuccess(null)
  }

  const openEditForm = (siswa: Siswa) => {
    setEditingId(siswa.id)
    setFormData({
      nama: siswa.nama,
      tgl_lahir: siswa.tgl_lahir,
      sabuk_saat_ini: siswa.sabuk_saat_ini,
      tgl_gabung: siswa.tgl_gabung,
      no_hp_ortu: siswa.no_hp_ortu,
      status_aktif: siswa.status_aktif,
      program_kelas_id: siswa.program_kelas_id || '',
      fokus_prestasi: siswa.fokus_prestasi || ''
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
      tgl_lahir: formData.tgl_lahir,
      sabuk_saat_ini: formData.sabuk_saat_ini,
      tgl_gabung: formData.tgl_gabung,
      no_hp_ortu: formData.no_hp_ortu,
      status_aktif: formData.status_aktif,
      program_kelas_id: formData.program_kelas_id || null,
      fokus_prestasi: formData.fokus_prestasi || null
    }

    let error;

    if (editingId) {
      const { error: updateError } = await supabase
        .from('siswa')
        .update(payload)
        .eq('id', editingId)
      error = updateError
    } else {
      const { error: insertError } = await supabase
        .from('siswa')
        .insert([payload])
      error = insertError
    }

    if (error) {
      setFormError('Gagal menyimpan data: ' + error.message)
    } else {
      setFormSuccess(editingId ? 'Data siswa berhasil diperbarui!' : 'Siswa baru berhasil ditambahkan!')
      await fetchData()
      setTimeout(() => {
        setIsFormOpen(false)
      }, 1500)
    }
    setFormLoading(false)
  }

  const handleDelete = async (id: string, nama: string) => {
    if (!window.confirm(`Apakah Anda yakin ingin menghapus data siswa ${nama}? Data terkait seperti iuran dan riwayat ujian juga akan ikut terhapus.`)) return
    
    const { error } = await supabase.from('siswa').delete().eq('id', id)
    if (error) {
      alert('Gagal menghapus data: ' + error.message)
    } else {
      await fetchData()
    }
  }

  const handleExportCSV = () => {
    const headers = ['Nama', 'Tanggal Lahir', 'Sabuk Saat Ini', 'Tanggal Gabung', 'No HP Ortu', 'Status Aktif', 'Program Kelas', 'Fokus Prestasi'];
    const rows = siswaList.map(s => [
      s.nama,
      s.tgl_lahir,
      s.sabuk_saat_ini,
      s.tgl_gabung,
      s.no_hp_ortu,
      s.status_aktif ? 'Aktif' : 'Nonaktif',
      s.program_kelas?.nama_program || '',
      s.fokus_prestasi || ''
    ]);
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `data_siswa_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split('\n').map(l => l.trim()).filter(l => l);
        if (lines.length <= 1) return alert('File CSV kosong atau tidak valid!');

        // parse simple csv
        const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim().toLowerCase());
        const importedSiswa: any[] = [];

        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.replace(/^"|"$/g, '').trim());
          if (cols.length < headers.length) continue;

          const sObj: any = {};
          headers.forEach((h, idx) => {
            sObj[h] = cols[idx];
          });
          importedSiswa.push(sObj);
        }

        // Simpan ke Supabase
        const payload = importedSiswa.map(s => ({
          nama: s['nama'] || '',
          tgl_lahir: s['tanggal lahir'] || new Date().toISOString().split('T')[0],
          sabuk_saat_ini: s['sabuk saat ini'] || 'Putih',
          tgl_gabung: s['tanggal gabung'] || new Date().toISOString().split('T')[0],
          no_hp_ortu: s['no hp ortu'] || '',
          status_aktif: s['status aktif']?.toLowerCase() === 'aktif',
          fokus_prestasi: s['fokus prestasi'] || null,
        }));

        const { error } = await supabase.from('siswa').insert(payload);
        if (error) throw error;

        alert(`Berhasil mengimpor ${payload.length} siswa!`);
        fetchData();
      } catch (err: any) {
        alert('Gagal mengimpor: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold font-sans text-dark">Data Siswa</h1>
          <p className="text-dark/60 font-sans mt-1">Kelola data master anggota Taekwondo</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <label className="bg-secondary border-2 border-dark rounded-xl px-4 py-2.5 font-bold font-sans text-sm cursor-pointer shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-brutal-lg transition-all text-dark">
            📥 Import CSV
            <input type="file" accept=".csv" onChange={handleImportCSV} className="hidden" />
          </label>
          <Button variant="secondary" onClick={handleExportCSV}>📤 Export CSV</Button>
          <Button variant="primary" onClick={openAddForm}>➕ Tambah Siswa Manual</Button>
        </div>
      </div>
      
      {isFormOpen && (
        <Card className="border-secondary border-2 bg-secondary/5">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold font-sans text-dark">
              {editingId ? 'Edit Data Siswa' : 'Tambah Siswa Manual'}
            </h2>
            <button onClick={() => setIsFormOpen(false)} className="text-dark hover:text-accent font-bold text-lg">✕</button>
          </div>
          
          {formError && <div className="mb-4 p-3 bg-accent/20 text-accent font-bold rounded-xl text-sm border border-accent">{formError}</div>}
          {formSuccess && <div className="mb-4 p-3 bg-primary/20 text-dark font-bold rounded-xl text-sm border border-primary">{formSuccess}</div>}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Nama Lengkap" value={formData.nama} onChange={e => setFormData({...formData, nama: e.target.value})} required />
              <Input label="Tanggal Lahir" type="date" value={formData.tgl_lahir} onChange={e => setFormData({...formData, tgl_lahir: e.target.value})} required />
              
              <div className="flex flex-col gap-2">
                <label className="font-bold text-dark font-sans text-sm">Program Kelas</label>
                <select 
                  className="border-2 border-dark rounded-xl px-4 py-2.5 bg-white text-dark font-sans focus:ring-2 focus:ring-secondary outline-none"
                  value={formData.program_kelas_id}
                  onChange={e => setFormData({...formData, program_kelas_id: e.target.value})}
                  required
                >
                  <option value="">-- Pilih Program --</option>
                  {programList.map(p => <option key={p.id} value={p.id}>{p.nama_program}</option>)}
                </select>
              </div>

              {(() => {
                const selectedProgram = programList.find(p => p.id === formData.program_kelas_id);
                if (selectedProgram && selectedProgram.nama_program.toLowerCase().includes('prestasi')) {
                  return (
                    <div className="flex flex-col gap-2">
                      <label className="font-bold text-dark font-sans text-sm">Fokus Prestasi</label>
                      <select 
                        className="border-2 border-dark rounded-xl px-4 py-2.5 bg-white text-dark font-sans focus:ring-2 focus:ring-secondary outline-none"
                        value={formData.fokus_prestasi}
                        onChange={e => setFormData({...formData, fokus_prestasi: e.target.value as any})}
                        required
                      >
                        <option value="">-- Pilih Fokus --</option>
                        <option value="pomsae">Poomsae</option>
                        <option value="kyurugi">Kyorugi</option>
                      </select>
                    </div>
                  )
                }
                return null;
              })()}

              <div className="flex flex-col gap-2">
                <label className="font-bold text-dark font-sans text-sm">Sabuk Saat Ini</label>
                <select 
                  className="border-2 border-dark rounded-xl px-4 py-2.5 bg-white text-dark font-sans focus:ring-2 focus:ring-secondary outline-none"
                  value={formData.sabuk_saat_ini}
                  onChange={e => setFormData({...formData, sabuk_saat_ini: e.target.value})}
                >
                  {SABUK_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <Input label="Tanggal Gabung" type="date" value={formData.tgl_gabung} onChange={e => setFormData({...formData, tgl_gabung: e.target.value})} required />
              <Input label="No HP Orang Tua" type="tel" value={formData.no_hp_ortu} onChange={e => setFormData({...formData, no_hp_ortu: e.target.value})} required />
              
              <div className="flex flex-col gap-2 justify-center mt-2 md:col-span-2">
                <label className="flex items-center gap-3 cursor-pointer p-4 border-2 border-dark/20 rounded-xl bg-white hover:bg-background transition-colors w-max">
                  <input 
                    type="checkbox" 
                    className="w-5 h-5 border-2 border-dark rounded accent-secondary"
                    checked={formData.status_aktif}
                    onChange={e => setFormData({...formData, status_aktif: e.target.checked})}
                  />
                  <span className="font-bold font-sans text-dark">Status Aktif (Ditagih iuran bulan berjalan)</span>
                </label>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-4">
              <Button type="button" variant="secondary" onClick={() => setIsFormOpen(false)}>Batal</Button>
              <Button type="submit" variant="primary" disabled={formLoading} className="bg-secondary hover:bg-secondary/80">
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
                <th className="p-4 font-bold">Program</th>
                <th className="p-4 font-bold">Sabuk</th>
                <th className="p-4 font-bold">No HP Ortu</th>
                <th className="p-4 font-bold">Umur</th>
                <th className="p-4 font-bold text-center">Status</th>
                <th className="p-4 font-bold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {siswaList.map((item, i) => {
                const umur = new Date().getFullYear() - new Date(item.tgl_lahir).getFullYear()
                return (
                  <tr key={item.id} className="border-b border-dark/10 hover:bg-background transition-colors">
                    <td className="p-4 font-bold text-dark">{item.nama}</td>
                    <td className="p-4 text-dark/70">
                      {item.program_kelas?.nama_program || '-'}
                      {item.fokus_prestasi && <div className="text-xs font-bold text-primary mt-1">{item.fokus_prestasi === 'pomsae' ? '🥋 Poomsae' : '🥊 Kyorugi'}</div>}
                    </td>
                    <td className="p-4">{item.sabuk_saat_ini}</td>
                    <td className="p-4">{item.no_hp_ortu}</td>
                    <td className="p-4">{umur} thn</td>
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
                )
              })}
              {siswaList.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-dark/50">Belum ada data siswa.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
