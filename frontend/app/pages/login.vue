<template>
  <div class="relative flex min-h-[75vh] items-center justify-center py-10">
    <!-- Ambient Glow behind card -->
    <div class="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 w-96 h-96 bg-gradient-to-tr from-indigo-500/20 via-purple-500/15 to-transparent blur-[90px] rounded-full" />

    <div class="relative w-full max-w-md">
      <div class="overflow-hidden rounded-3xl border border-slate-200/80 bg-white/90 p-8 shadow-2xl shadow-slate-200/50 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-900/90 dark:shadow-none">
        <!-- Logo & Header -->
        <div class="mb-6 text-center">
          <div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/25">
            <svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h1 class="font-display text-2xl font-bold text-slate-900 dark:text-white">Admin Portal</h1>
          <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">Masuk untuk mengelola katalog, pesanan, dan persetujuan aksi AI</p>
        </div>

        <!-- Form -->
        <form class="space-y-4" @submit.prevent="onLogin">
          <div>
            <label class="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">Email Admin</label>
            <ScInput v-model="email" type="email" placeholder="owner@store.demo" required />
          </div>

          <div>
            <div class="flex items-center justify-between mb-1.5">
              <label class="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">Password</label>
            </div>
            <ScInput v-model="password" type="password" placeholder="••••••••" required />
          </div>

          <div v-if="error" class="rounded-xl border border-rose-200 bg-rose-50/80 p-3 text-xs font-medium text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
            {{ error }}
          </div>

          <ScButton type="submit" variant="ai" size="lg" class="w-full font-semibold" :loading="loading">
            Masuk ke Dashboard
          </ScButton>

          <!-- Quick Fill Demo Account -->
          <div class="mt-4 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3.5 text-center dark:border-slate-800 dark:bg-slate-800/50">
            <p class="text-xs font-medium text-slate-600 dark:text-slate-400">Akun Demo Owner (Seed):</p>
            <button
              type="button"
              class="mt-1.5 inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950/50 dark:text-indigo-300 transition-colors cursor-pointer"
              @click="fillDemoOwner"
            >
              <span>owner@store.demo (Isi Otomatis)</span>
            </button>
          </div>
        </form>

        <div class="mt-6 text-center">
          <NuxtLink to="/" class="text-xs font-medium text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition-colors">
            ← Kembali ke Halaman Toko
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
const auth = useAuthStore()
const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

function fillDemoOwner() {
  email.value = 'owner@store.demo'
  password.value = 'owner123'
}

onMounted(() => {
  auth.hydrate()
  if (auth.token && auth.user) navigateTo('/admin')
})

async function onLogin() {
  error.value = ''
  loading.value = true
  try {
    await auth.login(email.value.trim(), password.value)
    await navigateTo('/admin')
  }
  catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Login gagal'
  }
  finally { loading.value = false }
}
</script>

