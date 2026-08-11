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
