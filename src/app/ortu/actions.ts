'use server'

import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import type { Siswa } from '@/lib/types'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function getOrtuChildrenAction(): Promise<{
  success: boolean
  children: Siswa[]
  message?: string
}> {
  try {
    const supabase = createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, children: [], message: 'Belum login' }
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('siswa_id, role')
      .eq('id', user.id)
      .single()

    if (!profile?.siswa_id) {
      return { success: false, children: [], message: 'Akun belum terhubung ke siswa' }
    }

    // 1. Ambil data siswa utama yang terhubung di profile
    const { data: primarySiswa, error: errPrimary } = await supabaseAdmin
      .from('siswa')
      .select('*, program_kelas(nama_program)')
      .eq('id', profile.siswa_id)
      .single()

    if (errPrimary || !primarySiswa) {
      return { success: false, children: [], message: 'Data siswa utama tidak ditemukan' }
    }

    let allSiblings: Siswa[] = [primarySiswa as Siswa]

    // 2. Jika no_hp_ortu terisi, cari anak-anak lain yang nomor HP ortunya sama
    if (primarySiswa.no_hp_ortu) {
      const cleanHP = primarySiswa.no_hp_ortu.trim()
      const { data: siblingData } = await supabaseAdmin
        .from('siswa')
        .select('*, program_kelas(nama_program)')
        .eq('no_hp_ortu', cleanHP)
        .eq('status_aktif', true)
        .order('nama', { ascending: true })

      if (siblingData && siblingData.length > 0) {
        const map = new Map<string, Siswa>()
        map.set(primarySiswa.id, primarySiswa as Siswa)
        for (const s of siblingData) {
          map.set(s.id, s as Siswa)
        }
        allSiblings = Array.from(map.values())
      }
    }

    return { success: true, children: allSiblings }
  } catch (error) {
    console.error('Error fetching parent children:', error)
    return {
      success: false,
      children: [],
      message: error instanceof Error ? error.message : 'Terjadi kesalahan sistem'
    }
  }
}
