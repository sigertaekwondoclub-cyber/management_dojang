# Design Spec: Siger Taekwondo Club Landing Page

Documenting the enhancement of the root homepage (`/`) into a professional, informative, and visually engaging Neo-Brutalist landing page for Siger Taekwondo Club.

## Context & Objectives
The root page of the Siger Taekwondo Club manager (`/`) is currently a basic home screen with three feature overview cards. To make the site more welcoming to new prospective students/parents and to present a professional club image, we will transform it into a full landing page.
We will maintain and enrich the existing **Neo-Brutalist retro-game aesthetic** (`font-pixel`, high-contrast borders, shadow-brutal, Green/Blue/Red accent colors, scanline overlays).

## Proposed Layout & Sections

### 1. Navigation Bar (Sticky Navbar)
- **Design:** Top floating menu with solid dark border, white/cream background, and neubrutalist hover animations.
- **Links:** 
  - Tentang Club
  - Program
  - Lokasi Dojang
  - FAQ
- **Actions:** Login & Daftar buttons.

### 2. Upgraded Hero (Stage 0: Welcome Gate)
- Refine existing title and description.
- Retain the retro bouncy logo and sporty floating SVGs.
- Enhance the primary/secondary CTA layout.

### 3. Club Stats (Level Stats)
- Present key achievements styled as an RPG character stats block (e.g., HP/MP style bars or retro stats widgets):
  - **500+ Atlet Aktif** (Active Members)
  - **15+ Sabuk Hitam/Pelatih** (Dojo Masters)
  - **8 Dojang Latihan** (Zones)
  - **120+ Medali Prestasi** (Trophy Points)

### 4. Programs Section (Training Stages)
- Visual cards displaying the core disciplines:
  - **Kyorugi (Tarung)** - Taktik pertarungan & kompetisi.
  - **Poomsae (Jurus)** - Keindahan teknik, ketepatan tendangan/pukulan.
  - **Reguler & Kids** - Disiplin dasar, motorik anak, & bela diri praktis.

### 5. Locations Section (Training Zones)
- Standardized grid cards showing training schedules and coordinates for branches in Lampung (PKOR Way Halim, GOR Pahoman, Kampus UIN).

### 6. Coaches / Masters Profile
- Interactive profiles of the main coaches:
  - **Sabeum Helmi, S.Pd.** (Sabuk Hitam Dan IV) - Founder & Head Coach.
  - Supporting instructors list.

### 7. FAQ Log (Active Quests)
- A neubrutalist accordion component allowing visitors to toggle answers to frequently asked questions (eligibility age, equipment cost, training schedules).

### 8. Footer (Final Save Point)
- Social media links (Instagram, WhatsApp) and copyrights.

---

## Architectural & Tech Considerations
- **Tailwind v3:** Follow current tailwind configuration (`tailwind.config.ts`).
- **Interactive state:** Use simple React states for Accordion toggle.
- **RSC compatibility:** The main page will remain a Server Component, with interactive parts (like accordion and mobile navigation) isolated or handled with simple client components if necessary, or client components for the interactive elements of the landing page.
