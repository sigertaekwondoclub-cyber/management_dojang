"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import Link from "next/link";

export default function Home() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setActiveFaq(activeFaq === index ? null : index);
  };

  const faqData = [
    {
      q: "Berapa batasan usia untuk mendaftar?",
      a: "Kami menerima atlet mulai dari usia 5 tahun (kelas anak-anak/pra-junior) hingga dewasa. Materi latihan akan disesuaikan dengan kelompok umur masing-masing."
    },
    {
      q: "Kapan dan di mana jadwal latihan terdekat?",
      a: "Latihan rutin diadakan di beberapa cabang (Dojang) seperti PKOR Way Halim (Selasa, Kamis, Sabtu sore), GOR Pahoman (Senin, Rabu, Jumat sore), dan Aula UIN Raden Intan (Sabtu & Minggu pagi)."
    },
    {
      q: "Bagaimana sistem pembayaran iuran bulanan?",
      a: "Seluruh pencatatan keuangan, iuran bulanan (SPP), dan biaya ujian kenaikan tingkat dikelola secara transparan melalui portal wali murid (akun Ortu) di dalam aplikasi manajemen ini."
    },
    {
      q: "Apakah disediakan atau wajib memiliki perlengkapan sendiri?",
      a: "Untuk pemula, cukup mengenakan pakaian olahraga biasa di latihan pertama. Setelah resmi terdaftar, atlet disarankan memiliki Dobok (seragam Taekwondo) dan pelindung kaki/tangan yang dapat dipesan langsung di merchant dojang."
    }
  ];

  const statData = [
    { label: "Level Atlet", value: "500+ Aktif", desc: "Mencakup berbagai kelompok usia", color: "bg-primary" },
    { label: "Dojo Masters", value: "15+ Pelatih", desc: "Berlisensi Nasional", color: "bg-secondary" },
    { label: "Training Zones", value: "8 Cabang", desc: "Dojang aktif di Lampung", color: "bg-accent" },
    { label: "Trophy Points", value: "120+ Medali", desc: "Kejuaraan daerah & nasional", color: "bg-yellow-300" }
  ];

  const programData = [
    {
      id: "stage-1",
      title: "Kyorugi (Tarung)",
      desc: "Pembinaan intensif taktik pertarungan, fisik atlet, kecepatan reaksi, mental tanding, dan penguasaan aturan kompetisi untuk persiapan turnamen prestasi.",
      badge: "STAGES PRESTASI",
      badgeColor: "accent" as const,
      skills: ["Speed Kick", "Agility", "Match Sparring"]
    },
    {
      id: "stage-2",
      title: "Poomsae (Jurus)",
      desc: "Pelatihan keselarasan gerakan dasar, keindahan teknik tendangan, pukulan, tangkisan, serta fokus mental tinggi dalam mempraktikkan jurus resmi Taekwondo.",
      badge: "STAGES TEKNIS",
      badgeColor: "secondary" as const,
      skills: ["Form Precision", "Balance", "Flexibility"]
    },
    {
      id: "stage-3",
      title: "Reguler & Kids",
      desc: "Pengembangan disiplin diri, rasa percaya diri, pembentukan karakter, kemampuan bela diri praktis, serta optimalisasi motorik kasar anak sejak usia dini.",
      badge: "STAGES DASAR",
      badgeColor: "primary" as const,
      skills: ["Self Defense", "Discipline", "Motor Skills"]
    }
  ];

  const locationData = [
    {
      name: "Dojang PKOR Way Halim",
      schedule: "Selasa, Kamis & Sabtu",
      time: "16.00 - 18.00 WIB",
      place: "Hall B PKOR Way Halim, Bandar Lampung",
      badge: "Pusat"
    },
    {
      name: "Dojang GOR Pahoman",
      schedule: "Senin, Rabu & Jumat",
      time: "16.00 - 17.30 WIB",
      place: "Kompleks GOR Pahoman, Bandar Lampung",
      badge: "Cabang"
    },
    {
      name: "Dojang UIN Raden Intan",
      schedule: "Sabtu & Minggu",
      time: "08.00 - 10.00 WIB",
      place: "Aula Serbaguna UIN Sukarame, Bandar Lampung",
      badge: "Cabang"
    }
  ];

  return (
    <main className="flex min-h-screen flex-col bg-[#FDF6EC] text-dark relative overflow-x-hidden pt-20">
      {/* Scanline overlay for retro CRT feel */}
      <div className="pointer-events-none fixed inset-0 z-50 opacity-[0.03]" style={{
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.3) 2px, rgba(0,0,0,0.3) 4px)',
      }} />

      {/* Background Grid Pattern */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-[0.3]" style={{
        backgroundImage: `
          radial-gradient(rgba(30, 42, 56, 0.15) 1px, transparent 1px),
          linear-gradient(rgba(30, 42, 56, 0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(30, 42, 56, 0.04) 1px, transparent 1px)
        `,
        backgroundSize: '24px 24px, 120px 120px, 120px 120px',
      }} />

      {/* Neubrutalist Blur Blobs */}
      <div className="absolute top-[10%] left-[-5%] w-80 h-80 bg-primary/8 rounded-full blur-[80px] pointer-events-none z-0" />
      <div className="absolute bottom-[20%] right-[-5%] w-[450px] h-[450px] bg-secondary/8 rounded-full blur-[110px] pointer-events-none z-0" />

      {/* === STICKY NAVIGATION BAR === */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-[#FDF6EC] border-b-[4px] border-dark px-4 sm:px-8 py-3 flex items-center justify-between shadow-[0_4px_0px_#1E2A38]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white border-[3px] border-dark shadow-[2px_2px_0px_#1E2A38] flex items-center justify-center overflow-hidden">
            <img src="/logo-siger.png" alt="Logo" className="w-full h-full object-cover" />
          </div>
          <span className="font-pixel text-lg tracking-wider hidden sm:block">SIGER TC</span>
        </div>

        {/* Desktop Menu */}
        <nav className="hidden md:flex items-center gap-6">
          <a href="#tentang" className="font-pixel text-sm hover:text-primary transition-colors">TENTANG</a>
          <a href="#program" className="font-pixel text-sm hover:text-secondary transition-colors">PROGRAM</a>
          <a href="#lokasi" className="font-pixel text-sm hover:text-accent transition-colors">LOKASI</a>
          <a href="#pelatih" className="font-pixel text-sm hover:text-primary transition-colors">PELATIH</a>
          <a href="#faq" className="font-pixel text-sm hover:text-secondary transition-colors">FAQ</a>
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <Link href="/login">
            <Button variant="secondary" className="px-4 py-1.5 text-xs">LOGIN</Button>
          </Link>
          <Link href="/daftar">
            <Button variant="accent" className="px-4 py-1.5 text-xs">DAFTAR</Button>
          </Link>
        </div>

        {/* Mobile Hamburger Button */}
        <button 
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="md:hidden p-2 border-[3px] border-dark bg-white shadow-[2px_2px_0px_#1E2A38] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isMenuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </header>

      {/* Mobile Drawer menu */}
      {isMenuOpen && (
        <div className="fixed inset-0 top-[68px] z-30 bg-[#FDF6EC] border-b-[4px] border-dark flex flex-col p-6 gap-6 md:hidden animate-fade-in">
          <nav className="flex flex-col gap-4">
            <a onClick={() => setIsMenuOpen(false)} href="#tentang" className="font-pixel text-lg border-b-2 border-dark pb-2">▶ TENTANG</a>
            <a onClick={() => setIsMenuOpen(false)} href="#program" className="font-pixel text-lg border-b-2 border-dark pb-2">▶ PROGRAM</a>
            <a onClick={() => setIsMenuOpen(false)} href="#lokasi" className="font-pixel text-lg border-b-2 border-dark pb-2">▶ LOKASI</a>
            <a onClick={() => setIsMenuOpen(false)} href="#pelatih" className="font-pixel text-lg border-b-2 border-dark pb-2">▶ PELATIH</a>
            <a onClick={() => setIsMenuOpen(false)} href="#faq" className="font-pixel text-lg border-b-2 border-dark pb-2">▶ FAQ</a>
          </nav>
          <div className="flex flex-col gap-3 mt-4">
            <Link href="/login" onClick={() => setIsMenuOpen(false)}>
              <Button variant="secondary" className="w-full text-center py-3">LOGIN PORTAL</Button>
            </Link>
            <Link href="/daftar" onClick={() => setIsMenuOpen(false)}>
              <Button variant="accent" className="w-full text-center py-3">DAFTAR BARU</Button>
            </Link>
          </div>
        </div>
      )}

      {/* === HERO SECTION === */}
      <section id="hero" className="z-10 px-6 sm:px-16 pt-8 pb-16 flex flex-col items-center text-center gap-8 max-w-4xl mx-auto">
        <Badge color="secondary" className="text-dark animate-fade-in-down">
          v1.0 BETA · PILOT DOJO
        </Badge>

        <div className="w-24 h-24 md:w-32 md:h-32 bg-white border-[4px] border-dark shadow-[6px_6px_0px_#1E2A38] flex items-center justify-center overflow-hidden animate-bounce-in">
          <img
            src="/logo-siger.png"
            alt="Logo Siger Taekwondo Club"
            className="w-full h-full object-cover"
          />
        </div>

        <h1 className="text-3xl sm:text-5xl md:text-6xl font-pixel tracking-wide text-dark leading-tight animate-fade-in-up">
          Siger Taekwondo Club
        </h1>
        <p className="text-sm sm:text-base md:text-lg font-sans max-w-xl text-dark/80 leading-relaxed animate-fade-in-up">
          Klub bela diri taekwondo profesional di Lampung. Kelola keanggotaan, jadwal latihan, dan monitor perkembangan fisik serta teknik atlet secara transparan.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 mt-2 animate-fade-in-up">
          <Link href="/login">
            <Button variant="primary" className="text-base sm:text-lg px-8 py-3 w-full sm:w-auto">
              ▶ PORTAL MEMBER
            </Button>
          </Link>
          <Link href="/daftar">
            <Button variant="accent" className="text-base sm:text-lg px-8 py-3 w-full sm:w-auto">
              ✦ BERGABUNG SEKARANG
            </Button>
          </Link>
        </div>
      </section>

      {/* === STATS / CHARACTER PANEL === */}
      <section id="tentang" className="z-10 px-4 sm:px-8 py-12 bg-white border-y-[4px] border-dark">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-center font-pixel text-2xl sm:text-3xl text-dark mb-10">
            [ DOJO STATS PANEL ]
          </h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {statData.map((stat, i) => (
              <Card key={i} className="flex flex-col gap-2 hover:-translate-y-1 transition-transform duration-75">
                <span className="font-pixel text-xs text-dark/60 uppercase">{stat.label}</span>
                <span className="font-pixel text-2xl sm:text-3xl text-dark font-bold">{stat.value}</span>
                
                {/* Visual stats-bar like in game GUI */}
                <div className="w-full h-3 bg-dark/10 border-2 border-dark rounded-none overflow-hidden my-1">
                  <div className={`h-full ${stat.color} border-r-2 border-dark`} style={{ width: '85%' }}></div>
                </div>
                
                <p className="font-sans text-xs text-dark/70 leading-relaxed">{stat.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* === TRAINING PROGRAMS === */}
      <section id="program" className="z-10 px-4 sm:px-8 py-16 max-w-6xl mx-auto w-full">
        <h2 className="text-center font-pixel text-2xl sm:text-3xl text-dark mb-12">
          — TRAINING STAGES —
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {programData.map((prog, i) => (
            <Card key={i} className="flex flex-col justify-between gap-4 border-[3px] border-dark shadow-[4px_4px_0px_#1E2A38] hover:-translate-y-1 transition-transform duration-75">
              <div className="flex flex-col gap-3">
                <Badge color={prog.badgeColor} className="self-start">
                  {prog.badge}
                </Badge>
                <h3 className="font-pixel text-lg sm:text-xl text-dark mt-1">{prog.title}</h3>
                <p className="font-sans text-sm text-dark/70 leading-relaxed">{prog.desc}</p>
              </div>

              <div className="mt-4 border-t-2 border-dark/10 pt-4">
                <span className="font-pixel text-xs text-dark/50 block mb-2">ACQUIRED SKILLS:</span>
                <div className="flex flex-wrap gap-2">
                  {prog.skills.map((skill, idx) => (
                    <span key={idx} className="font-pixel text-[10px] bg-dark text-white px-2 py-0.5 border border-dark">
                      +{skill}
                    </span>
                  ))}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* === LOCATIONS / TRAINING ZONES === */}
      <section id="lokasi" className="z-10 px-4 sm:px-8 py-16 bg-secondary/10 border-y-[4px] border-dark w-full">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-center font-pixel text-2xl sm:text-3xl text-dark mb-12">
            [ LOKASI LATIHAN / DOJANGS ]
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {locationData.map((loc, i) => (
              <Card key={i} className="bg-white flex flex-col justify-between gap-4 border-[3px] border-dark shadow-[4px_4px_0px_#1E2A38]">
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <span className="font-pixel text-xs text-dark/50">ZONE 0{i + 1}</span>
                    <span className="font-pixel text-[10px] bg-secondary text-dark border-2 border-dark px-1.5 py-0.5">
                      {loc.badge}
                    </span>
                  </div>
                  <h3 className="font-pixel text-lg text-dark mt-1">{loc.name}</h3>
                  <div className="font-mono text-xs text-dark/70 bg-[#FDF6EC] p-3 border-2 border-dark flex flex-col gap-1 my-2">
                    <div className="flex gap-2">
                      <span className="text-primary font-bold">📅</span>
                      <span>{loc.schedule}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-secondary font-bold">⏰</span>
                      <span>{loc.time}</span>
                    </div>
                  </div>
                  <p className="font-sans text-xs text-dark/60">{loc.place}</p>
                </div>
                
                <a 
                  href={`https://maps.google.com/?q=${encodeURIComponent(loc.name + " " + loc.place)}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="font-pixel text-xs text-center border-2 border-dark py-1.5 bg-[#FDF6EC] hover:bg-primary hover:text-white transition-colors mt-2"
                >
                  MAPS DIRECTION ↗
                </a>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* === COCH PROFILES === */}
      <section id="pelatih" className="z-10 px-4 sm:px-8 py-16 max-w-4xl mx-auto w-full">
        <h2 className="text-center font-pixel text-2xl sm:text-3xl text-dark mb-12">
          — DOJO MASTER / HEAD COACH —
        </h2>

        <Card className="flex flex-col md:flex-row gap-8 items-center bg-white border-[3px] border-dark shadow-[6px_6px_0px_#1E2A38] p-6 sm:p-8">
          {/* Stylized Pixelated Avatar Container */}
          <div className="w-32 h-32 md:w-44 md:h-44 bg-accent border-[3px] border-dark shadow-[4px_4px_0px_#1E2A38] shrink-0 overflow-hidden flex items-center justify-center relative">
            <svg viewBox="0 0 100 100" fill="none" className="w-24 h-24 text-dark" xmlns="http://www.w3.org/2000/svg">
              {/* Retro head profile placeholder SVG */}
              <rect x="35" y="30" width="30" height="30" fill="currentColor" />
              <rect x="25" y="60" width="50" height="20" fill="currentColor" />
              <rect x="40" y="25" width="20" height="5" fill="currentColor" />
              <rect x="30" y="45" width="40" height="5" fill="currentColor" opacity="0.3" />
            </svg>
          </div>

          <div className="flex flex-col gap-4 text-center md:text-left">
            <div>
              <Badge color="accent">DOJO FOUNDER</Badge>
              <h3 className="font-pixel text-xl sm:text-2xl text-dark mt-2">Sabeum Helmi, S.Pd.</h3>
              <p className="font-pixel text-sm text-dark/60 mt-1">SABUK HITAM DAN IV KUKKIWON</p>
            </div>
            <p className="font-sans text-sm text-dark/70 leading-relaxed">
              Memiliki pengalaman kepelatihan lebih dari 10 tahun di Lampung, berdedikasi membangun disiplin, mental juang, dan teknik bela diri taekwondo yang murni untuk melahirkan bibit-bibit atlet berprestasi nasional.
            </p>
            <div className="flex flex-wrap gap-2 justify-center md:justify-start mt-2">
              <span className="font-mono text-xs bg-primary/10 border-2 border-primary/30 px-2.5 py-1 text-primary-dark">✓ Sertifikasi Pelatih Nasional</span>
              <span className="font-mono text-xs bg-secondary/10 border-2 border-secondary/30 px-2.5 py-1 text-secondary-dark">✓ Pengda TI Lampung</span>
            </div>
          </div>
        </Card>
      </section>

      {/* === FAQ QUEST LOG === */}
      <section id="faq" className="z-10 px-4 sm:px-8 py-16 bg-white border-t-[4px] border-dark w-full">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-center font-pixel text-2xl sm:text-3xl text-dark mb-12">
            [ ACTIVE QUESTS / FAQ ]
          </h2>

          <div className="flex flex-col gap-4">
            {faqData.map((faq, i) => (
              <div key={i} className="border-[3px] border-dark bg-[#FDF6EC] shadow-[4px_4px_0px_#1E2A38] overflow-hidden">
                <button
                  onClick={() => toggleFaq(i)}
                  className="w-full text-left p-4 font-pixel text-sm sm:text-base flex items-center justify-between gap-4 select-none hover:bg-dark/5 transition-colors"
                >
                  <span>Q{i + 1}: {faq.q}</span>
                  <span className="font-pixel text-lg shrink-0">
                    {activeFaq === i ? "[-]" : "[+]"}
                  </span>
                </button>
                
                {activeFaq === i && (
                  <div className="p-4 pt-0 border-t-2 border-dark/10 font-sans text-sm text-dark/80 leading-relaxed bg-white">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* === NEUBRUTALIST FOOTER === */}
      <footer className="z-10 bg-dark text-white border-t-[4px] border-dark py-12 px-6 sm:px-12 w-full mt-auto">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex flex-col gap-3 text-center md:text-left">
            <div className="flex items-center gap-3 justify-center md:justify-start">
              <div className="w-8 h-8 bg-white border-2 border-white flex items-center justify-center overflow-hidden">
                <img src="/logo-siger.png" alt="Logo Siger" className="w-full h-full object-cover" />
              </div>
              <span className="font-pixel text-base tracking-wider text-white">SIGER TAEKWONDO CLUB</span>
            </div>
            <p className="font-sans text-xs text-white/60 max-w-sm">
              Sistem manajemen dojang terintegrasi. Memantau kehadiran, pembayaran iuran, serta perkembangan atlet dalam satu database aman.
            </p>
          </div>

          <div className="flex flex-col gap-3 items-center md:items-end">
            <span className="font-pixel text-xs text-white/50">CONNECT ON SOCIAL MEDIA</span>
            <div className="flex gap-4">
              <a 
                href="https://instagram.com" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="w-10 h-10 bg-white text-dark border-2 border-white flex items-center justify-center hover:bg-primary hover:text-white transition-colors shadow-[2px_2px_0px_#ffffff]"
              >
                <span className="font-pixel text-sm font-bold">IG</span>
              </a>
              <a 
                href="https://wa.me" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="w-10 h-10 bg-white text-dark border-2 border-white flex items-center justify-center hover:bg-secondary hover:text-white transition-colors shadow-[2px_2px_0px_#ffffff]"
              >
                <span className="font-pixel text-sm font-bold">WA</span>
              </a>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto mt-10 pt-6 border-t border-white/10 text-center">
          <p className="font-pixel text-[10px] text-white/40">
            © 2026 Siger Taekwondo Club — All Rights Reserved. Built with ❤️ for Lampung Athletes.
          </p>
        </div>
      </footer>
    </main>
  );
}
