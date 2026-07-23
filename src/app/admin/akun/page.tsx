'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import {
  createAccount, updateAccount, deleteAccount,
  listPelatih, listSiswaAktif, listAkun, resetPassword
} from './actions'

type Role = 'pelatih' | 'ortu'

type Akun = {
  id: string
  nama: string
  email: string
  role: string
  pelatih_id: string | null
  siswa_id: string | null
  created_at: string
}

type Modal =
  | { type: 'create' }
  | { type: 'edit'; akun: Akun }
  | { type: 'delete'; akun: Akun }
  | { type: 'reset'; akun: Akun }

// ─── Shared Modal Overlay ─────────────────────────────────────────────────────
function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 bg-dark/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-lg animate-[modalIn_0.15s_ease-out_both]">
        {children}
      </div>
      <style>{`
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.95) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  )
}

// ─── Role Badge Helper ────────────────────────────────────────────────────────
function RoleBadge({ role }: { role: string }) {
  const color = role === 'admin' ? 'primary' : role === 'pelatih' ? 'secondary' : 'accent'
  return <Badge color={color}>{role.toUpperCase()}</Badge>
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AkunAdminPage() {
  const [akunList, setAkunList] = useState<Akun[]>([])
  const [pelatihOptions, setPelatihOptions] = useState<{ id: string; nama: string }[]>([])
  const [siswaOptions, setSiswaOptions] = useState<{ id: string; nama: string }[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [modal, setModal] = useState<Modal | null>(null)
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState<'all' | 'admin' | 'pelatih' | 'ortu'>('all')

  const closeModal = () => setModal(null)

  const loadData = useCallback(async () => {
    setLoadingData(true)
    const [p, s, a] = await Promise.all([listPelatih(), listSiswaAktif(), listAkun()])
    setPelatihOptions(p)
    setSiswaOptions(s)
    setAkunList(a as Akun[])
    setLoadingData(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const filtered = akunList.filter(a => {
    const matchRole = filterRole === 'all' || a.role === filterRole
    const q = search.toLowerCase()
    const matchSearch = !q || a.nama.toLowerCase().includes(q) || a.email.toLowerCase().includes(q)
    return matchRole && matchSearch
  })

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-sans text-dark">🔑 Kelola Akun</h1>
          <p className="text-dark/60 font-sans mt-1">
            Manajemen akses pengguna sistem — {akunList.length} akun terdaftar
          </p>
        </div>
        <Button variant="primary" onClick={() => setModal({ type: 'create' })}>
          + Buat Akun Baru
        </Button>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <input
            className="w-full border-2 border-dark rounded-xl px-4 py-2.5 font-sans text-sm bg-white outline-none focus:ring-2 focus:ring-primary"
            placeholder="🔍 Cari nama atau email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'admin', 'pelatih', 'ortu'] as const).map(r => (
            <button
              key={r}
              onClick={() => setFilterRole(r)}
              className={`px-4 py-2 rounded-xl border-2 font-bold font-sans text-sm transition-all ${
                filterRole === r
                  ? 'bg-dark text-white border-dark'
                  : 'bg-white border-dark/20 hover:border-dark'
              }`}
            >
              {r === 'all' ? 'Semua' : r.charAt(0).toUpperCase() + r.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-sans">
            <thead>
              <tr className="bg-dark text-white">
                <th className="px-5 py-3 text-left font-bold">Nama</th>
                <th className="px-5 py-3 text-left font-bold">Email</th>
                <th className="px-5 py-3 text-left font-bold">Role</th>
                <th className="px-5 py-3 text-left font-bold">Koneksi</th>
                <th className="px-5 py-3 text-left font-bold">Terdaftar</th>
                <th className="px-5 py-3 text-center font-bold">Reset Password</th>
                <th className="px-5 py-3 text-center font-bold">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loadingData ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-dark/50">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-4 border-dark/20 border-t-primary rounded-full animate-spin" />
                      <span>Memuat data akun...</span>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-dark/40 font-bold">
                    {search || filterRole !== 'all' ? '🔍 Tidak ada akun yang cocok' : '📭 Belum ada akun terdaftar'}
                  </td>
                </tr>
              ) : (
                filtered.map((akun, i) => (
                  <tr
                    key={akun.id}
                    className={`border-b border-dark/10 hover:bg-background transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-background/40'}`}
                  >
                    <td className="px-5 py-3 font-bold text-dark">{akun.nama}</td>
                    <td className="px-5 py-3 text-dark/70">{akun.email}</td>
                    <td className="px-5 py-3"><RoleBadge role={akun.role} /></td>
                    <td className="px-5 py-3">
                      {akun.role === 'pelatih' && (
                        <span className={`text-xs font-bold ${akun.pelatih_id ? 'text-primary' : 'text-accent'}`}>
                          {akun.pelatih_id ? '✅ Terhubung' : '❌ Belum'}
                        </span>
                      )}
                      {akun.role === 'ortu' && (
                        <span className={`text-xs font-bold ${akun.siswa_id ? 'text-primary' : 'text-accent'}`}>
                          {akun.siswa_id ? '✅ Terhubung' : '❌ Belum'}
                        </span>
                      )}
                      {akun.role === 'admin' && (
                        <span className="text-xs text-dark/40">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-dark/50 text-xs">
                      {new Date(akun.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    {/* Kolom Reset Password — terpisah dan jelas */}
                    <td className="px-5 py-3 text-center">
                      <button
                        onClick={() => setModal({ type: 'reset', akun })}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 border-dark/30 hover:border-dark hover:bg-primary font-bold font-sans text-xs transition-all"
                      >
                        🔒 Reset
                      </button>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-center gap-1.5">
                        {/* Edit — hanya untuk non-admin */}
                        {akun.role !== 'admin' && (
                          <button
                            onClick={() => setModal({ type: 'edit', akun })}
                            title="Edit Akun"
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border-2 border-dark/20 hover:border-dark hover:bg-secondary font-bold font-sans text-xs transition-all"
                          >
                            ✏️ Edit
                          </button>
                        )}
                        {/* Delete — hanya untuk non-admin */}
                        {akun.role !== 'admin' && (
                          <button
                            onClick={() => setModal({ type: 'delete', akun })}
                            title="Hapus Akun"
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border-2 border-dark/20 hover:border-accent hover:bg-accent/20 font-bold font-sans text-xs transition-all"
                          >
                            🗑️ Hapus
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Modals ─────────────────────────────────────── */}
      {modal?.type === 'create' && (
        <CreateModal
          pelatihOptions={pelatihOptions}
          siswaOptions={siswaOptions}
          onClose={closeModal}
          onSuccess={loadData}
        />
      )}

      {modal?.type === 'edit' && (
        <EditModal
          akun={modal.akun}
          pelatihOptions={pelatihOptions}
          siswaOptions={siswaOptions}
          onClose={closeModal}
          onSuccess={loadData}
        />
      )}

      {modal?.type === 'delete' && (
        <DeleteModal akun={modal.akun} onClose={closeModal} onSuccess={loadData} />
      )}

      {modal?.type === 'reset' && (
        <ResetPasswordModal akun={modal.akun} onClose={closeModal} />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── CREATE MODAL
// ═══════════════════════════════════════════════════════════════════════════════
function CreateModal({
  pelatihOptions, siswaOptions, onClose, onSuccess
}: {
  pelatihOptions: { id: string; nama: string }[]
  siswaOptions: { id: string; nama: string }[]
  onClose: () => void
  onSuccess: () => void
}) {
  const [form, setForm] = useState({ email: '', nama: '', role: 'ortu' as Role, pelatih_id: '', siswa_id: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.role === 'pelatih' && !form.pelatih_id) return setMsg({ type: 'error', text: 'Pilih data pelatih yang akan dihubungkan!' })
    if (form.role === 'ortu' && !form.siswa_id) return setMsg({ type: 'error', text: 'Pilih data anak (siswa) yang akan dihubungkan!' })
    setLoading(true)
    const res = await createAccount({ ...form, pelatih_id: form.pelatih_id || undefined, siswa_id: form.siswa_id || undefined })
    if (res.success) {
      setMsg({ type: 'success', text: res.message })
      onSuccess()
      setTimeout(onClose, 2500)
    } else {
      setMsg({ type: 'error', text: res.message })
    }
    setLoading(false)
  }

  return (
    <ModalOverlay onClose={onClose}>
      <Card className="flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold font-sans text-dark">➕ Buat Akun Baru</h2>
          <button onClick={onClose} className="text-dark/40 hover:text-dark text-2xl leading-none">×</button>
        </div>

        {msg && (
          <div className={`p-3 rounded-xl border-2 text-sm font-sans whitespace-pre-wrap ${msg.type === 'success' ? 'bg-primary/20 border-primary' : 'bg-accent/20 border-accent'}`}>
            {msg.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Role */}
          <div className="flex gap-4 p-3 bg-background rounded-xl">
            {(['ortu', 'pelatih'] as Role[]).map(r => (
              <label key={r} className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="role" value={r} checked={form.role === r}
                  onChange={() => setForm({ ...form, role: r, pelatih_id: '', siswa_id: '' })} />
                <span className="font-bold text-dark font-sans capitalize">{r === 'ortu' ? 'Ortu (Wali Murid)' : 'Pelatih'}</span>
              </label>
            ))}
          </div>

          <Input label="Email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
          <Input label="Nama Tampilan" value={form.nama} onChange={e => setForm({ ...form, nama: e.target.value })} required />
          <Input label="Password (kosongkan = SigerTKD123!)" value={form.password}
            onChange={e => setForm({ ...form, password: e.target.value })} placeholder="SigerTKD123!" />

          {form.role === 'pelatih' && (
            <div className="flex flex-col gap-1">
              <label className="font-bold text-dark font-sans text-sm">Hubungkan ke Data Pelatih</label>
              <select className="border-2 border-dark rounded-xl px-4 py-2.5 bg-white text-dark font-sans text-sm"
                value={form.pelatih_id} onChange={e => setForm({ ...form, pelatih_id: e.target.value })} required>
                <option value="">-- Pilih Pelatih --</option>
                {pelatihOptions.map(p => <option key={p.id} value={p.id}>{p.nama}</option>)}
              </select>
            </div>
          )}

          {form.role === 'ortu' && (
            <div className="flex flex-col gap-1">
              <label className="font-bold text-dark font-sans text-sm">Hubungkan ke Data Anak (Siswa)</label>
              <select className="border-2 border-dark rounded-xl px-4 py-2.5 bg-white text-dark font-sans text-sm"
                value={form.siswa_id} onChange={e => setForm({ ...form, siswa_id: e.target.value })} required>
                <option value="">-- Pilih Siswa --</option>
                {siswaOptions.map(s => <option key={s.id} value={s.id}>{s.nama}</option>)}
              </select>
            </div>
          )}

          <div className="flex justify-end gap-3 mt-2">
            <Button type="button" variant="secondary" onClick={onClose}>Batal</Button>
            <Button type="submit" variant="primary" disabled={loading}>
              {loading ? '⏳ Membuat...' : '💾 Buat Akun'}
            </Button>
          </div>
        </form>
      </Card>
    </ModalOverlay>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── EDIT MODAL
// ═══════════════════════════════════════════════════════════════════════════════
function EditModal({
  akun, pelatihOptions, siswaOptions, onClose, onSuccess
}: {
  akun: Akun
  pelatihOptions: { id: string; nama: string }[]
  siswaOptions: { id: string; nama: string }[]
  onClose: () => void
  onSuccess: () => void
}) {
  const [form, setForm] = useState({
    nama: akun.nama,
    email: akun.email,
    role: akun.role as Role,
    pelatih_id: akun.pelatih_id || '',
    siswa_id: akun.siswa_id || '',
  })
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.role === 'pelatih' && !form.pelatih_id) return setMsg({ type: 'error', text: 'Pilih data pelatih!' })
    if (form.role === 'ortu' && !form.siswa_id) return setMsg({ type: 'error', text: 'Pilih data siswa!' })

    setLoading(true)
    const emailChanged = form.email !== akun.email
    const res = await updateAccount({
      userId: akun.id,
      nama: form.nama,
      role: form.role,
      pelatih_id: form.pelatih_id || undefined,
      siswa_id: form.siswa_id || undefined,
      newEmail: emailChanged ? form.email : undefined,
    })

    if (res.success) {
      setMsg({ type: 'success', text: res.message })
      onSuccess()
      setTimeout(onClose, 1500)
    } else {
      setMsg({ type: 'error', text: res.message })
    }
    setLoading(false)
  }

  return (
    <ModalOverlay onClose={onClose}>
      <Card className="flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold font-sans text-dark">✏️ Edit Akun</h2>
          <button onClick={onClose} className="text-dark/40 hover:text-dark text-2xl leading-none">×</button>
        </div>

        {msg && (
          <div className={`p-3 rounded-xl border-2 text-sm font-sans ${msg.type === 'success' ? 'bg-primary/20 border-primary' : 'bg-accent/20 border-accent'}`}>
            {msg.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Role */}
          <div className="flex gap-4 p-3 bg-background rounded-xl">
            {(['ortu', 'pelatih'] as Role[]).map(r => (
              <label key={r} className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="role" value={r} checked={form.role === r}
                  onChange={() => setForm({ ...form, role: r, pelatih_id: '', siswa_id: '' })} />
                <span className="font-bold text-dark font-sans capitalize">{r === 'ortu' ? 'Ortu (Wali Murid)' : 'Pelatih'}</span>
              </label>
            ))}
          </div>

          <Input label="Nama Tampilan" value={form.nama} onChange={e => setForm({ ...form, nama: e.target.value })} required />
          <Input label="Email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />

          {form.role === 'pelatih' && (
            <div className="flex flex-col gap-1">
              <label className="font-bold text-dark font-sans text-sm">Hubungkan ke Data Pelatih</label>
              <select className="border-2 border-dark rounded-xl px-4 py-2.5 bg-white text-dark font-sans text-sm"
                value={form.pelatih_id} onChange={e => setForm({ ...form, pelatih_id: e.target.value })} required>
                <option value="">-- Pilih Pelatih --</option>
                {pelatihOptions.map(p => <option key={p.id} value={p.id}>{p.nama}</option>)}
              </select>
            </div>
          )}

          {form.role === 'ortu' && (
            <div className="flex flex-col gap-1">
              <label className="font-bold text-dark font-sans text-sm">Hubungkan ke Data Anak (Siswa)</label>
              <select className="border-2 border-dark rounded-xl px-4 py-2.5 bg-white text-dark font-sans text-sm"
                value={form.siswa_id} onChange={e => setForm({ ...form, siswa_id: e.target.value })} required>
                <option value="">-- Pilih Siswa --</option>
                {siswaOptions.map(s => <option key={s.id} value={s.id}>{s.nama}</option>)}
              </select>
            </div>
          )}

          <div className="flex justify-end gap-3 mt-2">
            <Button type="button" variant="secondary" onClick={onClose}>Batal</Button>
            <Button type="submit" variant="primary" disabled={loading}>
              {loading ? '⏳ Menyimpan...' : '💾 Simpan Perubahan'}
            </Button>
          </div>
        </form>
      </Card>
    </ModalOverlay>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── DELETE MODAL
// ═══════════════════════════════════════════════════════════════════════════════
function DeleteModal({ akun, onClose, onSuccess }: { akun: Akun; onClose: () => void; onSuccess: () => void }) {
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const handleDelete = async () => {
    setLoading(true)
    const res = await deleteAccount(akun.id)
    if (res.success) {
      onSuccess()
      onClose()
    } else {
      setMsg(res.message)
      setLoading(false)
    }
  }

  return (
    <ModalOverlay onClose={onClose}>
      <Card className="flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold font-sans text-dark">🗑️ Hapus Akun</h2>
          <button onClick={onClose} className="text-dark/40 hover:text-dark text-2xl leading-none">×</button>
        </div>

        <div className="p-4 bg-accent/10 border-2 border-accent rounded-xl font-sans text-sm">
          <p className="font-bold text-dark mb-1">⚠️ Tindakan ini tidak dapat dibatalkan!</p>
          <p className="text-dark/70">Akun <strong>{akun.nama}</strong> ({akun.email}) akan dihapus permanen dari sistem termasuk akses login.</p>
        </div>

        {msg && <p className="text-accent font-bold font-sans text-sm">{msg}</p>}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>Batal</Button>
          <Button
            type="button"
            variant="accent"
            onClick={handleDelete}
            disabled={loading}
            className="bg-accent border-dark text-dark"
          >
            {loading ? '⏳ Menghapus...' : '🗑️ Ya, Hapus Akun'}
          </Button>
        </div>
      </Card>
    </ModalOverlay>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── RESET PASSWORD MODAL
// ═══════════════════════════════════════════════════════════════════════════════
function ResetPasswordModal({ akun, onClose }: { akun: Akun; onClose: () => void }) {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 6) return setMsg({ type: 'error', text: 'Password minimal 6 karakter.' })
    setLoading(true)
    const res = await resetPassword(akun.id, password)
    if (res.success) {
      setMsg({ type: 'success', text: res.message })
      setPassword('')
      setTimeout(onClose, 1500)
    } else {
      setMsg({ type: 'error', text: res.message })
    }
    setLoading(false)
  }

  return (
    <ModalOverlay onClose={onClose}>
      <Card className="flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold font-sans text-dark">🔒 Reset Password</h2>
          <button onClick={onClose} className="text-dark/40 hover:text-dark text-2xl leading-none">×</button>
        </div>

        <p className="text-sm font-sans text-dark/70">
          Atur ulang password untuk akun <strong>{akun.nama}</strong> ({akun.email}).
        </p>

        {msg && (
          <div className={`p-3 rounded-xl border-2 text-sm font-sans ${msg.type === 'success' ? 'bg-primary/20 border-primary' : 'bg-accent/20 border-accent'}`}>
            {msg.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Password Baru"
            type="text"
            placeholder="Minimal 6 karakter"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
          <div className="flex justify-end gap-3 mt-2">
            <Button type="button" variant="secondary" onClick={onClose}>Batal</Button>
            <Button type="submit" variant="primary" disabled={loading}>
              {loading ? 'Menyimpan...' : '💾 Simpan Password'}
            </Button>
          </div>
        </form>
      </Card>
    </ModalOverlay>
  )
}
