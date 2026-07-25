# Web UI/UX Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polishing component design and hiding global background watermark inside dashboard panels (Admin, Pelatih, Ortu) while keeping it on public pages.

**Architecture:** Use CSS rules, Client-side hooks to toggle classes on `document.body`, and refactor Reusable UI components.

**Tech Stack:** Next.js, React, Tailwind CSS, Vanilla CSS.

## Global Constraints
- Keep Neo-Brutalism styling consistent (thick borders, solid offsets).

---

### Task 1: Update Global CSS Styles (globals.css)

**Files:**
- Modify: `src/app/globals.css`

**Interfaces:**
- Consumes: Existing Tailwind CSS configuration.
- Produces: CSS utility rules for hiding watermark, customizing scrollbars, and helper styles.

- [ ] **Step 1: Open the file `src/app/globals.css`**
- [ ] **Step 2: Add CSS rules to support watermark hiding, custom scrollbar styling, and transiton classes**
  Modify the file to include:
  - `.hide-watermark::after { display: none !important; }` (Since watermark is on `body::after`, if `body` has class `.hide-watermark`, hide it).
  - Webkit and standard CSS custom scrollbar rules.
- [ ] **Step 3: Verify visually compile succeeds**
- [ ] **Step 4: Commit changes**
  ```bash
  git add src/app/globals.css
  git commit -m "style: add responsive scrollbars and watermark hide utilities to globals.css"
  ```

---

### Task 2: Polish Button Component

**Files:**
- Modify: `src/components/ui/Button.tsx`

- [ ] **Step 1: Open the file `src/components/ui/Button.tsx`**
- [ ] **Step 2: Update styling classes in `Button.tsx`**
  - Add transition durations: `transition-all duration-150`.
  - Adjust base styles and variants for hover / active states to translate the button slightly and enlarge the shadow offset.
- [ ] **Step 3: Verify compile succeeds**
- [ ] **Step 4: Commit changes**
  ```bash
  git add src/components/ui/Button.tsx
  git commit -m "style: polish button micro-animations for better taktil response"
  ```

---

### Task 3: Polish Card Component

**Files:**
- Modify: `src/components/ui/Card.tsx`

- [ ] **Step 1: Open the file `src/components/ui/Card.tsx`**
- [ ] **Step 2: Support `hoverable` prop in `CardProps`**
  Add optional `hoverable?: boolean` to `CardProps`.
  If `hoverable` is true, append hover classes: `hover:-translate-y-1 hover:shadow-[6px_6px_0px_#1E2A38] transition-all duration-150`.
- [ ] **Step 3: Verify compile succeeds**
- [ ] **Step 4: Commit changes**
  ```bash
  git add src/components/ui/Card.tsx
  git commit -m "style: add hoverable prop and styling to Card component"
  ```

---

### Task 4: Polish Input Component

**Files:**
- Modify: `src/components/ui/Input.tsx`

- [ ] **Step 1: Open the file `src/components/ui/Input.tsx`**
- [ ] **Step 2: Update Input styling classes**
  Add focus shadow: `focus:shadow-[2px_2px_0px_#1E2A38] transition-all duration-150`.
- [ ] **Step 3: Verify compile succeeds**
- [ ] **Step 4: Commit changes**
  ```bash
  git add src/components/ui/Input.tsx
  git commit -m "style: add focus shadow and transition to Input component"
  ```

---

### Task 5: Integrate Watermark Hiding in Dashboard Layouts

**Files:**
- Modify: `src/app/admin/layout.tsx`
- Modify: `src/app/pelatih/layout.tsx`
- Modify: `src/app/ortu/layout.tsx`

- [ ] **Step 1: Add useEffect in admin layout to add/remove `hide-watermark` class on body**
- [ ] **Step 2: Add useEffect in pelatih layout to add/remove `hide-watermark` class on body**
- [ ] **Step 3: Add useEffect in ortu layout to add/remove `hide-watermark` class on body**
- [ ] **Step 4: Verify compile succeeds**
- [ ] **Step 5: Commit changes**
  ```bash
  git add src/app/admin/layout.tsx src/app/pelatih/layout.tsx src/app/ortu/layout.tsx
  git commit -m "feat: hide global watermark on dashboard panels"
  ```
