# Responsive Mobile Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adapt the navigation layouts of Admin, Pelatih, and Ortu to be fully mobile-responsive using a Top Header, a Bottom Navigation Bar for main options, and a sliding Bottom Sheet Drawer for remaining options.

**Architecture:** Use responsive Tailwind CSS utilities (`hidden md:flex`, `md:hidden`, etc.) to toggle between the desktop sidebar layout and the mobile layout. State-driven drawers will handle bottom sheet visibility.

**Tech Stack:** Next.js, React, Tailwind CSS.

## Global Constraints
- Keep styling consistent with the existing Brutalism Design System (black borders, thick shadows `shadow-brutal`, font variables).

---

### Task 1: Responsive Navigation for Admin Layout

**Files:**
- Modify: `src/app/admin/layout.tsx`

**Interfaces:**
- Consumes: Existing admin menu list and Supabase client code in `src/app/admin/layout.tsx`.
- Produces: Responsive top header, bottom bar, and slide-up bottom sheet drawer for Admin Panel.

- [ ] **Step 1: Open the file `src/app/admin/layout.tsx`**
- [ ] **Step 2: Add `isDrawerOpen` state to AdminLayout**
  Add `const [isDrawerOpen, setIsDrawerOpen] = useState(false)` near the top state declarations.
- [ ] **Step 3: Modify layout return code to render sidebar conditionally and add mobile navbar + bottom sheet**
  Apply responsive Tailwind classes:
  - Hide the sidebar on mobile: `hidden md:flex` on `aside`.
  - Add a mobile top bar (`md:hidden`) with Logo and title.
  - Add a mobile bottom bar (`md:hidden`) with the 4 main items (Dashboard, Siswa, Iuran, Keuangan) + "Lainnya" button.
  - Add the sliding Bottom Sheet Drawer (`isDrawerOpen && (...)`) with remaining menu links and the Logout button.
  - Modify the main content element to have appropriate padding on mobile: `pb-20 md:pb-6` so the bottom navigation bar does not overlap content.
- [ ] **Step 4: Verify visually that compile succeeds without TypeScript or Tailwind issues**
- [ ] **Step 5: Commit changes**
  ```bash
  git add src/app/admin/layout.tsx
  git commit -m "feat: implement responsive mobile navigation for admin panel"
  ```

---

### Task 2: Responsive Navigation for Pelatih Layout

**Files:**
- Modify: `src/app/pelatih/layout.tsx`

**Interfaces:**
- Consumes: Existing pelatih layout structure.
- Produces: Responsive top header, bottom bar, and bottom sheet drawer for Pelatih Panel.

- [ ] **Step 1: Open the file `src/app/pelatih/layout.tsx`**
- [ ] **Step 2: Add `isDrawerOpen` state to PelatihLayout**
  Add `const [isDrawerOpen, setIsDrawerOpen] = useState(false)`.
- [ ] **Step 3: Refactor Layout JSX to be responsive**
  - Add `hidden md:flex` on desktop sidebar (`aside`).
  - Add mobile top bar (`md:hidden`).
  - Add mobile bottom bar (`md:hidden`) with main items: Dashboard, Absensi, Ujian, and Lainnya.
  - Add Bottom Sheet for remaining items: Event Kompetisi, Honor Saya, and Logout.
  - Set main container padding bottom to `pb-20 md:pb-6`.
- [ ] **Step 4: Verify compile succeeds**
- [ ] **Step 5: Commit changes**
  ```bash
  git add src/app/pelatih/layout.tsx
  git commit -m "feat: implement responsive mobile navigation for pelatih panel"
  ```

---

### Task 3: Responsive Navigation for Ortu Layout

**Files:**
- Modify: `src/app/ortu/layout.tsx`

**Interfaces:**
- Consumes: Existing ortu layout structure.
- Produces: Responsive top header, bottom bar, and bottom sheet drawer for Ortu Panel.

- [ ] **Step 1: Open the file `src/app/ortu/layout.tsx`**
- [ ] **Step 2: Add `isDrawerOpen` state to OrtuLayout**
  Add `const [isDrawerOpen, setIsDrawerOpen] = useState(false)`.
- [ ] **Step 3: Refactor Layout JSX to be responsive**
  - Add `hidden md:flex` on desktop sidebar (`aside`).
  - Add mobile top bar (`md:hidden`).
  - Add mobile bottom bar (`md:hidden`) with main items: Dashboard, Absensi, Iuran, and Lainnya.
  - Add Bottom Sheet for remaining items: Riwayat Ujian, Event Kompetisi, Kartu Anggota, and Logout.
  - Set main container padding bottom to `pb-20 md:pb-6`.
- [ ] **Step 4: Verify compile succeeds**
- [ ] **Step 5: Commit changes**
  ```bash
  git add src/app/ortu/layout.tsx
  git commit -m "feat: implement responsive mobile navigation for ortu panel"
  ```
