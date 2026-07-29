'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { PengaturanClub } from '@/lib/types'

const supabase = createClient()

const BANK_OPTIONS = ['BCA', 'BRI', 'BNI', 'Mandiri', 'BSI', 'CIMB Niaga', 'Permata', 'Danamon', 'OVO', 'GoPay', 'Dana', 'Lainnya']

type FormState = Omit<PengaturanClub, 'id' | 'updated_at'>

const EMPTY_FORM: FormState = {
  persentase_pool_honor: 40,
  nama_club: '',
  alamat_dojo: '',
  kontak_wa: '',
  kontak_email: '',
  logo_url: null,
  rekening_bank: 'BCA',
  rekening_nomor: '',
  rekening_atas_nama: '',
  merchant_bank: '',
  merchant_nomor: '',
  merchant_atas_nama: '',
  iuran_default: 0,
}

export default function AdminPengaturanPage() {
  const [pengaturan, setPengaturan] = useState<PengaturanClub | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchPengaturan = useCallback(async () => {
    const { data } = await supabase.from('pengaturan_club').select('*').limit(1).single()
    if (data) {
      setPengaturan(data as PengaturanClub)
      setForm({
        persentase_pool_honor: data.persentase_pool_honor ?? 40,
        nama_club: data.nama_club ?? '',
        alamat_dojo: data.alamat_dojo ?? '',
        kontak_wa: data.kontak_wa ?? '',
        kontak_email: data.kontak_email ?? '',
        logo_url: data.logo_url ?? null,
        rekening_bank: data.rekening_bank ?? 'BCA',
        rekening_nomor: data.rekening_nomor ?? '',
        rekening_atas_nama: data.rekening_atas_nama ?? '',
        merchant_bank: data.merchant_bank ?? '',
        merchant_nomor: data.merchant_nomor ?? '',
        merchant_atas_nama: data.merchant_atas_nama ?? '',
        iuran_default: data.iuran_default ?? 0,
      })
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchPengaturan() }, [fetchPengaturan])

  const handleSave = async () => {
    if (!pengaturan) return
    const pool = Number(form.persentase_pool_honor)
    if (isNaN(pool) || pool < 0 || pool > 100) {
      setError('Persentase pool honor harus antara 0 dan 100.')
      return
    }
    setSaving(true)
    setError(null)
    setSuccess(false)

    const payload = {
      ...form,
      persentase_pool_honor: pool,
      iuran_default: Number(form.iuran_default) || 0,
      nama_club: form.nama_club || null,
      alamat_dojo: form.alamat_dojo || null,
      kontak_wa: form.kontak_wa || null,
      kontak_email: form.kontak_email || null,
      rekening_bank: form.rekening_bank || null,
      rekening_nomor: form.rekening_nomor || null,
      rekening_atas_nama: form.rekening_atas_nama || null,
      merchant_bank: form.merchant_bank || null,
      merchant_nomor: form.merchant_nomor || null,
      merchant_atas_nama: form.merchant_atas_nama || null,
      updated_at: new Date().toISOString(),
    }

    const { error: updateErr } = await supabase
      .from('pengaturan_club')
      .update(payload)
      .eq('id', pengaturan.id)

    if (updateErr) {
      setError('Gagal menyimpan: ' + updateErr.message)
    } else {
      setSuccess(true)
      await fetchPengaturan()
    }
    setSaving(false)
  }

  const f = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }))
    setSuccess(false)
  }

  if (loading) return (
    <div className="max-w-3xl mx-auto">
      <Card className="text-center py-16 text-dark/50 font-sans">Memuat pengaturan...</Card>
    </div>
  )

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-8 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-sans text-dark">⚙️ Pengaturan Club</h1>
          <p className="text-dark/60 font-sans mt-1">Konfigurasi lengkap sistem Siger Taekwondo Club</p>
        </div>
        <Button variant="primary" onClick={handleSave} disabled={saving}>
          {saving ? '⏳ Menyimpan...' : '💾 Simpan Semua'}
        </Button>
      </div>

      {error && <div className="bg-red-100 border-2 border-red-400 rounded-xl p-4 text-red-700 font-bold text-sm">⚠️ {error}</div>}
      {success && <div className="bg-green-100 border-2 border-green-400 rounded-xl p-4 text-green-700 font-bold text-sm">✅ Pengaturan berhasil disimpan!</div>}

      {/* === IDENTITAS CLUB === */}
      <Card className="flex flex-col gap-5 border-2 border-dark">
        <div className="border-b-2 border-dark/10 pb-3">
          <h2 className="text-lg font-bold font-sans text-dark">🏫 Identitas Club</h2>
          <p className="text-xs text-dark/50 mt-0.5">Informasi dasar club yang tampil di kartu siswa dan laporan</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Input label="Nama Club" value={form.nama_club ?? ''} onChange={f('nama_club')} placeholder="Siger Taekwondo Club" />
          </div>
          <div className="sm:col-span-2">
            <label className="block font-bold text-dark text-sm mb-1">Alamat Dojo</label>
            <textarea
              className="w-full border-2 border-dark rounded-xl px-4 py-2.5 font-sans text-dark bg-white focus:outline-none focus:shadow-brutal transition-shadow resize-none"
              rows={2}
              value={form.alamat_dojo ?? ''}
              onChange={f('alamat_dojo')}
              placeholder="Jl. Contoh No. 1, Kelurahan, Kota..."
            />
          </div>
          <Input label="Kontak WhatsApp" value={form.kontak_wa ?? ''} onChange={f('kontak_wa')} placeholder="08123456789" />
          <Input label="Email Club" type="email" value={form.kontak_email ?? ''} onChange={f('kontak_email')} placeholder="info@sigertaekwondo.id" />
        </div>
      </Card>

      {/* === REKENING PEMBAYARAN IURAN === */}
      <Card className="flex flex-col gap-5 border-2 border-dark">
        <div className="border-b-2 border-dark/10 pb-3">
          <h2 className="text-lg font-bold font-sans text-dark">🏦 Rekening Pembayaran Iuran</h2>
          <p className="text-xs text-dark/50 mt-0.5">Rekening tujuan transfer untuk pembayaran iuran bulanan siswa</p>
        </div>

        {/* Preview Rekening */}
        {(form.rekening_nomor || form.rekening_atas_nama) && (
          <div className="bg-dark text-white rounded-2xl border-2 border-dark p-5 flex flex-col gap-1 shadow-brutal">
            <div className="text-xs text-white/50 uppercase font-bold tracking-wider mb-1">Tujuan Transfer Iuran</div>
            <div className="text-2xl font-bold font-sans tracking-widest">{form.rekening_nomor || '—'}</div>
            <div className="text-sm font-sans text-white/80">{form.rekening_bank} · a.n. {form.rekening_atas_nama || '—'}</div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-bold text-dark text-sm mb-1">Bank</label>
            <select
              className="w-full border-2 border-dark rounded-xl px-4 py-2.5 font-sans text-dark bg-white focus:outline-none focus:shadow-brutal transition-shadow"
              value={form.rekening_bank ?? ''}
              onChange={f('rekening_bank')}
            >
              <option value="">— Pilih Bank —</option>
              {BANK_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <Input label="Nomor Rekening" value={form.rekening_nomor ?? ''} onChange={f('rekening_nomor')} placeholder="1234567890" />
          <div className="sm:col-span-2">
            <Input label="Atas Nama" value={form.rekening_atas_nama ?? ''} onChange={f('rekening_atas_nama')} placeholder="Nama pemilik rekening" />
          </div>
        </div>
      </Card>

      {/* === REKENING MERCHANT === */}
      <Card className="flex flex-col gap-5 border-2 border-dark">
        <div className="border-b-2 border-dark/10 pb-3">
          <h2 className="text-lg font-bold font-sans text-dark">🛒 Rekening Toko Merchant</h2>
          <p className="text-xs text-dark/50 mt-0.5">Rekening khusus untuk pembelian produk toko. Kosongkan jika sama dengan rekening iuran.</p>
        </div>

        {/* Preview Rekening Merchant */}
        {(form.merchant_nomor || form.merchant_atas_nama) && (
          <div className="bg-[#BFDBFE] border-2 border-dark rounded-2xl p-5 flex flex-col gap-1 shadow-brutal">
            <div className="text-xs text-dark/50 uppercase font-bold tracking-wider mb-1">Tujuan Transfer Toko</div>
            <div className="text-2xl font-bold font-sans tracking-widest text-dark">{form.merchant_nomor || '—'}</div>
            <div className="text-sm font-sans text-dark/70">{form.merchant_bank} · a.n. {form.merchant_atas_nama || '—'}</div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-bold text-dark text-sm mb-1">Bank</label>
            <select
              className="w-full border-2 border-dark rounded-xl px-4 py-2.5 font-sans text-dark bg-white focus:outline-none focus:shadow-brutal transition-shadow"
              value={form.merchant_bank ?? ''}
              onChange={f('merchant_bank')}
            >
              <option value="">— Sama dengan rekening iuran —</option>
              {BANK_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <Input label="Nomor Rekening" value={form.merchant_nomor ?? ''} onChange={f('merchant_nomor')} placeholder="Kosongkan jika sama" />
          <div className="sm:col-span-2">
            <Input label="Atas Nama" value={form.merchant_atas_nama ?? ''} onChange={f('merchant_atas_nama')} placeholder="Kosongkan jika sama" />
          </div>
        </div>
      </Card>

      {/* === IURAN === */}
      <Card className="flex flex-col gap-5 border-2 border-dark">
        <div className="border-b-2 border-dark/10 pb-3">
          <h2 className="text-lg font-bold font-sans text-dark">💰 Iuran Bulanan</h2>
          <p className="text-xs text-dark/50 mt-0.5">Nominal iuran default yang diterapkan saat generate tagihan siswa baru</p>
        </div>
        <Input
          label="Nominal Iuran Default (Rp)"
          type="number"
          value={String(form.iuran_default ?? '')}
          onChange={f('iuran_default')}
          placeholder="200000"
        />
      </Card>

      {/* === HONOR PELATIH === */}
      <Card className="flex flex-col gap-5 border-2 border-dark">
        <div className="border-b-2 border-dark/10 pb-3">
          <h2 className="text-lg font-bold font-sans text-dark">👨‍🏫 Honor Pelatih</h2>
          <p className="text-xs text-dark/50 mt-0.5">Persentase dari total iuran bulanan yang dialokasikan sebagai pool honor semua pelatih</p>
        </div>

        {/* Visual Calculator */}
        <div className="bg-background rounded-2xl border-2 border-dark p-4 flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <span className="font-bold font-sans text-dark text-sm">Simulasi (Iuran Rp 5.000.000)</span>
            <span className="text-sm text-dark/50 font-sans">{form.persentase_pool_honor ?? 0}%</span>
          </div>
          <div className="h-3 bg-dark/10 rounded-full overflow-hidden border border-dark/10">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${Math.min(Number(form.persentase_pool_honor) || 0, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-sm font-sans">
            <span className="text-dark/60">Pool Honor Pelatih</span>
            <span className="font-bold text-dark">
              {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })
                .format(5000000 * (Number(form.persentase_pool_honor) || 0) / 100)}
            </span>
          </div>
        </div>

        <Input
          label="Persentase Pool Honor (%)"
          type="number"
          min="0"
          max="100"
          step="0.5"
          value={String(form.persentase_pool_honor)}
          onChange={f('persentase_pool_honor')}
        />
      </Card>

      {/* Footer Save & Timestamp */}
      <div className="flex items-center justify-between">
        <Button variant="primary" onClick={handleSave} disabled={saving} className="px-8">
          {saving ? '⏳ Menyimpan...' : '💾 Simpan Semua Pengaturan'}
        </Button>
        {pengaturan && (
          <p className="text-xs text-dark/40 font-sans">
            Diperbarui: {new Date(pengaturan.updated_at).toLocaleDateString('id-ID', {
              day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
            })}
          </p>
        )}
      </div>
    </div>
  )
}
