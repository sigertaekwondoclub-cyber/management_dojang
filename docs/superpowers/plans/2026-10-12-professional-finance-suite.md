# Professional Finance Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the club finance page into a complete Professional Financial Suite with Bank Reconciliation, formal P&L Statement, Balance Sheet, and unified cash ledger.

**Architecture:** A 4-tab interface in `/admin/keuangan` backed by Supabase tables (`keuangan_club`, `rekonsiliasi_bank`, `iuran`, `kasbon_pelatih`, `payroll_details`). Server actions handle reconciliation toggles and snapshot audit logging.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Tailwind CSS, Supabase PostgreSQL, xlsx.

---

## Global Constraints
- Must preserve Indonesian Rupiah formatting and brutalist design aesthetic.
- Must ensure Net Profit (P&L) and Cash Balance (Arus Kas) formulas are strictly separated.
- Zero TypeScript or lint errors on `npm run build`.

---

## File Structure

- Create: `supabase/migrations/023_bank_reconciliation.sql` (schema updates)
- Modify: `src/lib/types.ts` (type definitions)
- Create: `src/app/admin/keuangan/actions.ts` (server actions for reconciliation)
- Create: `src/components/keuangan/BankReconciliationTab.tsx` (Tab 2 component)
- Create: `src/components/keuangan/ProfitLossTab.tsx` (Tab 3 component)
- Create: `src/components/keuangan/BalanceSheetTab.tsx` (Tab 4 component)
- Modify: `src/app/admin/keuangan/page.tsx` (Tab controller & state integration)

---

### Task 1: Database Migration & Type Definitions

**Files:**
- Create: `supabase/migrations/023_bank_reconciliation.sql`
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Write migration SQL file**
- [ ] **Step 2: Apply migration to Supabase using node script**
- [ ] **Step 3: Update `src/lib/types.ts` with `RekonsiliasiBank` and `is_reconciled`**
- [ ] **Step 4: Commit Task 1**

---

### Task 2: Server Actions for Bank Reconciliation

**Files:**
- Create: `src/app/admin/keuangan/actions.ts`

- [ ] **Step 1: Implement `toggleReconcileStatus` to update `is_reconciled` and `reconciled_at`**
- [ ] **Step 2: Implement `saveBankReconciliation` to log reconciliation snapshot**
- [ ] **Step 3: Implement `getReconciliationHistory` to fetch past audits**
- [ ] **Step 4: Test server actions using node verification script**
- [ ] **Step 5: Commit Task 2**

---

### Task 3: Bank Reconciliation Tab Component

**Files:**
- Create: `src/components/keuangan/BankReconciliationTab.tsx`

- [ ] **Step 1: Build comparative summary cards (Book balance vs Bank balance vs Unreconciled diff)**
- [ ] **Step 2: Build interactive transaction checklist table with status badge and toggle switch**
- [ ] **Step 3: Build "Simpan Snapshot Rekonsiliasi" modal dialog**
- [ ] **Step 4: Build audit history log table**
- [ ] **Step 5: Commit Task 3**

---

### Task 4: Standard Profit & Loss (P&L) Tab Component

**Files:**
- Create: `src/components/keuangan/ProfitLossTab.tsx`

- [ ] **Step 1: Build Revenue Breakdown card (SPP, Merchant, Ujian/Event)**
- [ ] **Step 2: Build Expense Breakdown card (Honor, Perlengkapan, Sewa, Ops)**
- [ ] **Step 3: Build Operating Profit & Net Profit cards with margin % indicator**
- [ ] **Step 4: Add educational callout explaining difference between Net Profit and Cash Balance**
- [ ] **Step 5: Commit Task 4**

---

### Task 5: Balance Sheet (Neraca Keuangan) Tab Component

**Files:**
- Create: `src/components/keuangan/BalanceSheetTab.tsx`

- [ ] **Step 1: Fetch and compute Current Assets (Kas & Bank, Piutang Iuran Siswa, Piutang Kasbon Pelatih)**
- [ ] **Step 2: Fetch and compute Liabilities (Honor Pelatih belum dibayar)**
- [ ] **Step 3: Compute Net Equity / Club Net Worth**
- [ ] **Step 4: Render clean visual balance sheet breakdown**
- [ ] **Step 5: Commit Task 5**

---

### Task 6: Integrate Tabs into `/admin/keuangan/page.tsx`

**Files:**
- Modify: `src/app/admin/keuangan/page.tsx`

- [ ] **Step 1: Add tab navigation bar (`Buku Kas`, `Rekonsiliasi Bank`, `Laba Rugi`, `Neraca`)**
- [ ] **Step 2: Connect all tab components with unified data & state**
- [ ] **Step 3: Verify Excel & PDF export compatibility**
- [ ] **Step 4: Commit Task 6**

---

### Task 7: Full Verification & Build

- [ ] **Step 1: Run `npm run build` and ensure 0 errors**
- [ ] **Step 2: Verify all 45 routes compile cleanly**
- [ ] **Step 3: Git push to origin master**
