'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
const supabase = createClient()
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { PengaturanClub } from '@/lib/types'

export default function AdminPengaturanPage() {
  const [pengaturan, setPengaturan] = useState<PengaturanClub | null>(null)
  const [persentase, setPersentase] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchPengaturan = useCallback(async () => {
    const { data } = await supabase.from('pengaturan_club').select('*').limit(1).single()
    if (data) {
      setPengaturan(data as PengaturanClub)
      setPersentase(String(data.persentase_pool_honor))
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchPengaturan() }, [fetchPengaturan])

  const handleSave = async () => {
    if (!pengaturan) return
    const val = parseFloat(persentase)
    if (isNaN(val) || val < 0 || val > 100) {
      setError('Persentase harus antara 0 dan 100.')
      return
    }
    setSaving(true)
    setError(null)
    setSuccess(false)
    const { error: updateErr } = await supabase
      .from('pengaturan_club')
      .update({ persentase_pool_honor: val, updated_at: new Date().toISOString() })
      .eq('id', pengaturan.id)
    if (updateErr) {
      setError('Gagal menyimpan: ' + updateErr.message)
    } else {
      setSuccess(true)
      await fetchPengaturan()
    }
    setSaving(false)
  }

  return (
    <div className="max-w-xl mx-auto flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold font-sans text-dark">⚙️ Pengaturan Club</h1>
        <p className="text-dark/60 font-sans mt-1">Konfigurasi perhitungan honor pelatih</p>
      </div>

      {loading ? (
        <Card className="text-center py-12 text-dark/50 font-sans">Memuat pengaturan...</Card>
      ) : (
        <Card className="flex flex-col gap-6">
          <div>
            <h2 className="font-bold font-sans text-dark text-lg mb-1">Pool Honor Pelatih</h2>
            <p className="text-sm text-dark/60 font-sans">
              Persentase dari total iuran bulanan yang dialokasikan sebagai pool honor untuk semua pelatih.
            </p>
          </div>

          {/* Visual indicator */}
          <div className="bg-background rounded-2xl border-2 border-dark p-4 flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <span className="font-bold font-sans text-dark">Contoh Kalkulasi</span>
              <span className="text-sm text-dark/50 font-sans">Iuran Rp 5.000.000</span>
            </div>
            <div className="h-3 bg-dark/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${Math.min(parseFloat(persentase) || 0, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-sm font-sans">
              <span className="text-dark/60">Pool Honor Pelatih</span>
              <span className="font-bold text-dark">
                {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })
                  .format(5000000 * (parseFloat(persentase) || 0) / 100)}
              </span>
            </div>
          </div>

          <div className="flex items-end gap-4">
            <div className="flex-1">
              <Input
                label="Persentase Pool Honor (%)"
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={persentase}
                onChange={e => { setPersentase(e.target.value); setSuccess(false) }}
              />
            </div>
            <Button variant="primary" onClick={handleSave} disabled={saving} className="shrink-0 mb-0">
              {saving ? '⏳ Menyimpan...' : '💾 Simpan'}
            </Button>
          </div>

          {error && <p className="text-accent font-bold font-sans text-sm">⚠️ {error}</p>}
          {success && <p className="text-primary font-bold font-sans text-sm">✅ Pengaturan berhasil disimpan!</p>}

          {pengaturan && (
            <p className="text-xs text-dark/40 font-sans">
              Terakhir diperbarui: {new Date(pengaturan.updated_at).toLocaleDateString('id-ID', {
                day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
              })}
            </p>
          )}
        </Card>
      )}
    </div>
  )
}
