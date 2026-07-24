'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { NavigationProgress } from '@/components/ui/NavigationProgress'

// Instance di luar komponen agar stabil
const supabase = createClient()

export default function OrtuLayout({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [nama, setNama] = useState('')
  const router = useRouter()
  const pathname = usePathname()

  const checkAuth = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, nama')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'ortu') {
      router.push('/')
      return
    }

    setNama(profile.nama || '')
    setAuthorized(true)
    setLoading(false)
  }, [router])

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading || !authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background font-sans">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-dark border-t-accent rounded-full animate-spin" />
          <span className="font-bold text-dark/60">Memuat Portal Orang Tua...</span>
        </div>
      </div>
    )
  }

  const menu = [
    { label: '🏠 Dashboard', path: '/ortu/dashboard' },
    { label: '📅 Absensi', path: '/ortu/absensi' },
    { label: '💰 Iuran Bulanan', path: '/ortu/iuran' },
    { label: '🏅 Riwayat Ujian', path: '/ortu/ujian' },
    { label: '🥋 Event Kompetisi', path: '/ortu/event' },
    { label: '🪪 Kartu Anggota', path: '/ortu/kartu' },
  ]

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      <NavigationProgress />

      <aside className="w-full md:w-64 bg-white border-r-2 md:border-r-4 border-b-2 md:border-b-0 border-dark p-6 flex flex-col">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-full bg-white border-2 border-dark shadow-brutal flex items-center justify-center p-1 overflow-hidden shrink-0">
            <img src="/logo-siger.png" alt="Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <h2 className="text-lg font-bold font-sans text-dark leading-tight">Portal Ortu</h2>
            <p className="text-xs text-dark/60 font-sans mt-0.5 truncate max-w-[130px]">{nama}</p>
          </div>
        </div>
        <nav className="flex flex-col gap-2 flex-1">
          {menu.map((item) => {
            const isActive = pathname === item.path || pathname.startsWith(item.path + '/')
            return (
              <Link key={item.path} href={item.path} prefetch={true}>
                <div className={`px-4 py-2.5 rounded-xl border-2 font-bold font-sans transition-all duration-150 cursor-pointer text-sm ${
                  isActive
                  ? 'bg-accent border-dark shadow-brutal translate-x-[-2px] translate-y-[-2px]'
                  : 'bg-white border-transparent hover:border-dark hover:bg-background'
                }`}>
                  {item.label}
                </div>
              </Link>
            )
          })}
        </nav>
        <Button variant="secondary" onClick={handleLogout} className="mt-8">Logout</Button>
      </aside>

      <main className="flex-1 p-6 md:p-10 max-h-screen overflow-y-auto">
        <div key={pathname} style={{ animation: 'pageEnter 0.18s ease-out both' }}>
          {children}
        </div>
      </main>

      <style>{`
        @keyframes pageEnter {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
