# Frontend — AI-Native Store (Nuxt 4)

Admin dashboard + Web Chat Widget (conversational commerce). Frontend di-hosting di
**Vercel** (tanpa container — lihat keputusan di `../plan.md` §B3).

**Stack:** Nuxt 4.5 · Vue 3.5 · Tailwind CSS v4 · **shadcn-vue** (new-york) ·
Pinia · TypeScript.

---

## 1. Setup

```bash
npm install          # + postinstall otomatis: nuxt prepare
cp .env.example .env # hanya NUXT_PUBLIC_API_BASE (bukan secret)
npm run dev          # http://localhost:3000
```

| Script | Fungsi |
|---|---|
| `npm run dev` | Dev server + HMR |
| `npm run build` | Build produksi (Nitro output → Vercel) |
| `npm run generate` | Static generate |
| `npm run preview` | Preview hasil build lokal |

---

## 2. UI Stack — shadcn-vue (bukan @nuxt/ui)

Stack UI lama (`@nuxt/ui`, `@nuxt/icon`, `@nuxt/fonts`, `@nuxt/color-mode`)
**dihapus** karena terlalu berat. Penggantinya:

- **Tailwind CSS v4** via plugin `@tailwindcss/vite` di `nuxt.config.ts`
  (plugin ini wajib ada — tanpa itu `@import "tailwindcss"` gagal di build).
- **Tema shadcn** di `app/assets/css/main.css` (variabel oklch `:root`/`.dark`,
  `@theme inline`, `@layer base`) — hasil `shadcn init`, baseColor `neutral`.
- **Komponen kanonik** di `app/components/ui/` — auto-import Nuxt tanpa prefix
  (`<Button>`, `<Card>`, `<Input>`, `<Badge>`, `<Label>`, `<Textarea>`,
  `<Table>` + sub-komponen, `<Separator>`, `<Skeleton>`).
  Konfigurasi CLI: `components.json` (alias `@/*` → `app/*` sudah sesuai).

**Menambah komponen shadcn baru** (mis. `select`, `dialog`, `dropdown-menu`):

```bash
npx shadcn-vue@latest add select dialog
```

Komponen berbasis primitif (Select/Dialog/dll.) akan otomatis menginstal
`reka-ui`. Sampai saat ini sengaja **tidak** dipakai agar bundel tetap ringan
(halaman masih memakai `<select>` native).

### Konvensi komponen

- Semua komponen `ui/*.vue` mengimpor helper `cn` dari `~/lib/utils`
  (shadcn). File `app/utils/cn.ts` adalah duplikat yang dipakai komponen
  legacy `Sc*`.
- `Sc*` (`ScButton`, `ScCard`, `ScInput`, `ScBadge`) adalah **wrapper desain
  legacy** (murni Tailwind, tidak bergantung `@nuxt/ui`) dan masih dipakai
  ±105 tempat di halaman. Migrasi bertahap: ganti `<ScButton>` → `<Button>`
  dst. Varian brand `ai` sudah tersedia sebagai variant Button.
- Dark mode: kelas `.dark` di elemen root (CSS custom-variant `dark:`).
  Toggle UI belum disediakan.

---

## 3. Environment

| Variabel | Wajib | Catatan |
|---|---|---|
| `NUXT_PUBLIC_API_BASE` | ya | `http://localhost:8000/api/v1` default. Di Vercel: set ke URL backend produksi. |

Jangan menaruh secret apa pun di sini — nilai `NUXT_PUBLIC_*` masuk bundle browser.

---

## 4. Deployment (Vercel)

1. Import repo ke Vercel (framework: Nuxt).
2. Environment variable: `NUXT_PUBLIC_API_BASE=https://<backend-prod>/api/v1`.
3. Build command default `npm run build`, output otomatis terdeteksi.
4. Pastikan CORS backend memuat origin domain Vercel.

Verifikasi lokal sebelum deploy: `npm run build` + `npm run preview`.
