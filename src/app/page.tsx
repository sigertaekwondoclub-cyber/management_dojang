import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 sm:p-24">
      <div className="z-10 w-full max-w-5xl items-center justify-between font-mono text-sm flex flex-col gap-12">
        
        {/* Hero Section */}
        <div className="text-center flex flex-col items-center gap-6">
          <Badge color="secondary" className="mb-2 text-dark font-sans text-sm">Versi Beta 1.0</Badge>
          {/* Logo Siger TC */}
          <img 
            src="/logo-siger.png" 
            alt="Logo Siger Taekwondo Club" 
            className="w-32 h-32 md:w-40 md:h-40 object-contain drop-shadow-md animate-fade-in" 
          />
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-dark drop-shadow-sm mt-2">
            Siger Taekwondo Club
          </h1>
          <p className="text-lg md:text-xl font-sans max-w-2xl text-dark/80">
            Aplikasi manajemen keanggotaan, jadwal latihan, dan perkembangan atlet untuk Siger Taekwondo Club.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 mt-8">
            <Link href="/login">
              <Button variant="primary" className="text-lg px-8 w-full sm:w-auto">
                Masuk
              </Button>
            </Link>
            <Link href="/daftar">
              <Button variant="accent" className="text-lg px-8 w-full sm:w-auto">
                Daftar Sekarang
              </Button>
            </Link>
          </div>
        </div>

        {/* Feature Cards Preview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 w-full mt-12">
          <Card className="flex flex-col gap-4">
            <div className="h-12 w-12 rounded-full bg-primary border-2 border-dark shadow-brutal flex items-center justify-center font-bold text-xl">
              1
            </div>
            <h3 className="text-xl font-bold font-sans">Manajemen Anggota</h3>
            <p className="font-sans text-dark/80">Pantau data atlet, sabuk, dan prestasi dengan mudah.</p>
          </Card>
          
          <Card className="flex flex-col gap-4">
            <div className="h-12 w-12 rounded-full bg-secondary border-2 border-dark shadow-brutal flex items-center justify-center font-bold text-xl">
              2
            </div>
            <h3 className="text-xl font-bold font-sans">Jadwal Latihan</h3>
            <p className="font-sans text-dark/80">Atur jadwal latihan dan absensi untuk tiap dojang.</p>
          </Card>
          
          <Card className="flex flex-col gap-4">
            <div className="h-12 w-12 rounded-full bg-accent border-2 border-dark shadow-brutal flex items-center justify-center font-bold text-xl">
              3
            </div>
            <h3 className="text-xl font-bold font-sans">Pembayaran</h3>
            <p className="font-sans text-dark/80">Sistem pencatatan iuran dan administrasi yang transparan.</p>
          </Card>
        </div>

      </div>
    </main>
  );
}
