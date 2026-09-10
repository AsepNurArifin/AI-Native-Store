<template>
  <div class="mx-auto max-w-sm py-16">
    <ScCard>
      <template #header>
        <h1 class="text-lg font-bold">Login Admin</h1>
        <p class="text-sm text-slate-500">Staff / Owner toko</p>
      </template>
      <form class="space-y-3" @submit.prevent="onLogin">
        <div>
          <label class="mb-1 block text-sm font-medium">Email</label>
          <ScInput v-model="email" type="email" placeholder="owner@store.demo" />
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium">Password</label>
          <ScInput v-model="password" type="password" placeholder="••••••••" />
        </div>
        <p v-if="error" class="rounded bg-red-50 p-2 text-sm text-red-700">{{ error }}</p>
        <ScButton type="submit" class="w-full" :loading="loading">Masuk</ScButton>
        <p class="text-xs text-slate-500">Akun seed: <code>owner@store.demo</code> / <code>owner123</code>, <code>staff@store.demo</code> / <code>staff123</code>.</p>
      </form>
    </ScCard>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
const auth = useAuthStore()
const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

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
