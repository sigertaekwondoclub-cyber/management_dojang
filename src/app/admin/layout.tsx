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
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
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

  useEffect(() => {
    document.body.classList.add('hide-watermark')
    return () => {
      document.body.classList.remove('hide-watermark')
    }
  }, [])

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

  // Main items for the bottom navigation bar on mobile
  const mobileMainPaths = ['/admin/dashboard', '/admin/siswa', '/admin/iuran', '/admin/keuangan']
  const mobileMainItems = menu.filter(item => mobileMainPaths.includes(item.path))
  const mobileOtherItems = menu.filter(item => !mobileMainPaths.includes(item.path))

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row relative">
      {/* Navigation progress bar — muncul saat berpindah halaman */}
      <NavigationProgress />

      {/* MOBILE HEADER */}
      <header className="md:hidden flex items-center justify-between bg-white border-b-2 border-dark px-6 py-4 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white border-2 border-dark shadow-brutal flex items-center justify-center overflow-hidden shrink-0">
            <img src="/logo-siger.png" alt="Logo" className="w-[80%] h-[80%] object-contain" />
          </div>
          <h2 className="text-lg font-bold font-sans text-dark leading-tight">Admin Panel</h2>
        </div>
      </header>

      {/* DESKTOP SIDEBAR */}
      <aside className="hidden md:flex w-64 bg-white border-r-4 border-dark p-6 flex-col">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-full bg-white border-2 border-dark shadow-brutal flex items-center justify-center overflow-hidden shrink-0">
            <img src="/logo-siger.png" alt="Logo" className="w-[80%] h-[80%] object-contain" />
          </div>
          <h2 className="text-xl font-bold font-sans text-dark leading-tight">Admin Panel</h2>
        </div>
        <nav className="flex flex-col gap-2 flex-1 overflow-y-auto">
          {menu.map((item) => {
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

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t-2 border-dark z-40 flex justify-around items-center py-2 px-2 shadow-brutal">
        {mobileMainItems.map((item) => {
          const isActive = pathname === item.path || (item.path !== '/admin/dashboard' && pathname.startsWith(item.path))
          // Get emoji/icon from label
          const labelParts = item.label.split(' ')
          const icon = labelParts[0]
          const text = labelParts.slice(1).join(' ')
          
          return (
            <Link key={item.path} href={item.path} className="flex-1 max-w-[70px]">
              <div className={`flex flex-col items-center gap-0.5 py-1 rounded-lg border transition-all duration-150 ${
                isActive
                ? 'bg-primary/20 border-dark'
                : 'border-transparent'
              }`}>
                <span className="text-xl">{icon}</span>
                <span className="text-[9px] font-bold font-sans text-dark truncate w-full text-center">{text}</span>
              </div>
            </Link>
          )
        })}
        {/* Lainnya Toggle Button */}
        <button 
          onClick={() => setIsDrawerOpen(true)}
          className={`flex-1 max-w-[70px] flex flex-col items-center gap-0.5 py-1 rounded-lg border transition-all duration-150 ${
            isDrawerOpen ? 'bg-primary/20 border-dark' : 'border-transparent'
          }`}
        >
          <span className="text-xl">➕</span>
          <span className="text-[9px] font-bold font-sans text-dark">Lainnya</span>
        </button>
      </nav>

      {/* MOBILE BOTTOM SHEET DRAWER */}
      {isDrawerOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="md:hidden fixed inset-0 bg-dark/40 z-40" 
            onClick={() => setIsDrawerOpen(false)} 
          />
          {/* Sheet Panel */}
          <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t-4 border-dark rounded-t-3xl z-50 p-6 max-h-[75vh] overflow-y-auto flex flex-col gap-4 shadow-[0_-8px_30px_rgb(0,0,0,0.12)]">
            <div className="flex justify-between items-center pb-2 border-b border-dark/10">
              <h3 className="font-bold text-lg font-sans text-dark">Menu Lainnya</h3>
              <button 
                onClick={() => setIsDrawerOpen(false)}
                className="w-8 h-8 rounded-full border border-dark flex items-center justify-center font-bold text-dark hover:bg-background"
              >
                ✕
              </button>
            </div>
            <nav className="grid grid-cols-2 gap-2 my-2">
              {mobileOtherItems.map((item) => {
                const isActive = pathname === item.path || pathname.startsWith(item.path)
                return (
                  <Link key={item.path} href={item.path} onClick={() => setIsDrawerOpen(false)}>
                    <div className={`px-3 py-2 rounded-xl border-2 font-bold font-sans transition-all duration-150 cursor-pointer text-xs ${
                      isActive
                      ? 'bg-primary border-dark shadow-brutal'
                      : 'bg-white border-dark/20 hover:border-dark hover:bg-background'
                    }`}>
                      {item.label}
                    </div>
                  </Link>
                )
              })}
            </nav>
            <Button variant="accent" onClick={() => { setIsDrawerOpen(false); handleLogout(); }} className="w-full mt-2">
              Logout
            </Button>
          </div>
        </>
      )}

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 p-6 pb-24 md:p-10 md:pb-10 max-h-screen overflow-y-auto">
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
