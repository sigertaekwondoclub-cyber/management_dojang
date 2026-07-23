'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { NavigationProgress } from '@/components/ui/NavigationProgress'

// Instance dibuat di luar komponen agar stabil dan tidak memicu re-auth
const supabase = createClient()

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)
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
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      router.push('/')
      return
    }

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
          <div className="w-10 h-10 border-4 border-dark border-t-primary rounded-full animate-spin" />
          <span className="font-bold text-dark/60">Memuat Dashboard Admin...</span>
        </div>
      </div>
    )
  }

  const menu = [
    { label: '🏠 Dashboard', path: '/admin/dashboard' },
    { label: '📋 Verifikasi Pendaftaran', path: '/admin/pendaftaran' },
    { label: '👤 Data Siswa', path: '/admin/siswa' },
    { label: '🥋 Data Pelatih', path: '/admin/pelatih' },
    { label: '📅 Absensi', path: '/admin/absensi' },
    { label: '💰 Kelola Iuran', path: '/admin/iuran' },
    { label: '🏆 Honor Pelatih', path: '/admin/honor' },
    { label: '📊 Keuangan Club', path: '/admin/keuangan' },
    { label: '🪪 Kartu Anggota', path: '/admin/kartu' },
    { label: '🏅 Ujian Sabuk', path: '/admin/ujian' },
    { label: '🥋 Event Kompetisi', path: '/admin/event' },
    { label: '🌟 Rekap Prestasi', path: '/admin/prestasi' },
    { label: '⚙️ Pengaturan', path: '/admin/pengaturan' },
    { label: '🔑 Kelola Akun', path: '/admin/akun' },
  ]

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Navigation progress bar — muncul saat berpindah halaman */}
      <NavigationProgress />

      <aside className="w-full md:w-64 bg-white border-r-2 md:border-r-4 border-b-2 md:border-b-0 border-dark p-6 flex flex-col">
        <h2 className="text-2xl font-bold font-sans text-dark mb-8">Admin Panel</h2>
        <nav className="flex flex-col gap-2 flex-1 overflow-y-auto">
          {menu.map((item) => {
            // Aktif jika pathname sama persis atau dimulai dengan path item (sub-route)
            const isActive = pathname === item.path || (item.path !== '/admin/dashboard' && pathname.startsWith(item.path))
            return (
              <Link key={item.path} href={item.path} prefetch={true}>
                <div className={`px-4 py-2.5 rounded-xl border-2 font-bold font-sans transition-all duration-150 cursor-pointer text-sm ${
                  isActive
                  ? 'bg-primary border-dark shadow-brutal translate-x-[-2px] translate-y-[-2px]'
                  : 'bg-white border-transparent hover:border-dark hover:bg-background'
                }`}>
                  {item.label}
                </div>
              </Link>
            )
          })}
        </nav>
        <Button variant="accent" onClick={handleLogout} className="mt-6">Logout</Button>
      </aside>

      <main className="flex-1 p-6 md:p-10 max-h-screen overflow-y-auto">
        {/* key={pathname} memicu animasi fade-in setiap ganti halaman */}
        <div
          key={pathname}
          style={{ animation: 'pageEnter 0.18s ease-out both' }}
        >
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
