<template>
  <section class="min-w-0 rounded-2xl border border-stone-200 bg-white p-4 sm:p-6" aria-labelledby="admin-account-title">
    <div class="mb-5">
      <h2 id="admin-account-title" class="font-display text-xl font-bold text-brand-900">Akun admin</h2>
      <p class="mt-1 text-sm leading-relaxed text-stone-500">Ubah identitas dan kredensial akun Anda. Nama admin terpisah dari nama pemilik yang ditampilkan di toko.</p>
    </div>
    <form class="space-y-5" novalidate :aria-busy="saving" @submit.prevent="saveAccount">
      <div class="grid min-w-0 gap-5 sm:grid-cols-2">
        <div class="min-w-0">
          <label for="account-name" class="mb-1.5 block text-sm font-semibold text-stone-700">Nama admin</label>
          <Input id="account-name" v-model="name" class="h-11 w-full" autocomplete="name" :disabled="saving" maxlength="100" required :aria-invalid="fieldErrors.name ? true : undefined" aria-describedby="account-name-help" />
          <p id="account-name-help" class="mt-1 text-xs" :class="fieldErrors.name ? 'text-destructive' : 'text-stone-500'">{{ fieldErrors.name || 'Nama yang digunakan di panel admin.' }}</p>
        </div>
        <div class="min-w-0">
          <label for="account-email" class="mb-1.5 block text-sm font-semibold text-stone-700">Email admin</label>
          <Input id="account-email" v-model="email" class="h-11 w-full" type="email" autocomplete="email" autocapitalize="none" :spellcheck="false" :disabled="saving" maxlength="255" required :aria-invalid="fieldErrors.email ? true : undefined" aria-describedby="account-email-help" />
          <p id="account-email-help" class="mt-1 text-xs" :class="fieldErrors.email ? 'text-destructive' : 'text-stone-500'">{{ fieldErrors.email || 'Gunakan alamat email yang dapat Anda akses.' }}</p>
        </div>
      </div>

      <div class="grid min-w-0 gap-5 sm:grid-cols-2">
        <div class="min-w-0">
          <label for="account-new-password" class="mb-1.5 block text-sm font-semibold text-stone-700">Kata sandi baru <span class="font-normal text-stone-500">(opsional)</span></label>
          <div class="relative">
            <Input id="account-new-password" v-model="newPassword" class="h-11 w-full pr-12" :type="showNewPassword ? 'text' : 'password'" autocomplete="new-password" :disabled="saving" :aria-invalid="fieldErrors.password ? true : undefined" aria-describedby="account-new-password-help" />
            <button type="button" class="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-lg text-stone-500 hover:text-brand-800 disabled:opacity-50" :disabled="saving" :aria-label="showNewPassword ? 'Sembunyikan kata sandi baru' : 'Tampilkan kata sandi baru'" :aria-pressed="showNewPassword" aria-controls="account-new-password" @click="showNewPassword = !showNewPassword">
              <EyeOff v-if="showNewPassword" class="h-4 w-4" aria-hidden="true" />
              <Eye v-else class="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <p id="account-new-password-help" class="mt-1 text-xs" :class="fieldErrors.password ? 'text-destructive' : 'text-stone-500'">{{ fieldErrors.password || 'Minimal 12 karakter, maksimal 72 byte UTF-8. Kosongkan jika tidak diubah.' }}</p>
        </div>
        <div class="min-w-0">
          <label for="account-confirm-password" class="mb-1.5 block text-sm font-semibold text-stone-700">Ulangi kata sandi baru</label>
          <Input id="account-confirm-password" v-model="confirmPassword" class="h-11 w-full" :type="showNewPassword ? 'text' : 'password'" autocomplete="new-password" :disabled="saving" :aria-invalid="fieldErrors.confirm ? true : undefined" aria-describedby="account-confirm-password-help" />
          <p id="account-confirm-password-help" class="mt-1 text-xs" :class="fieldErrors.confirm ? 'text-destructive' : 'text-stone-500'">{{ fieldErrors.confirm || 'Isi hanya saat mengganti kata sandi.' }}</p>
        </div>
      </div>

      <div class="max-w-md">
        <label for="account-current-password" class="mb-1.5 block text-sm font-semibold text-stone-700">Kata sandi saat ini</label>
        <div class="relative">
          <Input id="account-current-password" v-model="currentPassword" class="h-11 w-full pr-12" :type="showCurrentPassword ? 'text' : 'password'" autocomplete="current-password" :disabled="saving" :required="changingCredentials" :aria-invalid="fieldErrors.current ? true : undefined" aria-describedby="account-current-password-help" />
          <button type="button" class="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-lg text-stone-500 hover:text-brand-800 disabled:opacity-50" :disabled="saving" :aria-label="showCurrentPassword ? 'Sembunyikan kata sandi saat ini' : 'Tampilkan kata sandi saat ini'" :aria-pressed="showCurrentPassword" aria-controls="account-current-password" @click="showCurrentPassword = !showCurrentPassword">
            <EyeOff v-if="showCurrentPassword" class="h-4 w-4" aria-hidden="true" />
            <Eye v-else class="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <p id="account-current-password-help" class="mt-1 text-xs" :class="fieldErrors.current ? 'text-destructive' : 'text-stone-500'">{{ fieldErrors.current || 'Wajib untuk mengganti email atau kata sandi.' }}</p>
      </div>

      <p class="rounded-lg border border-promo-200 bg-promo-50 px-3 py-2 text-sm leading-relaxed text-brand-900">Setelah perubahan disimpan, sesi lama di semua perangkat dicabut. Anda tetap masuk dengan sesi baru di perangkat ini.</p>
      <p v-if="error" role="alert" class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{{ error }}</p>
      <p v-if="success" role="status" class="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">{{ success }}</p>
      <Button type="submit" variant="ai" class="min-h-11 w-full whitespace-normal sm:w-auto" :loading="saving" :disabled="saving || !hasChanges">{{ saving ? 'Menyimpan akun…' : 'Simpan perubahan akun' }}</Button>
    </form>
  </section>
</template>

<script setup lang="ts">
import { Eye, EyeOff } from '@lucide/vue'
import { toApiError } from '~/composables/useApi'

const auth = useAuthStore()
const name = ref(auth.user?.name || '')
const email = ref(auth.user?.email || '')
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const showNewPassword = ref(false)
const showCurrentPassword = ref(false)
const saving = ref(false)
const submitted = ref(false)
const error = ref('')
const success = ref('')
const normalizedEmail = computed(() => email.value.trim().toLowerCase())
const changingEmail = computed(() => normalizedEmail.value !== auth.user?.email)
const changingCredentials = computed(() => changingEmail.value || !!newPassword.value)
const hasChanges = computed(() => name.value.trim() !== auth.user?.name || changingEmail.value || !!newPassword.value || !!confirmPassword.value)

const fieldErrors = computed(() => {
  if (!submitted.value) return { name: '', email: '', password: '', confirm: '', current: '' }
  return {
    name: !name.value.trim() || name.value.trim().length > 100 ? 'Nama wajib diisi, maksimal 100 karakter.' : '',
    email: normalizedEmail.value.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail.value) ? 'Alamat email tidak valid.' : '',
    password: newPassword.value && (Array.from(newPassword.value).length < 12 || new TextEncoder().encode(newPassword.value).byteLength > 72) ? 'Minimal 12 karakter dan maksimal 72 byte UTF-8.' : '',
    confirm: newPassword.value !== confirmPassword.value ? 'Konfirmasi kata sandi tidak sama.' : '',
    current: changingCredentials.value && !currentPassword.value ? 'Kata sandi saat ini wajib diisi.' : ''
  }
})

watch(() => auth.user, (user) => {
  name.value = user?.name || ''
  email.value = user?.email || ''
})
watch([name, email, currentPassword, newPassword, confirmPassword], () => { error.value = ''; success.value = '' })

function clearPasswords() {
  currentPassword.value = ''
  newPassword.value = ''
  confirmPassword.value = ''
  showNewPassword.value = false
  showCurrentPassword.value = false
}
onBeforeUnmount(clearPasswords)

async function saveAccount() {
  if (saving.value || !hasChanges.value) return
  submitted.value = true
  if (Object.values(fieldErrors.value).some(Boolean)) return
  saving.value = true
  error.value = ''
  success.value = ''
  try {
    await auth.updateAccount({
      ...(name.value.trim() !== auth.user?.name ? { name: name.value.trim() } : {}),
      ...(changingEmail.value ? { email: normalizedEmail.value } : {}),
      ...(newPassword.value ? { new_password: newPassword.value } : {}),
      ...(changingCredentials.value ? { current_password: currentPassword.value } : {})
    })
    clearPasswords()
    submitted.value = false
    await nextTick()
    success.value = 'Akun berhasil diperbarui. Sesi lama telah dicabut.'
  }
  catch (cause) {
    const failure = toApiError(cause)
    if (failure.status === 401) {
      auth.clear()
      await navigateTo('/login')
      return
    }
    error.value = failure.message
  }
  finally { saving.value = false }
}
</script>

<style scoped>
input { font-size: 16px; }
:is(input, button):focus-visible { outline: 2px solid var(--ring); outline-offset: 3px; }
</style>
