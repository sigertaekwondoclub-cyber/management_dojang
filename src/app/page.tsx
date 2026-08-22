"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import Link from "next/link";

const supabase = createClient();

export default function Home() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [siswaAktif, setSiswaAktif] = useState<number>(0);
  const [pelatihAktif, setPelatihAktif] = useState<number>(0);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      const [siswaRes, pelatihRes] = await Promise.all([
        supabase.from("siswa").select("id", { count: "exact", head: true }).eq("status_aktif", true),
        supabase.from("pelatih").select("id", { count: "exact", head: true }).eq("status_aktif", true),
      ]);
      setSiswaAktif(siswaRes.count || 0);
      setPelatihAktif(pelatihRes.count || 0);
      setLoadingStats(false);
    }
    fetchStats();
  }, []);

  const toggleFaq = (index: number) => {
    setActiveFaq(activeFaq === index ? null : index);
  };

  const faqData = [
    {
      q: "Berapa batasan usia untuk mendaftar?",
      a: "Kami menerima atlet mulai dari usia 5 tahun. Materi latihan akan disesuaikan dengan kelompok umur masing-masing (kelas anak, junior, remaja, dan dewasa)."
    },
    {
      q: "Kapan dan di mana jadwal latihan terdekat?",
      a: "Kami memiliki dua lokasi latihan aktif: Minggu pagi pukul 07.00–09.00 di Pelataran Perpustakaan Unila, dan Selasa/Rabu malam pukul 19.00–21.00 di Basecamp Siger TC."
    },
    {
      q: "Bagaimana sistem pembayaran iuran bulanan?",
      a: "Seluruh pencatatan keuangan, iuran bulanan (SPP), dan biaya ujian kenaikan tingkat dikelola secara transparan melalui portal wali murid (akun Ortu) di dalam aplikasi manajemen ini."
    },
    {
      q: "Apakah harus memiliki perlengkapan sendiri?",
      a: "Untuk sesi pertama, cukup kenakan pakaian olahraga biasa. Setelah resmi terdaftar, atlet disarankan memiliki Dobok (seragam Taekwondo) dan pelindung yang dapat dipesan langsung di merchant dojang kami."
    },
    {
      q: "Bagaimana cara mendaftar sebagai anggota baru?",
      a: "Klik tombol 'Bergabung Sekarang' di halaman ini, isi formulir pendaftaran, lalu tunggu verifikasi dari admin. Setelah diverifikasi, akun portal orang tua akan aktif dan latihan dapat dimulai."
    }
  ];

  const programData = [
    {
      title: "Kyorugi (Tarung)",
      desc: "Pembinaan intensif taktik pertarungan, fisik atlet, kecepatan reaksi, mental tanding, dan penguasaan aturan kompetisi untuk persiapan turnamen prestasi.",
      badge: "PRESTASI",
      badgeColor: "accent" as const,
      skills: ["Speed Kick", "Agility", "Match Sparring"]
    },
    {
      title: "Poomsae (Jurus)",
      desc: "Pelatihan keselarasan gerakan, keindahan teknik tendangan, pukulan, tangkisan, serta fokus mental dalam mempraktikkan jurus resmi Taekwondo.",
      badge: "TEKNIS",
      badgeColor: "secondary" as const,
      skills: ["Form Precision", "Balance", "Flexibility"]
    },
    {
      title: "Reguler & Kids",
      desc: "Pengembangan disiplin diri, percaya diri, pembentukan karakter, kemampuan bela diri praktis, serta optimalisasi motorik anak sejak usia dini.",
      badge: "DASAR",
      badgeColor: "primary" as const,
      skills: ["Self Defense", "Discipline", "Motor Skills"]
    }
  ];

  const locationData = [
    {
      name: "Pelataran Perpustakaan Unila",
      schedule: "Minggu",
      time: "07.00 – 09.00 WIB",
      place: "Pelataran Perpustakaan Pusat Universitas Lampung",
      mapsUrl: "https://maps.app.goo.gl/YXwnuYvuQJGh5wpd7",
      badge: "Aktif"
    },
    {
      name: "Basecamp Siger TC",
      schedule: "Selasa / Rabu",
      time: "19.00 – 21.00 WIB",
      place: "Basecamp Siger Taekwondo Club, Bandar Lampung",
      mapsUrl: "https://maps.google.com/?q=Basecamp+Siger+Taekwondo+Club+Bandar+Lampung",
      badge: "Aktif"
    }
  ];

  const coachData = [
    {
      name: "Jalian Pebriandy, S.Kom",
      grade: "SABUK HITAM DAN 1 KUKKIWON",
      desc: "Pelatih utama dan co-founder Siger Taekwondo Club. Aktif membina atlet di berbagai jenjang latihan dan kompetisi di Lampung.",
      certs: ["Pelatih Bersertifikat", "Dan 1 Kukkiwon"]
    },
    {
      name: "Yuli Astiti, S.Kom",
      grade: "SABUK HITAM DAN 1 KUKKIWON",
      desc: "Pelatih aktif Siger TC yang fokus pada pembinaan teknik dasar, poomsae, dan pengembangan atlet usia junior.",
      certs: ["Pelatih Bersertifikat", "Dan 1 Kukkiwon"]
    }
  ];

  return (
    <main className="flex min-h-screen flex-col bg-[#FDF6EC] text-dark relative overflow-x-hidden pt-20">
      {/* Scanline overlay */}
      <div className="pointer-events-none fixed inset-0 z-50 opacity-[0.03]" style={{
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.3) 2px, rgba(0,0,0,0.3) 4px)',
      }} />

      {/* Background Grid */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-[0.3]" style={{
        backgroundImage: `
          radial-gradient(rgba(30, 42, 56, 0.15) 1px, transparent 1px),
          linear-gradient(rgba(30, 42, 56, 0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(30, 42, 56, 0.04) 1px, transparent 1px)
        `,
        backgroundSize: '24px 24px, 120px 120px, 120px 120px',
      }} />

      {/* Blur blobs */}
      <div className="absolute top-[10%] left-[-5%] w-80 h-80 bg-primary/8 rounded-full blur-[80px] pointer-events-none z-0" />
      <div className="absolute bottom-[20%] right-[-5%] w-[450px] h-[450px] bg-secondary/8 rounded-full blur-[110px] pointer-events-none z-0" />

      {/* === STICKY NAVIGATION === */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-[#FDF6EC] border-b-[4px] border-dark px-4 sm:px-8 py-3 flex items-center justify-between shadow-[0_4px_0px_#1E2A38]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white border-[3px] border-dark shadow-[2px_2px_0px_#1E2A38] flex items-center justify-center overflow-hidden">
            <img src="/logo-siger.png" alt="Logo Siger TC" className="w-full h-full object-cover" />
          </div>
          <span className="font-pixel text-base tracking-wider hidden sm:block">SIGER TC</span>
        </div>

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

        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="md:hidden p-2 border-[3px] border-dark bg-white shadow-[2px_2px_0px_#1E2A38] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isMenuOpen
              ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" />
              : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 6h16M4 12h16M4 18h16" />}
          </svg>
        </button>
      </header>

      {/* Mobile Drawer */}
      {isMenuOpen && (
        <div className="fixed inset-0 top-[68px] z-30 bg-[#FDF6EC] border-b-[4px] border-dark flex flex-col p-6 gap-6 md:hidden animate-fade-in">
          <nav className="flex flex-col gap-4">
            {[["#tentang","TENTANG"],["#program","PROGRAM"],["#lokasi","LOKASI"],["#pelatih","PELATIH"],["#faq","FAQ"]].map(([href, label]) => (
              <a key={href} onClick={() => setIsMenuOpen(false)} href={href} className="font-pixel text-lg border-b-2 border-dark pb-2">▶ {label}</a>
            ))}
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

      {/* === HERO === */}
      <section id="hero" className="z-10 px-6 sm:px-16 pt-8 pb-16 flex flex-col items-center text-center gap-8 max-w-4xl mx-auto">
        <div className="w-24 h-24 md:w-32 md:h-32 bg-white border-[4px] border-dark shadow-[6px_6px_0px_#1E2A38] flex items-center justify-center overflow-hidden animate-bounce-in">
          <img src="/logo-siger.png" alt="Logo Siger Taekwondo Club" className="w-full h-full object-cover" />
        </div>

        <h1 className="text-3xl sm:text-5xl md:text-6xl font-pixel tracking-wide text-dark leading-tight animate-fade-in-up">
          Siger Taekwondo Club
        </h1>
        <p className="text-sm sm:text-base md:text-lg font-sans max-w-xl text-dark/80 leading-relaxed animate-fade-in-up">
          Klub bela diri taekwondo di Lampung. Kelola keanggotaan, jadwal latihan, dan pantau perkembangan atlet secara transparan dalam satu sistem.
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

      {/* === DOJANG STATS PANEL === */}
      <section id="tentang" className="z-10 px-4 sm:px-8 py-12 bg-white border-y-[4px] border-dark">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-center font-pixel text-2xl sm:text-3xl text-dark mb-10">
            [ DOJANG STATS PANEL ]
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {/* Atlet Aktif */}
            <Card className="flex flex-col gap-2 hover:-translate-y-1 transition-transform duration-75">
              <span className="font-pixel text-xs text-dark/60 uppercase">Atlet Terdaftar</span>
              <span className="font-pixel text-3xl sm:text-4xl text-dark">
                {loadingStats ? "..." : siswaAktif}
              </span>
              <div className="w-full h-3 bg-dark/10 border-2 border-dark overflow-hidden my-1">
                <div className="h-full bg-primary border-r-2 border-dark" style={{ width: '80%' }} />
              </div>
              <p className="font-sans text-xs text-dark/70">Atlet aktif terdaftar di sistem</p>
            </Card>

            {/* Pelatih Aktif */}
            <Card className="flex flex-col gap-2 hover:-translate-y-1 transition-transform duration-75">
              <span className="font-pixel text-xs text-dark/60 uppercase">Dojang Masters</span>
              <span className="font-pixel text-3xl sm:text-4xl text-dark">
                {loadingStats ? "..." : pelatihAktif}
              </span>
              <div className="w-full h-3 bg-dark/10 border-2 border-dark overflow-hidden my-1">
                <div className="h-full bg-secondary border-r-2 border-dark" style={{ width: '70%' }} />
              </div>
              <p className="font-sans text-xs text-dark/70">Pelatih berlisensi aktif</p>
            </Card>

            {/* Cabang */}
            <Card className="flex flex-col gap-2 hover:-translate-y-1 transition-transform duration-75">
              <span className="font-pixel text-xs text-dark/60 uppercase">Training Zones</span>
              <span className="font-pixel text-3xl sm:text-4xl text-dark">1</span>
              <div className="w-full h-3 bg-dark/10 border-2 border-dark overflow-hidden my-1">
                <div className="h-full bg-accent border-r-2 border-dark" style={{ width: '60%' }} />
              </div>
              <p className="font-sans text-xs text-dark/70">Dojang cabang aktif di Lampung</p>
            </Card>
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
            <Card key={i} className="flex flex-col justify-between gap-4 hover:-translate-y-1 transition-transform duration-75">
              <div className="flex flex-col gap-3">
                <Badge color={prog.badgeColor} className="self-start">{prog.badge}</Badge>
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

      {/* === LOKASI LATIHAN === */}
      <section id="lokasi" className="z-10 px-4 sm:px-8 py-16 bg-secondary/10 border-y-[4px] border-dark w-full">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-center font-pixel text-2xl sm:text-3xl text-dark mb-12">
            [ LOKASI LATIHAN / DOJANG ]
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {locationData.map((loc, i) => (
              <Card key={i} className="bg-white flex flex-col justify-between gap-4">
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <span className="font-pixel text-xs text-dark/50">ZONE 0{i + 1}</span>
                    <span className="font-pixel text-[10px] bg-primary text-dark border-2 border-dark px-1.5 py-0.5">
                      {loc.badge}
                    </span>
                  </div>
                  <h3 className="font-pixel text-base sm:text-lg text-dark mt-1">{loc.name}</h3>

                  <div className="font-mono text-xs text-dark/80 bg-[#FDF6EC] p-3 border-2 border-dark flex flex-col gap-2 my-2">
                    <div className="flex items-start gap-2">
                      <span className="text-secondary font-bold shrink-0">DAY</span>
                      <span>{loc.schedule}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-primary font-bold shrink-0">TIME</span>
                      <span>{loc.time}</span>
                    </div>
                  </div>

                  <p className="font-sans text-xs text-dark/60 leading-relaxed">{loc.place}</p>
                </div>

                <a
                  href={loc.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-pixel text-xs text-center border-2 border-dark py-2 bg-[#FDF6EC] hover:bg-primary hover:text-white transition-colors mt-2"
                >
                  MAPS DIRECTION ↗
                </a>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* === PELATIH / COACHES === */}
      <section id="pelatih" className="z-10 px-4 sm:px-8 py-16 max-w-4xl mx-auto w-full">
        <h2 className="text-center font-pixel text-2xl sm:text-3xl text-dark mb-12">
          — DOJANG MASTERS / PELATIH —
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {coachData.map((coach, i) => (
            <Card key={i} className="flex flex-col gap-4 bg-white">
              {/* Pixel avatar */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 shrink-0 bg-accent border-[3px] border-dark shadow-[3px_3px_0px_#1E2A38] flex items-center justify-center overflow-hidden">
                  <svg viewBox="0 0 64 64" fill="none" className="w-10 h-10 text-dark" xmlns="http://www.w3.org/2000/svg">
                    <rect x="22" y="14" width="20" height="22" fill="currentColor" />
                    <rect x="14" y="36" width="36" height="14" fill="currentColor" />
                    <rect x="26" y="10" width="12" height="4" fill="currentColor" />
                  </svg>
                </div>
                <div>
                  <Badge color="dark" className="text-[10px] mb-1">PELATIH</Badge>
                  <h3 className="font-pixel text-sm sm:text-base text-dark leading-snug">{coach.name}</h3>
                  <p className="font-pixel text-[10px] text-dark/60 mt-0.5">{coach.grade}</p>
                </div>
              </div>

              <p className="font-sans text-sm text-dark/70 leading-relaxed border-t-2 border-dark/10 pt-3">
                {coach.desc}
              </p>

              <div className="flex flex-wrap gap-2">
                {coach.certs.map((cert, idx) => (
                  <span key={idx} className="font-mono text-[10px] bg-primary/10 border-2 border-primary/30 px-2 py-0.5 text-dark">
                    ✓ {cert}
                  </span>
                ))}
              </div>
            </Card>
          ))}
        </div>
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
                  <span className="font-pixel text-base shrink-0">{activeFaq === i ? "[-]" : "[+]"}</span>
                </button>
                {activeFaq === i && (
                  <div className="p-4 pt-0 border-t-2 border-dark/10 font-sans text-sm text-dark/80 leading-relaxed bg-white">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* CTA bottom */}
          <div className="mt-12 text-center flex flex-col items-center gap-4">
            <h3 className="font-pixel text-xl text-dark">Siap Naik Level?</h3>
            <p className="font-sans text-sm text-dark/70 max-w-sm">
              Bergabunglah dengan Siger Taekwondo Club dan mulai perjalanan bela dirimu hari ini.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mt-2">
              <Link href="/daftar">
                <Button variant="primary" className="px-8 py-3">✦ DAFTAR SEKARANG</Button>
              </Link>
              <a
                href="https://wa.me/6285369900000"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="secondary" className="px-8 py-3">💬 HUBUNGI KAMI</Button>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* === FOOTER === */}
      <footer className="z-10 bg-dark text-white border-t-[4px] border-dark py-12 px-6 sm:px-12 w-full mt-auto">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex flex-col gap-3 text-center md:text-left">
            <div className="flex items-center gap-3 justify-center md:justify-start">
              <div className="w-8 h-8 bg-white border-2 border-white overflow-hidden flex items-center justify-center">
                <img src="/logo-siger.png" alt="Logo Siger" className="w-full h-full object-cover" />
              </div>
              <span className="font-pixel text-base tracking-wider text-white">SIGER TAEKWONDO CLUB</span>
            </div>
            <p className="font-sans text-xs text-white/60 max-w-sm">
              Sistem manajemen dojang terintegrasi untuk memantau kehadiran, pembayaran iuran, dan perkembangan atlet.
            </p>
          </div>

          <div className="flex flex-col gap-3 items-center md:items-end">
            <span className="font-pixel text-xs text-white/50">CONNECT</span>
            <div className="flex gap-4">
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 bg-white text-dark border-2 border-white flex items-center justify-center hover:bg-accent transition-colors shadow-[2px_2px_0px_#ffffff]"
              >
                <span className="font-pixel text-sm font-bold">IG</span>
              </a>
              <a
                href="https://wa.me"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 bg-white text-dark border-2 border-white flex items-center justify-center hover:bg-primary transition-colors shadow-[2px_2px_0px_#ffffff]"
              >
                <span className="font-pixel text-sm font-bold">WA</span>
              </a>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto mt-10 pt-6 border-t border-white/10 text-center">
          <p className="font-pixel text-[10px] text-white/40">
            © 2026 Siger Taekwondo Club — All Rights Reserved.
          </p>
        </div>
      </footer>
    </main>
  );
}
