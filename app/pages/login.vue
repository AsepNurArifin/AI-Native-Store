<template>
  <div class="login-shell min-h-screen overflow-x-clip bg-stone-50 text-stone-900">
    <div class="grid min-h-screen grid-cols-1 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
      <!-- Same navy and gold identity as the customer storefront. -->
      <section class="login-identity enter flex min-w-0 flex-col gap-3 bg-brand-900 px-6 py-6 text-white max-[320px]:px-4 lg:justify-between lg:gap-10 lg:px-12 lg:py-10">
        <div class="flex items-center gap-3">
          <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-white p-1 shadow-md">
            <img src="/logo.jpeg" :alt="`${settings.store_name} Logo`" class="h-full w-full rounded-lg object-contain" >
          </div>
          <div class="min-w-0">
            <span class="font-display break-words text-lg font-bold tracking-tight text-promo-300">{{ settings.store_name }}</span>
            <p class="text-[11px] font-medium text-white/60">Panel pemilik toko</p>
          </div>
        </div>

        <div class="max-w-xl">
          <h1 class="font-display text-2xl font-bold leading-tight tracking-tight [overflow-wrap:anywhere] lg:text-5xl lg:leading-[1.02] xl:text-6xl">
            <span class="lg:hidden">Akses pemilik &amp; staf</span>
            <span class="hidden lg:inline">Satu toko.<br>Satu ruang kendali.</span>
          </h1>
          <p class="mt-2 text-sm leading-relaxed text-white/70 lg:hidden">Kelola katalog, stok, dan pesanan toko.</p>
          <p class="mt-5 hidden max-w-md text-base leading-relaxed text-white/70 lg:block">
            Katalog, stok, pesanan, promosi, dan persetujuan aksi AI — semua dikelola dari satu meja.
            Halaman toko untuk pelanggan; halaman ini untuk Anda.
          </p>
        </div>

        <div class="login-access-card">
          <ShieldCheck class="h-8 w-8 text-promo-300" aria-hidden="true" />
          <div>
            <p class="login-eyebrow">Akses operator</p>
            <p class="font-display text-xl font-semibold text-white">Pemilik &amp; staf</p>
            <p class="mt-2 text-xs leading-relaxed text-brand-200">Aktivitas penting tercatat di audit trail. Jaga akun Anda dan jangan bagikan kredensial.</p>
          </div>
        </div>
      </section>

      <section class="login-form-section enter enter-delay flex min-w-0 items-center border-stone-200 px-6 py-6 max-[320px]:px-4 lg:border-l lg:px-10 lg:py-10 xl:px-14">
        <form class="login-form w-full min-w-0" novalidate :aria-busy="loading || restoring" @submit.prevent="onLogin">
          <p class="login-eyebrow break-words">{{ settings.store_name }} · Ruang kerja</p>
          <h2 class="font-display text-3xl font-bold tracking-tight">Masuk</h2>
          <p class="mt-1.5 text-sm text-stone-500">Email dan kata sandi pemilik atau staf.</p>

          <p v-if="restoring" role="status" class="mt-5 rounded-lg border-l-2 border-brand-700 bg-brand-50 px-3 py-2 text-sm text-brand-700">
            Memulihkan sesi Anda…
          </p>

          <p v-if="loginError" role="alert" class="mt-5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{{ loginError }}</p>

          <div class="mt-6 space-y-5">
            <div>
              <label for="email" class="mb-1.5 block text-sm font-semibold text-stone-700">Email</label>
              <Input
                id="email"
                v-model="email"
                class="login-field h-11 rounded-lg border-stone-300 bg-white pr-9"
                type="email"
                name="email"
                autocomplete="email"
                placeholder="nama@toko.com"
                required
                :disabled="loading || restoring"
                autocapitalize="none"
                :spellcheck="false"
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
              <label for="password" class="mb-1.5 block text-sm font-semibold text-stone-700">Kata sandi</label>
              <div class="relative">
                <Input
                  id="password"
                  v-model="password"
                  class="login-field h-11 rounded-lg border-stone-300 bg-white pr-12"
                  :type="showPass ? 'text' : 'password'"
                  name="password"
                  autocomplete="current-password"
                  placeholder="••••••••"
                  required
                  :disabled="loading || restoring"
                  aria-required="true"
                  :aria-invalid="passError ? true : undefined"
                  aria-describedby="password-help"
                  @blur="passTouched = true"
                />
                <button
                  type="button"
                  class="absolute inset-y-0 right-0 flex min-h-11 w-12 items-center justify-center rounded-lg text-stone-500 transition-colors duration-150 hover:text-stone-800 active:text-stone-950 disabled:opacity-50"
                  :aria-label="showPass ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'"
                  :aria-pressed="showPass"
                  :disabled="loading || restoring"
                  aria-controls="password"
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
                {{ passError || 'Jaga kerahasiaan kata sandi akun Anda.' }}
              </p>
            </div>
          </div>

          <Button
            type="submit"
            variant="ai"
            class="mt-6 min-h-11 w-full rounded-lg font-semibold max-[320px]:h-auto max-[320px]:whitespace-normal max-[320px]:px-2"
            :loading="loading"
            :disabled="loading || restoring"
          >
            {{ loading ? 'Sedang masuk…' : 'Masuk ke Dasbor' }}
          </Button>


          <NuxtLink
            to="/"
            class="mt-6 inline-flex min-h-11 items-center text-sm font-medium text-stone-600 transition-colors duration-150 hover:text-brand-700"
          >
            ← Kembali ke Halaman Toko
          </NuxtLink>
        </form>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Eye, EyeOff, ShieldCheck } from '@lucide/vue'
import { toApiError } from '~/composables/useApi'

definePageMeta({ layout: false })
// Halaman internal: jangan diindeks.
useHead({ meta: [{ name: 'robots', content: 'noindex, nofollow' }] })
const { settings } = await useStoreSettings()
useSeoMeta({ title: () => `Masuk Admin: ${settings.value.store_name}` })
const auth = useAuthStore()
const route = useRoute()
const toast = useToast()
const email = ref('')
const password = ref('')
const loading = ref(false)
const showPass = ref(false)
const restoring = ref(false)
const loginError = ref('')
watch([email, password], () => { loginError.value = '' })

// Validasi pola "touched": dicek saat blur, dihitung ulang otomatis saat diketik.
const emailTouched = ref(false)
const passTouched = ref(false)
const emailError = computed(() => {
  if (!emailTouched.value) return ''
  const v = email.value.trim()
  if (!v) return 'Email wajib diisi.'
  if (v.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Format email belum benar, contoh: nama@toko.com.'
  return ''
})
const passError = computed(() => {
  if (!passTouched.value) return ''
  return password.value ? '' : 'Kata sandi wajib diisi.'
})

/** Tujuan setelah login: halaman asal (bila di-redirect dari admin) atau /admin. */
function targetAfterLogin() {
  const redirect = route.query.redirect
  return typeof redirect === 'string' && redirect.startsWith('/admin') ? redirect : '/admin'
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
      toast.info('Sesi masih aktif. Membuka dashboard…')
      await navigateTo(targetAfterLogin())
      return
    }
  }
})

async function onLogin() {
  if (loading.value || restoring.value) return
  emailTouched.value = true
  passTouched.value = true
  if (emailError.value || passError.value) return
  loading.value = true
  loginError.value = ''
  try {
    await auth.login(email.value.trim(), password.value)
    password.value = ''
    toast.success('Tersambung. Membuka dashboard…')
    await navigateTo(targetAfterLogin())
  }
  catch (e: unknown) {
    // 401 = kredensial salah; error lain cukup tampilkan pesan server apa adanya
    // (toApiError sudah membersihkan salam mentah ofetch, mis. 429 rate limit).
    const err = toApiError(e)
    loginError.value = err.status === 401 ? 'Email atau kata sandi salah. Periksa lalu coba lagi.' : err.message
  }
  finally { loading.value = false }
}
</script>

<style scoped>
.login-shell {
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
}
.login-identity {
  position: relative;
  background: radial-gradient(ellipse at 85% 75%, #29476280, transparent 65%), var(--color-brand-900);
}
.login-identity h1 { color: white; }
.login-access-card {
  display: flex;
  gap: 18px;
  align-items: flex-start;
  padding: 24px;
  border: 1px solid var(--color-brand-600);
  border-radius: 14px;
  background: #06111f45;
  max-width: 430px;
}
.login-access-card > svg { flex: none; }
.login-eyebrow {
  color: var(--color-promo-700);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .12em;
  text-transform: uppercase;
  margin-bottom: 9px;
}
.login-access-card .login-eyebrow { color: var(--color-promo-300); }
.login-form-section { justify-content: center; }
.login-form {
  background: white;
  border: 1px solid var(--border);
  border-radius: 16px;
  box-shadow: 0 12px 40px #091a2d08;
  padding: 28px;
  max-width: 440px;
}
.login-shell :is(a, button, input):focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 3px;
}
.login-identity :is(a, button):focus-visible { outline-color: var(--color-promo-300); }
@media (max-width: 1023px) {
  .login-access-card { display: none; }
  .login-form { padding: 20px; }
  .login-form-section { align-items: flex-start; }
  .login-shell input { font-size: 16px; }
}
@media (max-width: 359px) {
  .login-form { padding: 16px; }
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
