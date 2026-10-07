<template>
  <div class="login-shell min-h-screen overflow-x-clip bg-stone-50 text-stone-900">
    <div class="grid min-h-screen md:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
      <!-- Panel identitas: navy penuh, tipografi besar, price tag sebagai jangkar -->
      <section class="enter flex flex-col justify-between gap-10 bg-bby-dark px-6 py-8 text-white md:px-12 md:py-10">
        <div class="flex items-center gap-3">
          <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-white p-1 shadow-md">
            <img src="/logo.jpeg" alt="SHAF STORE Logo" class="h-full w-full object-contain rounded-lg" />
          </div>
          <div>
            <span class="font-display text-lg font-bold tracking-tight text-white">SHAF <span class="text-bby-yellow">STORE</span></span>
            <p class="text-[11px] font-medium text-white/60">Panel pemilik toko</p>
          </div>
        </div>

        <div class="max-w-xl">
          <h1 class="font-display text-4xl font-bold leading-[1.02] tracking-tight [overflow-wrap:anywhere] sm:text-5xl lg:text-6xl">
            Meja pemilik, bukan etalase.
          </h1>
          <p class="mt-5 max-w-md text-sm leading-relaxed text-white/70 md:text-base">
            Katalog, stok, pesanan, promosi, dan persetujuan aksi AI — semua dikelola dari satu meja.
            Halaman toko untuk pelanggan; halaman ini untuk Anda.
          </p>
        </div>

        <div class="flex flex-wrap items-end justify-between gap-6">
          <!-- Price tag: motif Yellow Tag, murni CSS (bukan gambar) -->
          <div class="price-tag relative rotate-[-2deg] bg-bby-yellow text-stone-900 shadow-lg shadow-black/20">
            <span class="tag-hole absolute" aria-hidden="true" />
            <div class="flex items-center gap-5 py-4 pl-12 pr-5">
              <div>
                <p class="text-[10px] font-bold uppercase tracking-[0.22em]">Akses terbatas</p>
                <p class="whitespace-nowrap font-display text-xl font-bold leading-tight">Pemilik &amp; Staf</p>
              </div>
              <svg class="hidden h-9 w-16 shrink-0 min-[360px]:block" viewBox="0 0 64 36" aria-hidden="true">
                <g fill="currentColor">
                  <rect x="0" y="0" width="3" height="36" /><rect x="6" y="0" width="1.5" height="36" />
                  <rect x="11" y="0" width="4" height="36" /><rect x="18" y="0" width="1.5" height="36" />
                  <rect x="23" y="0" width="2.5" height="36" /><rect x="29" y="0" width="1" height="36" />
                  <rect x="33" y="0" width="3.5" height="36" /><rect x="40" y="0" width="1.5" height="36" />
                  <rect x="45" y="0" width="2" height="36" /><rect x="51" y="0" width="4" height="36" />
                  <rect x="58" y="0" width="1.5" height="36" /><rect x="62" y="0" width="2" height="36" />
                </g>
              </svg>
            </div>
          </div>
          <p class="max-w-[15rem] text-xs leading-relaxed text-white/50">
            Aktivitas penting tercatat di audit trail. Jangan bagikan kredensial.
          </p>
        </div>
      </section>

      <!-- Form: langsung di kanvas, geometri slab, tanpa kartu melayang -->
      <section class="enter enter-delay flex items-center border-stone-200 px-6 py-10 md:border-l md:px-14">
        <form class="w-full max-w-sm" novalidate @submit.prevent="onLogin">
          <h2 class="font-display text-3xl font-bold tracking-tight">Masuk</h2>
          <p class="mt-1.5 text-sm text-stone-500">Email dan password pemilik atau staf.</p>

          <p v-if="restoring" class="mt-5 border-l-2 border-bby-blue bg-brand-50 px-3 py-2 text-sm text-brand-700">
            Memulihkan sesi Anda…
          </p>

          <div class="mt-6 space-y-5">
            <div>
              <label for="email" class="mb-1.5 block text-sm font-semibold text-stone-700">Email</label>
              <Input
                id="email"
                v-model="email"
                class="login-field h-11 rounded-none border-stone-300 bg-white pr-9"
                type="email"
                name="email"
                autocomplete="email"
                placeholder="nama@toko.com"
                required
                aria-required="true"
                :aria-invalid="emailError ? true : undefined"
                aria-describedby="email-help"
                @blur="emailTouched = true"
              />
              <p
                id="email-help"
                class="mt-1 min-h-[1lh] text-xs"
                :class="emailError ? 'font-medium text-destructive' : 'text-stone-500'"
              >
                {{ emailError || 'Alamat email akun yang terdaftar di toko ini.' }}
              </p>
            </div>

            <div>
              <label for="password" class="mb-1.5 block text-sm font-semibold text-stone-700">Password</label>
              <div class="relative">
                <Input
                  id="password"
                  v-model="password"
                  class="login-field h-11 rounded-none border-stone-300 bg-white pr-12"
                  :type="showPass ? 'text' : 'password'"
                  name="password"
                  autocomplete="current-password"
                  placeholder="••••••••"
                  required
                  aria-required="true"
                  :aria-invalid="passError ? true : undefined"
                  aria-describedby="password-help"
                  @blur="passTouched = true"
                />
                <button
                  type="button"
                  class="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-stone-500 transition-colors duration-150 hover:text-stone-800 active:text-stone-950 disabled:opacity-50"
                  :aria-label="showPass ? 'Sembunyikan password' : 'Tampilkan password'"
                  :aria-pressed="showPass"
                  @click="showPass = !showPass"
                >
                  <EyeOff v-if="showPass" class="h-4 w-4" aria-hidden="true" />
                  <Eye v-else class="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <p
                id="password-help"
                class="mt-1 min-h-[1lh] text-xs"
                :class="passError ? 'font-medium text-destructive' : 'text-stone-500'"
              >
                {{ passError || 'Password bersifat rahasia; kami tidak pernah menampilkannya kembali.' }}
              </p>
            </div>
          </div>

          <div
            v-if="error"
            class="mt-5 flex items-start gap-2 border-l-2 border-destructive bg-white px-3 py-2.5 text-sm font-medium text-destructive"
            role="alert"
          >
            <TriangleAlert class="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{{ error }}</span>
          </div>
          <div
            v-if="okMsg"
            class="mt-5 flex items-start gap-2 border-l-2 border-brand-700 bg-brand-50 px-3 py-2.5 text-sm font-medium text-brand-700"
            role="status"
            aria-live="polite"
          >
            <Check class="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{{ okMsg }}</span>
          </div>

          <Button
            type="submit"
            variant="ai"
            class="mt-6 h-11 w-full rounded-none font-semibold"
            :loading="loading"
          >
            Masuk ke Dashboard
          </Button>

          <div class="mt-6 border border-dashed border-stone-300 bg-white/60 px-4 py-3">
            <p class="text-xs font-medium text-stone-600">Akun demo seed untuk presentasi:</p>
            <p class="mt-0.5 text-xs text-stone-500">owner@store.demo · password seed backend</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              class="mt-2 rounded-none"
              @click="fillDemoOwner"
            >
              Isi otomatis
            </Button>
          </div>

          <NuxtLink
            to="/"
            class="mt-6 inline-block text-sm font-medium text-stone-500 transition-colors duration-150 hover:text-brand-700"
          >
            ← Kembali ke Halaman Toko
          </NuxtLink>
        </form>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Check, Eye, EyeOff, TriangleAlert } from '@lucide/vue'

definePageMeta({ layout: false })
// Halaman internal: jangan diindeks.
useHead({ meta: [{ name: 'robots', content: 'noindex, nofollow' }] })
useSeoMeta({ title: 'Masuk Admin: SHAF STORE' })
const auth = useAuthStore()
const route = useRoute()
const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)
const showPass = ref(false)
const okMsg = ref('')
const restoring = ref(false)

// Validasi pola "touched": dicek saat blur, dihitung ulang otomatis saat diketik.
const emailTouched = ref(false)
const passTouched = ref(false)
const emailError = computed(() => {
  if (!emailTouched.value) return ''
  const v = email.value.trim()
  if (!v) return 'Email wajib diisi — tanpa email kami tidak bisa memverifikasi akun.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Format email belum benar — contoh: nama@toko.com.'
  return ''
})
const passError = computed(() => {
  if (!passTouched.value) return ''
  return password.value ? '' : 'Password wajib diisi — itulah kunci masuk akun ini.'
})

/** Tujuan setelah login: halaman asal (bila di-redirect dari admin) atau /admin. */
function targetAfterLogin() {
  const redirect = route.query.redirect
  return typeof redirect === 'string' && redirect.startsWith('/admin') ? redirect : '/admin'
}

function fillDemoOwner() {
  // Kredensial seed backend (SEED_OWNER_EMAIL / SEED_DEFAULT_PASSWORD di backend/.env)
  email.value = 'owner@store.demo'
  password.value = 'ChangeMe123!'
  emailTouched.value = false
  passTouched.value = false
}

onMounted(async () => {
  auth.hydrate()
  // Pemulihan sesi: full reload di halaman admin me-redirect ke sini sebelum
  // hydrate client jalan. Bila token masih valid, kembalikan user ke tujuan asal.
  if (auth.token) {
    restoring.value = true
    const me = await auth.fetchMe()
    restoring.value = false
    if (me) {
      okMsg.value = 'Sesi masih aktif. Membuka dashboard…'
      await navigateTo(targetAfterLogin())
      return
    }
  }
})

async function onLogin() {
  error.value = ''
  okMsg.value = ''
  emailTouched.value = true
  passTouched.value = true
  if (emailError.value || passError.value) return
  loading.value = true
  try {
    await auth.login(email.value.trim(), password.value)
    okMsg.value = 'Tersambung. Membuka dashboard…'
    await navigateTo(targetAfterLogin())
  }
  catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Login gagal'
    // Salam API terasa mentah; 401 = kredensial salah, sisanya bersihkan prefiks [METHOD].
    error.value = msg.includes('401')
      ? 'Email atau password salah — periksa lalu coba lagi.'
      : msg.replace(/^\[(?:POST|GET)\] "[^"]+":\s*/, '')
  }
  finally { loading.value = false }
}
</script>

<style scoped>
/* Hallmark · macrostructure: Split Studio (diptych) · theme: Best Buy Marketplace (token terkunci main.css)
 * nav: none · footer: none (permintaan eksplisit) · enrichment: Tier A CSS price-tag + barcode
 * motion: entrance-rise (one-shot) · button-press — 2 primitif · focus ring instan
 * states: default · hover · focus · active · disabled · loading · error · success
 * Hallmark · pre-emit critique: P4 H5 E4 S5 R5 V4
 * Token: warna & font hanya dari tema terkunci (main.css) lewat utility Tailwind.
 */
.login-shell {
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
}

/* Price tag: segi lima ujung kiri + lubang tali (CSS art). */
.price-tag {
  clip-path: polygon(0 50%, 20px 0, 100% 0, 100% 100%, 20px 100%);
}
.tag-hole {
  left: 26px;
  top: 50%;
  height: 12px;
  width: 12px;
  border-radius: 9999px;
  background-color: var(--color-bby-dark);
  transform: translateY(-50%);
}

/* Input: lebar border konstan antar state (tanpa layout shift); hover hanya pointer halus. */
.login-field {
  transition: color 150ms var(--ease-out), background-color 150ms var(--ease-out);
}
@media (hover: hover) {
  .login-field:hover {
    background-color: var(--color-stone-100);
  }
}

/* Entrance: satu orkestrasi one-shot, lalu konten diam. */
@keyframes enter-rise {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
}
.enter {
  animation: enter-rise 480ms var(--ease-out) both;
}
.enter-delay {
  animation-delay: 90ms;
}
@media (prefers-reduced-motion: reduce) {
  .enter {
    animation: none;
  }
}
</style>
