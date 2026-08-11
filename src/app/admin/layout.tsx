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

  useEffect(() => {
    setAuthorized(true)
    setLoading(false)
  }, [])

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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="w-12 h-12 border-[4px] border-dark/20 border-t-primary animate-spin" />
          <span className="font-pixel text-sm text-dark/60 animate-pulse-soft">Loading...</span>
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
    { label: '🛒 Toko Merchant', path: '/admin/merchant' },
    { label: '📦 Pesanan Merchant', path: '/admin/merchant/pesanan' },
    { label: '🌟 Rekap Prestasi', path: '/admin/prestasi' },
    { label: '📄 Laporan & Rekap', path: '/admin/laporan' },
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
      <header className="md:hidden flex items-center justify-between bg-white border-b-[3px] border-dark px-6 py-3 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-white border-[3px] border-dark shadow-[2px_2px_0px_#1E2A38] flex items-center justify-center overflow-hidden shrink-0">
            <img src="/logo-siger.png" alt="Logo" className="w-full h-full object-cover" />
          </div>
          <h2 className="text-base font-pixel text-dark leading-tight">Admin Panel</h2>
        </div>
      </header>

      {/* DESKTOP SIDEBAR */}
      <aside className="hidden md:flex w-64 bg-white border-r-[4px] border-dark p-5 flex-col">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b-[3px] border-dark">
          <div className="w-11 h-11 bg-white border-[3px] border-dark shadow-[3px_3px_0px_#1E2A38] flex items-center justify-center overflow-hidden shrink-0">
            <img src="/logo-siger.png" alt="Logo" className="w-full h-full object-cover" />
          </div>
          <h2 className="text-base font-pixel text-dark leading-tight">Admin Panel</h2>
        </div>
        <nav className="flex flex-col gap-1.5 flex-1 overflow-y-auto">
          {menu.map((item) => {
            const isActive = pathname === item.path || (item.path !== '/admin/dashboard' && pathname.startsWith(item.path))
            return (
              <Link key={item.path} href={item.path} prefetch={true}>
                <div className={`px-3 py-2 border-[2px] font-pixel transition-all duration-75 cursor-pointer text-xs ${
                  isActive
                  ? 'bg-primary border-dark shadow-[3px_3px_0px_#1E2A38] translate-x-[-2px] translate-y-[-2px]'
                  : 'bg-white border-transparent hover:border-dark hover:bg-background'
                }`}>
                  {item.label}
                </div>
              </Link>
            )
          })}
        </nav>
        <Button variant="accent" onClick={handleLogout} className="mt-6 text-sm">⏻ Logout</Button>
      </aside>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t-[3px] border-dark z-40 flex justify-around items-center py-2 px-2">
        {mobileMainItems.map((item) => {
          const isActive = pathname === item.path || (item.path !== '/admin/dashboard' && pathname.startsWith(item.path))
          // Get emoji/icon from label
          const labelParts = item.label.split(' ')
          const icon = labelParts[0]
          const text = labelParts.slice(1).join(' ')
          
          return (
            <Link key={item.path} href={item.path} className="flex-1 max-w-[70px]">
              <div className={`flex flex-col items-center gap-0.5 py-1 border-[2px] transition-all duration-75 ${
                isActive
                ? 'bg-primary/30 border-dark shadow-[2px_2px_0px_#1E2A38]'
                : 'border-transparent'
              }`}>
                <span className="text-lg">{icon}</span>
                <span className="text-[8px] font-pixel text-dark truncate w-full text-center">{text}</span>
              </div>
            </Link>
          )
        })}
        {/* Lainnya Toggle Button */}
        <button 
          onClick={() => setIsDrawerOpen(true)}
          className={`flex-1 max-w-[70px] flex flex-col items-center gap-0.5 py-1 border-[2px] transition-all duration-75 ${
            isDrawerOpen ? 'bg-primary/30 border-dark shadow-[2px_2px_0px_#1E2A38]' : 'border-transparent'
          }`}
        >
          <span className="text-lg">➕</span>
          <span className="text-[8px] font-pixel text-dark">Lainnya</span>
        </button>
      </nav>

      {/* MOBILE BOTTOM SHEET DRAWER */}
      {isDrawerOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="md:hidden fixed inset-0 bg-dark/40 z-40 drawer-backdrop" 
            onClick={() => setIsDrawerOpen(false)} 
          />
          {/* Sheet Panel */}
          <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t-[4px] border-dark z-50 p-5 max-h-[75vh] overflow-y-auto flex flex-col gap-3 drawer-sheet">
            <div className="flex justify-between items-center pb-2 border-b-[2px] border-dark">
              <h3 className="font-pixel text-base text-dark">Menu Lainnya</h3>
              <button 
                onClick={() => setIsDrawerOpen(false)}
                className="w-7 h-7 border-[2px] border-dark flex items-center justify-center font-pixel text-sm text-dark hover:bg-background transition-colors duration-75"
              >
              ✕
              </button>
            </div>
            <nav className="grid grid-cols-2 gap-2 my-1 stagger-children">
              {mobileOtherItems.map((item) => {
                const isActive = pathname === item.path || pathname.startsWith(item.path)
                return (
                  <Link key={item.path} href={item.path} onClick={() => setIsDrawerOpen(false)}>
                    <div className={`px-3 py-2 border-[2px] font-pixel transition-all duration-75 cursor-pointer text-[11px] animate-fade-in-up ${
                      isActive
                      ? 'bg-primary border-dark shadow-[3px_3px_0px_#1E2A38]'
                      : 'bg-white border-dark/20 hover:border-dark hover:bg-background'
                    }`}>
                      {item.label}
                    </div>
                  </Link>
                )
              })}
            </nav>
            <Button variant="accent" onClick={() => { setIsDrawerOpen(false); handleLogout(); }} className="w-full mt-2 text-sm">
              ⏻ Logout
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

      {/* pageEnter keyframes are now in globals.css */}
    </div>
  )
}
