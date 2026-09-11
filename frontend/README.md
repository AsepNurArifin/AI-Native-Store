# Frontend — AI-Native Store (Nuxt 4)

Admin dashboard + Web Chat Widget (conversational commerce). Frontend di-hosting di
**Vercel** (tanpa container — lihat keputusan di `../plan.md` §B3).

**Stack:** Nuxt 4.5 · Vue 3.5 · Tailwind CSS v4 · **shadcn-vue** (new-york) ·
Pinia · TypeScript · Ikon **`@lucide/vue`**.

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
- **Tema shadcn "Toko Digital"** di `app/assets/css/main.css` — variabel oklch
  `:root` + ramp aksen `clay` (terracotta) di `@theme`. **Light-only** — tidak
  ada dark mode. Sistem desain terkunci di `design.md` (root frontend).
- **Komponen kanonik** di `app/components/ui/` — auto-import Nuxt tanpa prefix
  (`<Button>`, `<Card>`, `<Input>`, `<Badge>`, `<Label>`, `<Textarea>`,
  `<Table>` + sub-komponen, `<Separator>`, `<Skeleton>`).
  Konfigurasi CLI: `components.json` (alias `@/*` → `app/*` sudah sesuai).
- **Ikon lucide** — `@lucide/vue` diimpor eksplisit per komponen. Tidak ada
  SVG inline di halaman kecuali **logo brand** (`app/layouts/*.vue`).

**Menambah komponen shadcn baru** (mis. `select`, `dialog`, `dropdown-menu`):

```bash
npx shadcn-vue@latest add select dialog
```

Komponen berbasis primitif (Select/Dialog/dll.) akan otomatis menginstal
`reka-ui`. Sampai saat ini sengaja **tidak** dipakai agar bundel tetap ringan
(halaman masih memakai `<select>` native).

### Konvensi komponen

- Semua komponen `ui/*.vue` mengimpor helper `cn` dari `~/lib/utils`
  (satu-satunya sumber — `app/utils/cn.ts` sudah dihapus).
- `Button.vue` adalah **superset ScButton** (kompatibel hasil migrasi):
  - variant `ai` (aksen brand terracotta solid, tanpa gradient);
  - `size="md"` = alias `default`; `sm`/`lg` mempertahankan proporsi ScButton;
  - prop `loading` menampilkan spinner `<LoaderCircle>` (lucide) + auto-disable.
  Migrasi `<ScButton>` → `<Button>` **selesai** (37 penggunaan; `ScButton.vue`
  dihapus).
- **Migrasi `Sc*` selesai** — tidak ada lagi wrapper legacy di
  `app/components/ui/`:
  - `<ScButton>` → `<Button>` (37 pemakaian). `Button.vue` adalah superset:
    variant `ai` (aksen brand solid), `size="md"` = alias `default`, dan prop
    `loading` (spinner `<LoaderCircle>` + auto-disable).
  - `<ScCard>` → `<Card>` + `<CardHeader>`/`<CardTitle>`/`<CardContent>`/
    `<CardFooter>` (30 pemakaian). Header/footer kini berupa **sub-komponen**,
    bukan slot bernama. Konsekuensi visual mengikuti kanon shadcn: tanpa garis
    pemisah antar-seksi, padding `px-6`/`py-6`, radius `rounded-xl`.
  - `<ScInput>` → `<Input>` (18 pemakaian) — API identik (`v-model`, `class`,
    atribut native lewat fallthrough).
  - `<ScBadge>` → `<Badge>` (20 pemakaian) — varian shadcn + varian brand
    `success`/`warning`/`info`/`danger`/`neutral`, plus prop opsional `dot`
    (titik indikator berkedip). Helper **`statusVariant()`** di
    `app/utils/format.ts` memetakan status domain → nama varian (menggantikan
    `statusClass()` yang mengembalikan kelas Tailwind).
- **Tema warna "Toko Digital"** (design.md): palet hangat — kertas krem
  (`--background`), charcoal hangat, aksen terracotta (ramp `clay-50`…`clay-950`),
  netral `stone` (pengganti `slate`/`zinc`). Semua kelas warna dingin
  (`slate/indigo/violet/purple/zinc/pink`) dan seluruh variant `dark:` telah
  dihapus dari kode — aplikasi light-only tanpa gradient/neon/glow.

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
