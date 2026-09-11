# Design — AI-Native Store (Toko Digital)

Sistem desain terkunci untuk aplikasi ini. Semua perubahan UI membaca file ini
sebelum menulis kode. Jangan regenerasi per halaman — perpanjang/amend file ini
saat sistem perlu berkembang.

## Genre
Playful (soft-retail — hangat, membulat, manusiawi). **Tanpa dark mode, tanpa
neon, tanpa gradient.** Nuansa: toko digital yang ramah, seperti kertas nota
dan rak kayu.

## Palet warna (OKLCH)

### Token semantik (shadcn, dipakai komponen ui/*)
| Token | Nilai | Peran |
|---|---|---|
| `--background` | `oklch(0.982 0.008 85)` | krem hangat (kertas nota) |
| `--foreground` | `oklch(0.26 0.02 55)` | charcoal hangat |
| `--card` | `oklch(0.995 0.004 85)` | kartu putih-krem |
| `--primary` | `oklch(0.62 0.15 42)` | **terracotta** — aksen brand |
| `--primary-foreground` | `oklch(0.99 0.005 85)` | teks di atas primary |
| `--secondary` | `oklch(0.955 0.012 75)` | latar sekunder |
| `--muted` | `oklch(0.95 0.012 75)` | latar redup |
| `--muted-foreground` | `oklch(0.5 0.025 60)` | teks sekunder |
| `--accent` | `oklch(0.945 0.018 65)` | hover lembut (peach) |
| `--destructive` | `oklch(0.55 0.19 27)` | merah bata |
| `--border` | `oklch(0.905 0.015 75)` | garis pemisah |
| `--ring` | `oklch(0.68 0.13 45)` | focus ring terracotta |
| `--radius` | `0.75rem` | sudut membulat ramah |

### Ramp aksen `clay` (terracotta — pengganti indigo/violet/purple)
Didefinisikan di `@theme` main.css: `clay-50` … `clay-950`.
`clay-600` = warna CTA utama; `clay-100`/`clay-700` = pasangan badge info.

### Netral hangat
Pakai ramp **`stone`** bawaan Tailwind (pengganti `slate`/`zinc` yang dingin).

### Status (tetap)
- success: `emerald` · warning: `amber` · danger: `red`/`rose` · info: `clay`

## Tipografi
- Display: **Outfit** 600–800 (roman, tidak pernah italic)
- Body: **Plus Jakarta Sans** 400–700
- Mono: default sistem
- Dimuat via Google Fonts di `nuxt.config.ts`

## Spacing & bentuk
- Skala 4pt Tailwind default.
- Radius: kartu `rounded-xl`, tombol `rounded-lg`–`rounded-xl`, pill `rounded-full`.

## Motion
- Motion-cut: transisi warna/transform ≤ 200ms, `ease-out`.
- **Tanpa glow, tanpa gradient, tanpa pulse-glow.** Titik status boleh `animate-pulse` bawaan.
- `prefers-reduced-motion: reduce` dihormati Tailwind.

## CTA voice
- Primary: solid `clay-600` (atau `bg-primary`), teks putih, `shadow-sm`.
- Secondary: outline `border-stone-300` + hover `accent`.
- Tidak ada tombol gradient.

## Aturan wajib semua halaman
- **Tidak ada `dark:` variant** — aplikasi light-only.
- **Tidak ada kelas warna dingin** (`slate-*`, `indigo-*`, `violet-*`, `purple-*`, `zinc-*`, `pink-*`).
- Aksen terracotta ≤ 5% area viewport.
- Logo/brand tile: solid `clay-600`, tanpa gradient.
- Ambient glow/blurred gradient orb: **dilarang**.

## Eksport
Token lengkap ada di `app/assets/css/main.css` (`:root` + `@theme`).
