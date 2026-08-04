# Design Spec: Browser Tab Logo Optimization

Optimize the high-resolution logo and configure it properly as the browser tab icon (favicon) to ensure fast load times and correct rendering across all pages.

## Proposed Changes

### Icon Optimization & Generation

We will create a python script `scratch/optimize_logo.py` to process the high-resolution `public/logo-siger.png` (5.4MB) and generate web-optimized icons.

- **Files generated**:
  - `public/favicon.ico` (32x32)
  - `public/icon-192x192.png` (192x192)
  - `public/icon-512x512.png` (512x512)

### Cleanup

- **[DELETE]** `src/app/icon.png` (5.4MB) to prevent Next.js from serving it as-is.

### Layout Configuration

#### [MODIFY] [layout.tsx](file:///media/lian/Ubuntu/Siger%20TC/siger-tkd-manager/src/app/layout.tsx)
Update the `metadata` export to use the new optimized icons:

```typescript
  icons: {
    icon: '/favicon.ico',
    apple: '/icon-192x192.png',
    shortcut: '/favicon.ico',
  },
```

## Verification Plan

### Automated Verification
- Run Next.js build check:
  `npm run build` or `npx next info` (to ensure layout compiles successfully).

### Manual Verification
- Check the files exist and verify their dimensions/sizes using `ls -lh public/`.
