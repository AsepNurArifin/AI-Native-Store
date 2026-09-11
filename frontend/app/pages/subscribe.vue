<script setup lang="ts">
/*
 * Halaman subscribe — funnel mock (Fase 2 PLAN_PRODUCT_LAUNCH.md).
 * Billing disimulasikan: submit → state sukses client-side.
 * Endpoint backend + rate-limit menyusul di Fase 2.
 * Hallmark · genre: playful · design-system: design.md
 * pre-emit critique: P4 H5 E5 S4 R5 V4
 */
definePageMeta({ layout: 'default' })
useHead({ title: 'Mulai Berlangganan — AI-Native Store' })

const plans = [
  { id: 'trial', name: 'Coba 14 Hari', price: 'Gratis', note: 'Tanpa kartu kredit' },
  { id: 'monthly', name: 'Toko — Bulanan', price: 'Rp79.000', note: 'per bulan' },
  { id: 'yearly', name: 'Toko — Tahunan', price: 'Rp790.000', note: 'hemat 2 bulan' }
] as const

const form = reactive({
  storeName: '',
  ownerName: '',
  contact: '',
  plan: 'trial' as (typeof plans)[number]['id']
})

const submitted = ref(false)
const submitting = ref(false)
const serverError = ref('')
const errors = reactive<{ storeName?: string; ownerName?: string; contact?: string }>({})

function validate(): boolean {
  errors.storeName = form.storeName.trim().length < 2 ? 'Nama toko minimal 2 karakter' : undefined
  errors.ownerName = form.ownerName.trim().length < 2 ? 'Nama pemilik minimal 2 karakter' : undefined
  const c = form.contact.trim()
  errors.contact = !c
    ? 'Isi email atau nomor WhatsApp agar kami bisa menghubungi Anda'
    : (!c.includes('@') && !/^(\+62|62|0)8\d{7,12}$/.test(c.replace(/[\s-]/g, '')))
        ? 'Format email atau nomor WA belum benar (contoh: 0812xxxxxxx)'
        : undefined
  return !errors.storeName && !errors.ownerName && !errors.contact
}

async function submit() {
  if (!validate()) return
  submitting.value = true
  serverError.value = ''
  try {
    // Fase 2: endpoint publik (rate-limited di sisi backend, 5/menit/IP).
    const api = useApi()
    await api.request('/subscriptions', {
      method: 'POST',
      auth: false,
      body: {
        store_name: form.storeName.trim(),
        owner_name: form.ownerName.trim(),
        contact: form.contact.trim(),
        plan: form.plan
      }
    })
    submitted.value = true
    window.scrollTo({ top: 0, behavior: 'smooth' })
  } catch (e: unknown) {
    const parsed = toApiError(e)
    serverError.value = parsed.status === 429
      ? 'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.'
      : parsed.message || 'Gagal mengirim pendaftaran. Coba lagi.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-2xl space-y-8 py-8 sm:py-12">
    <!-- ====== STATE: SUKSES ====== -->
    <div v-if="submitted" class="space-y-6 text-center">
      <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-2xl font-bold text-emerald-600">
        ✓
      </div>
      <div class="space-y-3">
        <h1 class="font-display text-3xl font-extrabold tracking-tight text-stone-900" style="overflow-wrap: anywhere; min-width: 0;">
          Terima kasih, {{ form.ownerName.split(' ')[0] }}!
        </h1>
        <p class="mx-auto max-w-md text-sm leading-relaxed text-stone-600 sm:text-base">
          Pendaftaran toko <span class="font-semibold text-stone-800">“{{ form.storeName }}”</span>
          sudah kami terima. Tim kami akan menghubungi Anda di
          <span class="font-semibold text-stone-800">{{ form.contact }}</span> untuk menyiapkan
          panel admin &amp; webchat toko Anda.
        </p>
        <p class="mx-auto max-w-md text-xs leading-relaxed text-stone-400">
          Catatan: ini demo — pembayaran &amp; provisioning otomatis masih dalam
          pengembangan, sehingga aktivasi dilakukan manual oleh tim.
        </p>
      </div>
      <div class="flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Button variant="outline" to="/chat">Lihat Demo Toko</Button>
        <Button variant="ghost" to="/">Kembali ke Beranda</Button>
      </div>
    </div>

    <!-- ====== STATE: FORM ====== -->
    <template v-else>
      <div class="space-y-3 text-center">
        <div class="inline-flex items-center gap-2 rounded-full border border-clay-200/60 bg-clay-50/70 px-3 py-1 text-xs font-semibold text-clay-700">
          <span class="h-2 w-2 rounded-full bg-clay-500 animate-pulse" />
          Pendaftaran
        </div>
        <h1 class="font-display text-3xl font-extrabold tracking-tight text-stone-900 sm:text-4xl" style="overflow-wrap: anywhere; min-width: 0;">
          Siapkan tokomu sekarang
        </h1>
        <p class="mx-auto max-w-md text-sm leading-relaxed text-stone-600 sm:text-base">
          Isi data di bawah — tidak perlu kartu kredit untuk paket coba.
          Batalkan kapan saja.
        </p>
      </div>

      <form class="space-y-5" novalidate @submit.prevent="submit">
        <p v-if="serverError" class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {{ serverError }}
        </p>
        <Card class="border-stone-200/70">
          <CardContent class="space-y-5 pt-6">
            <!-- Nama toko -->
            <div class="space-y-1.5">
              <Label for="storeName">Nama toko Anda</Label>
              <Input
                id="storeName"
                v-model="form.storeName"
                placeholder="cth. Toko Bu Ratna"
                :aria-invalid="!!errors.storeName"
              />
              <p v-if="errors.storeName" class="text-xs text-red-500">{{ errors.storeName }}</p>
            </div>

            <!-- Nama pemilik -->
            <div class="space-y-1.5">
              <Label for="ownerName">Nama pemilik</Label>
              <Input
                id="ownerName"
                v-model="form.ownerName"
                placeholder="cth. Ratna"
                :aria-invalid="!!errors.ownerName"
              />
              <p v-if="errors.ownerName" class="text-xs text-red-500">{{ errors.ownerName }}</p>
            </div>

            <!-- Kontak -->
            <div class="space-y-1.5">
              <Label for="contact">Email atau nomor WhatsApp</Label>
              <Input
                id="contact"
                v-model="form.contact"
                placeholder="cth. ratna@email.com atau 0812xxxxxxx"
                :aria-invalid="!!errors.contact"
              />
              <p v-if="errors.contact" class="text-xs text-red-500">{{ errors.contact }}</p>
              <p v-else class="text-xs text-stone-400">Untuk konfirmasi aktivasi toko Anda.</p>
            </div>

            <!-- Paket -->
            <div class="space-y-2">
              <Label>Pilih paket</Label>
              <div class="grid gap-3 sm:grid-cols-3">
                <button
                  v-for="plan in plans"
                  :key="plan.id"
                  type="button"
                  class="rounded-xl border p-4 text-left transition-all"
                  :class="form.plan === plan.id
                    ? 'border-clay-400 bg-clay-50/70 ring-2 ring-clay-200'
                    : 'border-stone-200/80 bg-white/70 hover:border-stone-300'"
                  @click="form.plan = plan.id"
                >
                  <p class="text-sm font-semibold text-stone-800">{{ plan.name }}</p>
                  <p class="mt-1 font-display text-lg font-bold" :class="form.plan === plan.id ? 'text-clay-600' : 'text-stone-900'">{{ plan.price }}</p>
                  <p class="text-xs text-stone-500">{{ plan.note }}</p>
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Button
          type="submit"
          size="lg"
          class="w-full bg-clay-600 hover:bg-clay-500"
          :disabled="submitting"
        >
          <span v-if="submitting">Memproses…</span>
          <span v-else>{{ form.plan === 'trial' ? 'Mulai Trial Gratis' : 'Berlangganan' }}</span>
        </Button>

        <p class="text-center text-xs text-stone-400">
          Dengan mendaftar, Anda menyetujui penggunaan data toko Anda sesuai
          ketentuan layanan. Pembayaran diproses dengan aman.
        </p>
      </form>
    </template>
  </div>
</template>
