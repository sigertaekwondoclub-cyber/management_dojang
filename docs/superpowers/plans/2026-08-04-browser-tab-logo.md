# Browser Tab Logo Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create web-optimized favicon/icon files from the high-res club logo and configure Next.js layout metadata to load them.

**Architecture:** Use a helper Python script with PIL to resize and convert `public/logo-siger.png` to standard favicon sizes, update `src/app/layout.tsx` metadata config, and delete the redundant 5.4MB icon in `src/app/`.

**Tech Stack:** Next.js, Python (PIL/Pillow).

## Global Constraints

- Optimize the high-resolution logo and configure it properly as the browser tab icon (favicon) to ensure fast load times and correct rendering.

---

### Task 1: Generate Optimized Favicon & Icons

**Files:**
- Create: `scratch/optimize_logo.py`
- Create: `public/favicon.ico` (generated)
- Create: `public/icon-192x192.png` (generated)
- Create: `public/icon-512x512.png` (generated)

**Interfaces:**
- Consumes: `public/logo-siger.png`
- Produces: Web-optimized icon files in `public/`

- [ ] **Step 1: Write python script to optimize and resize the logo**

Create `scratch/optimize_logo.py`:
```python
import os
from PIL import Image

logo_path = "/media/lian/Ubuntu/Siger TC/siger-tkd-manager/public/logo-siger.png"
public_dir = "/media/lian/Ubuntu/Siger TC/siger-tkd-manager/public"

if not os.path.exists(logo_path):
    print("Error: logo-siger.png not found")
    exit(1)

with Image.open(logo_path) as img:
    # Convert to RGBA for transparency support
    img = img.convert("RGBA")
    
    # Save favicon.ico (32x32)
    favicon = img.resize((32, 32), Image.Resampling.LANCZOS)
    favicon.save(os.path.join(public_dir, "favicon.ico"), format="ICO")
    print("Generated favicon.ico")
    
    # Save icon-192x192.png
    icon192 = img.resize((192, 192), Image.Resampling.LANCZOS)
    icon192.save(os.path.join(public_dir, "icon-192x192.png"), format="PNG")
    print("Generated icon-192x192.png")
    
    # Save icon-512x512.png
    icon512 = img.resize((512, 512), Image.Resampling.LANCZOS)
    icon512.save(os.path.join(public_dir, "icon-512x512.png"), format="PNG")
    print("Generated icon-512x512.png")
```

- [ ] **Step 2: Run the script to generate icons**

Run: `python3 "/media/lian/Ubuntu/Siger TC/siger-tkd-manager/scratch/optimize_logo.py"`
Expected: Prints generation status and creates files in `public/`.

- [ ] **Step 3: Verify files exist and are small**

Run: `ls -lh "/media/lian/Ubuntu/Siger TC/siger-tkd-manager/public"`
Expected: See `favicon.ico`, `icon-192x192.png`, and `icon-512x512.png` with small sizes (typically < 100KB each).

- [ ] **Step 4: Commit generated icons & script**

```bash
git add scratch/optimize_logo.py public/favicon.ico public/icon-192x192.png public/icon-512x512.png
git commit -m "feat: add optimized favicons generated from high-res logo"
```

---

### Task 2: Configure Layout Metadata & Cleanup

**Files:**
- Modify: `src/app/layout.tsx`
- Delete: `src/app/icon.png`

**Interfaces:**
- Consumes: Web-optimized files in `public/`
- Produces: Updated Next.js application layout with correct favicon metadata

- [ ] **Step 1: Modify layout.tsx metadata**

Modify `src/app/layout.tsx`:
Replace lines 20-24 (icons mapping):
```typescript
  icons: {
    icon: '/favicon.ico',
    apple: '/icon-192x192.png',
    shortcut: '/favicon.ico',
  },
```

- [ ] **Step 2: Delete the oversized icon in src/app/**

Run: `rm "/media/lian/Ubuntu/Siger TC/siger-tkd-manager/src/app/icon.png"`

- [ ] **Step 3: Verify the application builds successfully**

Run: `npm run build` or `npx next info` (using build command)
Expected: Successfully builds without error.

- [ ] **Step 4: Commit configuration & cleanup changes**

```bash
git rm src/app/icon.png
git add src/app/layout.tsx
git commit -m "chore: configure layout metadata for optimized icons and remove oversized icon"
```
