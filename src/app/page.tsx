import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 sm:p-16 relative overflow-hidden">
      {/* Scanline overlay for retro CRT feel */}
      <div className="pointer-events-none fixed inset-0 z-50 opacity-[0.03]" style={{
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.3) 2px, rgba(0,0,0,0.3) 4px)',
      }} />

      {/* Background Grid & Dot Pattern */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-[0.4]" style={{
        backgroundImage: `
          radial-gradient(rgba(30, 42, 56, 0.15) 1px, transparent 1px),
          linear-gradient(rgba(30, 42, 56, 0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(30, 42, 56, 0.04) 1px, transparent 1px)
        `,
        backgroundSize: '24px 24px, 120px 120px, 120px 120px',
      }} />

      {/* Neubrutalist / RPG Accent Color Blobs (Matching Dojo Green, Sky Blue, Belt Red CTAs) */}
      <div className="absolute top-[10%] left-[-5%] w-80 h-80 bg-primary/8 rounded-full blur-[80px] pointer-events-none z-0" />
      <div className="absolute bottom-[10%] right-[-5%] w-[450px] h-[450px] bg-secondary/8 rounded-full blur-[110px] pointer-events-none z-0" />
      <div className="absolute top-1/2 left-[10%] w-72 h-72 bg-accent/6 rounded-full blur-[90px] pointer-events-none z-0" />

      {/* Dynamic Martial Arts themed Geometric & Speed Elements */}
      {/* 1. Diagonal motion/speed lines */}
      <div className="absolute top-16 right-[12%] opacity-[0.18] pointer-events-none hidden md:block animate-float" style={{ animationDelay: '0.8s' }}>
        <svg width="140" height="140" viewBox="0 0 140 140" fill="none">
          <line x1="20" y1="120" x2="120" y2="20" stroke="#1E2A38" strokeWidth="4" strokeDasharray="8 8" />
          <line x1="40" y1="120" x2="120" y2="40" stroke="#1E2A38" strokeWidth="2" />
          <line x1="20" y1="100" x2="100" y2="20" stroke="#1E2A38" strokeWidth="2" />
        </svg>
      </div>

      {/* 2. Sporty Zigzag / Kicking Direction Chevron */}
      <div className="absolute bottom-24 left-[8%] opacity-[0.22] pointer-events-none hidden md:block animate-float">
        <svg width="110" height="110" viewBox="0 0 110 110" fill="none">
          <path d="M15,35 L55,75 L95,35" stroke="#1E2A38" strokeWidth="6" strokeLinecap="square" strokeLinejoin="miter" />
          <path d="M15,55 L55,95 L95,55" stroke="#1E2A38" strokeWidth="3" strokeLinecap="square" strokeLinejoin="miter" opacity="0.6" />
        </svg>
      </div>

      {/* 3. Halftone style sporty crossbars */}
      <div className="absolute top-1/3 left-[4%] opacity-[0.15] pointer-events-none hidden lg:block animate-float" style={{ animationDelay: '1.5s' }}>
        <svg width="90" height="90" viewBox="0 0 90 90" fill="none">
          <path d="M45,15 L45,75 M15,45 L75,45" stroke="#1E2A38" strokeWidth="4" />
          <circle cx="45" cy="45" r="9" fill="#1E2A38" />
        </svg>
      </div>

      {/* Fainted Watermark Shield Logo at Center (Secondary element) */}
      <div className="absolute inset-0 flex items-center justify-center opacity-[0.025] pointer-events-none z-0">
        <img src="/logo-siger.png" alt="Watermark Logo" className="w-[320px] md:w-[450px] object-contain grayscale" />
      </div>

      <div className="z-10 w-full max-w-4xl flex flex-col items-center gap-10">

        {/* === TITLE SCREEN HEADER === */}
        <div className="text-center flex flex-col items-center gap-5">
          <Badge color="secondary" className="text-dark animate-fade-in-down">
            v1.0 BETA
          </Badge>

          {/* Logo dalam frame pixel kotak */}
          <div className="w-28 h-28 md:w-36 md:h-36 bg-white border-[4px] border-dark shadow-[6px_6px_0px_#1E2A38] flex items-center justify-center overflow-hidden animate-bounce-in">
            <img
              src="/logo-siger.png"
              alt="Logo Siger Taekwondo Club"
              className="w-full h-full object-cover"
            />
          </div>

          <h1 className="text-4xl md:text-6xl font-pixel tracking-wide text-dark mt-2 animate-fade-in-up stagger-2 leading-tight">
            Siger Taekwondo Club
          </h1>
          <p className="text-base md:text-lg font-sans max-w-xl text-dark/70 animate-fade-in-up stagger-3 leading-relaxed">
            Kelola keanggotaan, jadwal latihan, dan perkembangan atlet dalam satu sistem.
          </p>

          {/* CTA Buttons - Game Style */}
          <div className="flex flex-col sm:flex-row gap-4 mt-6 animate-fade-in-up stagger-4">
            <Link href="/login">
              <Button variant="primary" className="text-lg px-8 w-full sm:w-auto">
                ▶ Lanjutkan Game
              </Button>
            </Link>
            <Link href="/daftar">
              <Button variant="accent" className="text-lg px-8 w-full sm:w-auto">
                ✦ Mulai Baru
              </Button>
            </Link>
          </div>
        </div>

        {/* === STAGE SELECT / FEATURE CARDS === */}
        <div className="w-full mt-4">
          <h2 className="text-center font-pixel text-xl md:text-2xl text-dark mb-6 animate-fade-in">
            — Pilih Fitur —
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 w-full stagger-children">

            {/* Stage 1: Manajemen Anggota */}
            <Card className="flex flex-col gap-3 animate-fade-in-up hover:-translate-y-1 transition-transform duration-75 group">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-primary border-[3px] border-dark shadow-[2px_2px_0px_#1E2A38] flex items-center justify-center font-pixel text-lg text-dark shrink-0">
                  1
                </div>
                <h3 className="font-pixel text-base">Manajemen Anggota</h3>
              </div>
              <p className="font-sans text-sm text-dark/70">Pantau data atlet, sabuk, dan prestasi dengan mudah.</p>
            </Card>

            {/* Stage 2: Jadwal Latihan */}
            <Card className="flex flex-col gap-3 animate-fade-in-up hover:-translate-y-1 transition-transform duration-75 group">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-secondary border-[3px] border-dark shadow-[2px_2px_0px_#1E2A38] flex items-center justify-center font-pixel text-lg text-dark shrink-0">
                  2
                </div>
                <h3 className="font-pixel text-base">Jadwal Latihan</h3>
              </div>
              <p className="font-sans text-sm text-dark/70">Atur jadwal latihan dan absensi untuk tiap dojang.</p>
            </Card>

            {/* Stage 3: Pembayaran */}
            <Card className="flex flex-col gap-3 animate-fade-in-up hover:-translate-y-1 transition-transform duration-75 group">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-accent border-[3px] border-dark shadow-[2px_2px_0px_#1E2A38] flex items-center justify-center font-pixel text-lg text-dark shrink-0">
                  3
                </div>
                <h3 className="font-pixel text-base">Pembayaran</h3>
              </div>
              <p className="font-sans text-sm text-dark/70">Sistem pencatatan iuran dan administrasi yang transparan.</p>
            </Card>

          </div>
        </div>

        {/* Footer pixel bar */}
        <div className="w-full mt-6 border-t-[3px] border-dark pt-4 text-center animate-fade-in">
          <p className="font-pixel text-xs text-dark/50">
            © 2025 Siger Taekwondo Club — All Rights Reserved
          </p>
        </div>

      </div>
    </main>
  );
}
