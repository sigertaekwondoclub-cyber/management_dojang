'use server'

import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface CreateAccountData {
  email: string
  nama: string
  role: 'pelatih' | 'ortu'
  password?: string
  pelatih_id?: string
  siswa_id?: string
}

interface UpdateAccountData {
  userId: string
  nama: string
  role: 'pelatih' | 'ortu'
  pelatih_id?: string
  siswa_id?: string
  newEmail?: string
}

interface ActionResult {
  success: boolean
  message: string
  userId?: string
}

export async function createAccount(data: CreateAccountData): Promise<ActionResult> {
  try {
    const password = data.password || 'SigerTKD123!'

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: password,
      email_confirm: true,
      user_metadata: { nama: data.nama },
    })

    if (authError) throw authError
    if (!authData.user) return { success: false, message: 'Gagal membuat user auth' }

    const userId = authData.user.id

    const { error: profileError } = await supabaseAdmin.from('profiles').upsert([{
      id: userId,
      nama: data.nama,
      role: data.role,
      pelatih_id: data.role === 'pelatih' ? (data.pelatih_id || null) : null,
      siswa_id: data.role === 'ortu' ? (data.siswa_id || null) : null,
    }], { onConflict: 'id' })

    if (profileError) throw profileError

    return {
      success: true,
      userId,
      message: `✅ Akun berhasil dibuat!\nEmail: ${data.email}\nPassword: ${password}\n(Minta pelatih/ortu ganti password setelah login pertama)`
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Terjadi kesalahan'
    return { success: false, message }
  }
}

export async function updateAccount(data: UpdateAccountData): Promise<ActionResult> {
  try {
    // Update email di auth jika berubah
    if (data.newEmail) {
      const { error: emailErr } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
        email: data.newEmail,
        email_confirm: true,
        user_metadata: { nama: data.nama },
      })
      if (emailErr) throw emailErr
    } else {
      // Update hanya metadata
      await supabaseAdmin.auth.admin.updateUserById(data.userId, {
        user_metadata: { nama: data.nama },
      })
    }

    // Update profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        nama: data.nama,
        role: data.role,
        pelatih_id: data.role === 'pelatih' ? (data.pelatih_id || null) : null,
        siswa_id: data.role === 'ortu' ? (data.siswa_id || null) : null,
      })
      .eq('id', data.userId)

    if (profileError) throw profileError

    return { success: true, message: '✅ Akun berhasil diperbarui!' }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Terjadi kesalahan'
    return { success: false, message }
  }
}

export async function deleteAccount(userId: string): Promise<ActionResult> {
  try {
    // Hapus dari auth (cascade otomatis menghapus profile jika ada FK)
    const { error: deleteErr } = await supabaseAdmin.auth.admin.deleteUser(userId)
    if (deleteErr) throw deleteErr

    // Hapus profile secara eksplisit (jika tidak ada cascade)
    await supabaseAdmin.from('profiles').delete().eq('id', userId)

    return { success: true, message: '✅ Akun berhasil dihapus.' }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Terjadi kesalahan'
    return { success: false, message }
  }
}

export async function resetPassword(userId: string, newPassword: string): Promise<ActionResult> {
  try {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: newPassword
    })
    if (error) throw error
    return { success: true, message: '✅ Password berhasil di-reset!' }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Terjadi kesalahan'
    return { success: false, message }
  }
}

export async function listPelatih() {
  try {
    const { data } = await supabaseAdmin
      .from('pelatih')
      .select('id, nama')
      .eq('status_aktif', true)
      .order('nama')
    return data || []
  } catch {
    return []
  }
}

export async function listSiswaAktif() {
  try {
    const { data } = await supabaseAdmin
      .from('siswa')
      .select('id, nama')
      .eq('status_aktif', true)
      .order('nama')
    return data || []
  } catch {
    return []
  }
}

export async function listAkun() {
  try {
    const { data: profiles, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('id, nama, role, pelatih_id, siswa_id, created_at')
      .order('created_at', { ascending: false })

    if (profileErr || !profiles) return []

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers()

    const emailMap: Record<string, string> = {}
    if (!authError && authData?.users) {
      for (const u of authData.users) emailMap[u.id] = u.email || ''
    }

    return profiles.map(p => ({ ...p, email: emailMap[p.id] || '-' }))
  } catch {
    return []
  }
}
