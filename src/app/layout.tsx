import type { Metadata } from "next";
import { Baloo_2, Inter } from "next/font/google";
import "./globals.css";

const baloo2 = Baloo_2({
  subsets: ["latin"],
  variable: "--font-baloo2",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: 'Siger Taekwondo Club',
  description: 'Sistem Manajemen Klub Taekwondo Siger',
  manifest: '/manifest.json',
  themeColor: '#22C55E',
  icons: {
    icon: '/favicon.ico',
    apple: '/icon-192x192.png',
    shortcut: '/favicon.ico',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Siger TKD',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body
        className={`${inter.variable} ${baloo2.variable} font-sans bg-background text-dark antialiased min-h-screen`}
      >
        {children}
      </body>
    </html>
  );
}
