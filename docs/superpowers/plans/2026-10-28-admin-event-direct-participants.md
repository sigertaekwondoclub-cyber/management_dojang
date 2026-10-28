# Pendaftaran Langsung Peserta Event oleh Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menambahkan fitur agar Admin/Owner dapat mendaftarkan siswa/atlet secara langsung ke event kompetisi/kejuaraan, baik langsung saat pembuatan event maupun melalui modal khusus "Kelola Peserta Event".

**Architecture:** Frontend Next.js di `src/app/admin/event/page.tsx` dengan integrasi Supabase query ke tabel `siswa`, `event_kompetisi`, dan `event_peserta`.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Tailwind CSS, Supabase Client.

---

### Task 1: Fetch Siswa Aktif & Jumlah Peserta di Tabel Event

**Files:**
- Modify: `src/app/admin/event/page.tsx`

**Interfaces:**
- Consumes: `supabase.from('siswa')`, `supabase.from('event_peserta')`.
- Produces: `siswaList` state and `pesertaCountMap` state for event cards/table.

- [ ] **Step 1: Update query `fetchEvents` dan muat master siswa aktif**

Perbarui state dan pemanggilan data di `src/app/admin/event/page.tsx`:
1. Tambahkan state `siswaList: SiswaOption[]` untuk daftar seluruh siswa aktif.
2. Tambahkan state `pesertaCountMap: Record<string, number>` untuk memetakan jumlah peserta per `event_id`.
3. Di fungsi fetch, ambil data event beserta count peserta aktif dan master siswa aktif.

- [ ] **Step 2: Tampilkan badge jumlah peserta di tabel event**

Di tabel event, tambahkan badge atau kolom peserta:
```tsx
<span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-primary/20 text-dark border border-dark">
  👥 {pesertaCountMap[item.id] || 0} Peserta
</span>
```

- [ ] **Step 3: Uji type check**

Run: `npx tsc --noEmit`
Expected: 0 errors.

---

### Task 2: Tambahkan Pilihan Daftarkan Siswa Langsung di Form Event

**Files:**
- Modify: `src/app/admin/event/page.tsx`

**Interfaces:**
- Consumes: `selectedSiswaIds: string[]`, `siswaSearch: string`.
- Produces: Batch insert ke `event_peserta` saat form event disimpan.

- [ ] **Step 1: Tambahkan UI checklist siswa di form event**

1. Tambahkan input pencarian siswa dan daftar checklist siswa aktif dengan filter nama.
2. Sediakan tombol bantuan: "Pilih Semua" dan "Batal Pilih".
3. Tampilkan sabuk dan kelas siswa untuk memudahkan identifikasi atlet.

- [ ] **Step 2: Update `handleSubmit` untuk menyimpan peserta yang dipilih**

Ketika event disimpan:
1. Simpan/dapatkan `event_id`.
2. Jika ada `selectedSiswaIds` yang dicentang, lakukan batch insert/upsert ke tabel `event_peserta`:
```typescript
if (selectedSiswaIds.length > 0) {
  const pesertaRows = selectedSiswaIds.map(siswa_id => ({
    event_id: targetEventId,
    siswa_id,
    status_daftar: 'terdaftar'
  }))
  await supabase.from('event_peserta').upsert(pesertaRows, { onConflict: 'event_id, siswa_id' })
}
```

- [ ] **Step 3: Uji simpan event dengan peserta**

Run: `npx tsc --noEmit`
Expected: 0 errors.

---

### Task 3: Modal "Kelola Peserta Event" & Salin Format WA

**Files:**
- Modify: `src/app/admin/event/page.tsx`

**Interfaces:**
- Consumes: `selectedEventForPeserta: EventKompetisi | null`, `currentPesertaList: any[]`.
- Produces: Full participant management (view, add, delete, export WA text).

- [ ] **Step 1: Buat state & handler modal kelola peserta**

1. Tambahkan fungsi `openKelolaPeserta(event: EventKompetisi)` yang memuat relasi `event_peserta` join `siswa(nama, sabuk_saat_ini, no_hp_ortu, program_kelas(nama_program))`.
2. Tambahkan handler `handleAddSinglePeserta(siswaId: string)` untuk menambah siswa ke event.
3. Tambahkan handler `handleDeletePeserta(pesertaId: string)` untuk membatalkan/menghapus peserta dari event.
4. Tambahkan handler `handleCopyWAText()` untuk menyalin rekap kontingen ke clipboard.

- [ ] **Step 2: Render Modal Kelola Peserta di UI**

1. Tampilkan modal pop-up dengan tombol tutup.
2. Tampilkan form quick-add peserta dengan dropdown filter siswa aktif yang belum terdaftar.
3. Tampilkan tabel peserta yang terdaftar dengan tombol hapus.
4. Tampilkan tombol "📋 Salin Daftar Atlet (WA)".

- [ ] **Step 3: Uji build dan TypeScript**

Run: `npx tsc --noEmit`
Expected: 0 errors.

---

### Task 4: Pengujian Menyeluruh (Verification)

**Files:**
- Test all changes.

- [ ] **Step 1: Jalankan `npm run build`**
Run: `npm run build`
Expected: Build sukses tanpa error.

- [ ] **Step 2: Commit semua perubahan**
Run: `git add src/app/admin/event/page.tsx && git commit -m "feat(event): allow admin to directly add and manage event participants"`
Expected: Commit bersih dan rapi.
