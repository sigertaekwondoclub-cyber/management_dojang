'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
const supabase = createClient()
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import type { PendaftaranSiswa } from '@/lib/types'

type ModalState =
  | { type: 'terima'; item: PendaftaranSiswa }
  | { type: 'tolak'; id: string; nama: string }
  | null

function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 bg-dark/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md" style={{ animation: 'modalIn 0.15s ease-out both' }}>
        {children}
      </div>
      <style>{`@keyframes modalIn { from { opacity: 0; transform: scale(0.95) translateY(8px); } to { opacity: 1; transform: none; } }`}</style>
    </div>
  )
}

export default function PendaftaranAdminPage() {
  const [pendaftaran, setPendaftaran] = useState<PendaftaranSiswa[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<ModalState>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [alasanTolak, setAlasanTolak] = useState('')
  const [filterStatus, setFilterStatus] = useState<'pending' | 'diterima' | 'ditolak'>('pending')
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const notify = (type: 'success' | 'error', text: string) => {
    setNotification({ type, text })
    setTimeout(() => setNotification(null), 3000)
  }

  const fetchPendaftaran = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('pendaftaran_siswa')
      .select('*, program_kelas(nama_program)')
      .eq('status', filterStatus)
      .order('tgl_daftar', { ascending: false })
    if (data) setPendaftaran(data as PendaftaranSiswa[])
    setLoading(false)
  }, [filterStatus])

  useEffect(() => { fetchPendaftaran() }, [fetchPendaftaran])

  const handleTerima = async (item: PendaftaranSiswa) => {
    setActionLoading(true)
    try {
      const { error: insertError } = await supabase.from('siswa').insert([{
        nama: item.nama_calon_siswa,
        tgl_lahir: item.tgl_lahir,
        tempat_lahir: item.tempat_lahir || null,
        no_hp_ortu: item.no_hp_ortu,
        program_kelas_id: item.program_kelas_id,
        fokus_prestasi: item.fokus_prestasi || null,
        sabuk_saat_ini: item.sabuk_pendaftaran || 'Putih',
        berat_badan: item.berat_badan || null,
        alamat: item.alamat || null,
        tgl_gabung: new Date().toISOString().split('T')[0],
        status_aktif: true,
      }])
      if (insertError) throw insertError

      const { error: updateError } = await supabase
        .from('pendaftaran_siswa')
        .update({ status: 'diterima' })
        .eq('id', item.id)
      if (updateError) throw updateError

      notify('success', `✅ Pendaftaran ${item.nama_calon_siswa} berhasil diterima dan data siswa dibuat!`)
      setModal(null)
      fetchPendaftaran()
    } catch (err: unknown) {
      notify('error', '❌ ' + (err instanceof Error ? err.message : 'Terjadi kesalahan'))
    }
    setActionLoading(false)
  }

  const handleTolak = async (id: string) => {
    setActionLoading(true)
    try {
      const { error } = await supabase
        .from('pendaftaran_siswa')
        .update({ status: 'ditolak', catatan_admin: alasanTolak || null })
        .eq('id', id)
      if (error) throw error

      notify('success', '✅ Pendaftaran berhasil ditolak.')
      setModal(null)
      setAlasanTolak('')
      fetchPendaftaran()
    } catch (err: unknown) {
      notify('error', '❌ ' + (err instanceof Error ? err.message : 'Terjadi kesalahan'))
    }
    setActionLoading(false)
  }

  const statusColor = (s: string) => s === 'diterima' ? 'primary' : s === 'pending' ? 'secondary' : 'accent'

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
      {/* Notification Toast */}
      {notification && (
        <div className={`fixed top-4 right-4 z-[100] px-5 py-3 rounded-xl border-2 font-bold font-sans shadow-brutal text-sm transition-all ${
          notification.type === 'success' ? 'bg-primary border-dark text-dark' : 'bg-accent border-dark text-dark'
        }`}>
          {notification.text}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-sans text-dark">📋 Verifikasi Pendaftaran</h1>
          <p className="text-dark/60 font-sans mt-1">Tinjau dan proses pendaftaran siswa baru</p>
        </div>
        <div className="flex gap-2">
          {(['pending', 'diterima', 'ditolak'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-4 py-2 rounded-xl border-2 font-bold font-sans text-sm capitalize transition-all ${
                filterStatus === s ? 'bg-dark text-white border-dark' : 'bg-white border-dark/20 hover:border-dark'
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-dark/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : pendaftaran.length === 0 ? (
        <Card className="text-center py-16 text-dark/50 font-sans">
          <div className="text-5xl mb-3">📭</div>
          <p className="font-bold">Tidak ada pendaftaran dengan status <span className="capitalize">{filterStatus}</span>.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {pendaftaran.map(item => (
            <Card key={item.id} className="flex flex-col gap-4 hover:shadow-brutal-lg transition-all">
              <div className="flex justify-between items-start">
                <h3 className="text-lg font-bold font-sans text-dark leading-tight">{item.nama_calon_siswa}</h3>
                <Badge color={statusColor(item.status)}>{item.status}</Badge>
              </div>

              <div className="text-sm text-dark/70 flex flex-col gap-1.5 font-sans">
                <div className="flex justify-between">
                  <span className="text-dark/50">Tgl Lahir</span>
                  <span className="font-bold">{item.tempat_lahir ? `${item.tempat_lahir}, ` : ''}{item.tgl_lahir}</span>
                </div>
                {item.berat_badan && (
                  <div className="flex justify-between">
                    <span className="text-dark/50">Berat Badan</span>
                    <span className="font-bold">{item.berat_badan} kg</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-dark/50">Sabuk</span>
                  <span className="font-bold">{item.sabuk_pendaftaran || 'Putih'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dark/50">Orang Tua</span>
                  <span className="font-bold text-right">{item.nama_ortu}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dark/50">No HP</span>
                  <span className="font-bold">{item.no_hp_ortu}</span>
                </div>
                {item.alamat && (
                  <div className="flex justify-between gap-2">
                    <span className="text-dark/50 shrink-0">Alamat</span>
                    <span className="font-bold text-right text-xs">{item.alamat}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-dark/50">Program</span>
                  <span className="font-bold">{item.program_kelas?.nama_program || '-'}</span>
                </div>
                {item.fokus_prestasi && (
                  <div className="flex justify-between">
                    <span className="text-dark/50">Fokus</span>
                    <span className="font-bold">{item.fokus_prestasi === 'pomsae' ? '🥋 Poomsae' : '🥊 Kyorugi'}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-dark/50">Tgl Daftar</span>
                  <span className="font-bold">{new Date(item.tgl_daftar).toLocaleDateString('id-ID')}</span>
                </div>
                {item.catatan_admin && (
                  <div className="mt-1 p-2 bg-accent/10 rounded-lg text-xs text-dark/70 italic">
                    Catatan: {item.catatan_admin}
                  </div>
                )}
              </div>

              {item.status === 'pending' && (
                <div className="flex gap-2 mt-auto pt-2 border-t border-dark/10">
                  <Button
                    variant="primary"
                    className="flex-1 py-2 text-sm"
                    onClick={() => setModal({ type: 'terima', item })}
                  >
                    ✅ Terima
                  </Button>
                  <Button
                    variant="accent"
                    className="flex-1 py-2 text-sm"
                    onClick={() => { setAlasanTolak(''); setModal({ type: 'tolak', id: item.id, nama: item.nama_calon_siswa }) }}
                  >
                    ❌ Tolak
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Modal Terima */}
      {modal?.type === 'terima' && (
        <ModalOverlay onClose={() => setModal(null)}>
          <Card className="flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold font-sans text-dark">✅ Terima Pendaftaran</h2>
              <button onClick={() => setModal(null)} className="text-dark/40 hover:text-dark text-2xl">×</button>
            </div>
            <div className="p-4 bg-primary/10 border-2 border-primary rounded-xl font-sans text-sm">
              <p className="font-bold text-dark mb-1">Konfirmasi Penerimaan</p>
              <p className="text-dark/70">
                Siswa <strong>{modal.item.nama_calon_siswa}</strong> akan diterima dan data siswa baru akan otomatis dibuat di sistem.
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setModal(null)} disabled={actionLoading}>Batal</Button>
              <Button variant="primary" onClick={() => handleTerima(modal.item)} disabled={actionLoading}>
                {actionLoading ? '⏳ Memproses...' : '✅ Ya, Terima'}
              </Button>
            </div>
          </Card>
        </ModalOverlay>
      )}

      {/* Modal Tolak */}
      {modal?.type === 'tolak' && (
        <ModalOverlay onClose={() => setModal(null)}>
          <Card className="flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold font-sans text-dark">❌ Tolak Pendaftaran</h2>
              <button onClick={() => setModal(null)} className="text-dark/40 hover:text-dark text-2xl">×</button>
            </div>
            <p className="text-sm font-sans text-dark/70">
              Pendaftaran <strong>{modal.nama}</strong> akan ditolak.
            </p>
            <div className="flex flex-col gap-2">
              <label className="font-bold text-dark font-sans text-sm">Alasan Penolakan (opsional)</label>
              <textarea
                className="border-2 border-dark rounded-xl px-4 py-3 font-sans text-sm outline-none focus:ring-2 focus:ring-primary resize-none"
                rows={3}
                placeholder="Contoh: Kuota penuh, persyaratan tidak lengkap..."
                value={alasanTolak}
                onChange={e => setAlasanTolak(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setModal(null)} disabled={actionLoading}>Batal</Button>
              <Button
                variant="accent"
                className="bg-accent border-dark"
                onClick={() => handleTolak(modal.id)}
                disabled={actionLoading}
              >
                {actionLoading ? '⏳ Memproses...' : '❌ Ya, Tolak'}
              </Button>
            </div>
          </Card>
        </ModalOverlay>
      )}
    </div>
  )
}
