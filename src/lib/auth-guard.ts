import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import type { Profile } from '@/lib/types'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder'
  return createClient(url, key)
}

export interface AuthUserContext {
  userId: string
  email: string
  profile: Profile
}

export function verifyChildBelongsToParent(
  primarySiswaId: string | null,
  targetSiswaId: string,
  siblingIds: string[] = []
): boolean {
  if (!primarySiswaId || !targetSiswaId) return false
  if (primarySiswaId === targetSiswaId) return true
  return siblingIds.includes(targetSiswaId)
}

export async function requireUser(): Promise<AuthUserContext> {
  const supabase = createServerClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    throw new Error('UNAUTHORIZED: Harap login terlebih dahulu.')
  }

  const supabaseAdmin = getSupabaseAdmin()
  const { data: profile, error: pErr } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (pErr || !profile) {
    throw new Error('PROFILE_NOT_FOUND: Profil pengguna tidak ditemukan.')
  }

  return {
    userId: user.id,
    email: user.email || '',
    profile: profile as Profile,
  }
}

export async function requireAdmin(): Promise<AuthUserContext> {
  const ctx = await requireUser()
  if (ctx.profile.role !== 'admin') {
    throw new Error('FORBIDDEN: Tindakan ini memerlukan hak akses Admin.')
  }
  return ctx
}

export async function requirePelatih(): Promise<AuthUserContext> {
  const ctx = await requireUser()
  if (ctx.profile.role !== 'pelatih' && ctx.profile.role !== 'admin') {
    throw new Error('FORBIDDEN: Tindakan ini memerlukan hak akses Pelatih.')
  }
  return ctx
}

export async function requireOrtu(): Promise<AuthUserContext> {
  const ctx = await requireUser()
  if (ctx.profile.role !== 'ortu' && ctx.profile.role !== 'admin') {
    throw new Error('FORBIDDEN: Tindakan ini memerlukan hak akses Orang Tua.')
  }
  return ctx
}
