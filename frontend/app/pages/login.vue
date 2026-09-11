<template>
  <div class="relative flex min-h-[75vh] items-center justify-center py-10">
    <div class="relative w-full max-w-md">
      <div class="overflow-hidden rounded-3xl border border-stone-200/80 bg-white/90 p-8 shadow-2xl shadow-stone-200/50 backdrop-blur-xl">
        <!-- Logo & Header -->
        <div class="mb-6 text-center">
          <div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-clay-600 text-white shadow-lg">
            <Lock class="h-6 w-6" />
          </div>
          <h1 class="font-display text-2xl font-bold text-stone-900">Admin Portal</h1>
          <p class="mt-1 text-xs text-stone-500">Masuk untuk mengelola katalog, pesanan, dan persetujuan aksi AI</p>
        </div>

        <!-- Form -->
        <form class="space-y-4" @submit.prevent="onLogin">
          <div>
            <label class="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-stone-600">Email Admin</label>
            <Input v-model="email" type="email" placeholder="owner@store.demo" required />
          </div>

          <div>
            <div class="flex items-center justify-between mb-1.5">
              <label class="block text-xs font-semibold uppercase tracking-wider text-stone-600">Password</label>
            </div>
            <Input v-model="password" type="password" placeholder="••••••••" required />
          </div>

          <div v-if="error" class="rounded-xl border border-rose-200 bg-rose-50/80 p-3 text-xs font-medium text-rose-700">
            {{ error }}
          </div>

          <Button type="submit" variant="ai" size="lg" class="w-full font-semibold" :loading="loading">
            Masuk ke Dashboard
          </Button>

          <!-- Quick Fill Demo Account -->
          <div class="mt-4 rounded-2xl border border-stone-200/80 bg-stone-50/80 p-3.5 text-center">
            <p class="text-xs font-medium text-stone-600">Akun Demo Owner (Seed):</p>
            <button
              type="button"
              class="mt-1.5 inline-flex items-center gap-1.5 rounded-lg border border-clay-200 bg-clay-50 px-2.5 py-1 text-xs font-semibold text-clay-700 hover:bg-clay-100 transition-colors cursor-pointer"
              @click="fillDemoOwner"
            >
              <span>owner@store.demo (Isi Otomatis)</span>
            </button>
          </div>
        </form>

        <div class="mt-6 text-center">
          <NuxtLink to="/" class="text-xs font-medium text-stone-500 hover:text-clay-600 transition-colors">
            ← Kembali ke Halaman Toko
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Lock } from '@lucide/vue'
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

