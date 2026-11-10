<script setup lang="ts">
import { ImagePlus, Settings } from '@lucide/vue'
import type { StoreSettingsOut } from '~/composables/useStoreSettings'

definePageMeta({ layout: 'admin', middleware: ['auth', 'owner'] })
const { settings, error: loadError, refresh } = await useStoreSettings()
const { request } = useApi()
const toast = useToast()
const form = reactive({ store_name: '', owner_name: '', qris_merchant_name: '', qris_image_url: '' })
const saving = ref(false)
const uploading = ref(false)
const saveError = ref('')
const uploadError = ref('')
const previewFailed = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
watch(settings, value => Object.assign(form, { ...value, qris_image_url: value.qris_image_url || '' }), { immediate: true })
watch(() => form.qris_image_url, () => { previewFailed.value = false })
useSeoMeta({ title: () => `Pengaturan — ${settings.value.store_name}` })

async function upload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || uploading.value || saving.value) return
  uploadError.value = ''
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) {
    uploadError.value = 'Gunakan JPG, PNG atau WebP maksimal 2 MB.'
    return
  }
  uploading.value = true
  try {
    const body = new FormData()
    body.append('file', file)
    const result = await request<{ image_url: string }>('/uploads/images', { method: 'POST', body })
    form.qris_image_url = result.image_url
  }
  catch (error) { uploadError.value = error instanceof Error ? error.message : 'Unggah QRIS gagal.' }
  finally { uploading.value = false }
}
async function save() {
  if (saving.value || uploading.value || loadError.value) return
  saveError.value = ''
  saving.value = true
  try {
    const result = await request<StoreSettingsOut>('/settings', { method: 'PATCH', body: { ...form, qris_image_url: form.qris_image_url.trim() || null } })
    settings.value = result
    toast.success('Pengaturan toko disimpan.')
  }
  catch (error) { saveError.value = error instanceof Error ? error.message : 'Pengaturan gagal disimpan.' }
  finally { saving.value = false }
}
</script>

<template>
  <div class="space-y-6">
    <header><h1 class="flex items-center gap-2 text-2xl font-bold"><Settings aria-hidden="true" class="size-6" /> Pengaturan toko</h1><p class="mt-2 text-sm text-muted-foreground">Kelola identitas toko, QRIS resmi, dan akun admin tanpa mengubah file environment.</p></header>
    <div v-if="loadError" role="alert" class="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><p>Pengaturan belum bisa dimuat. Jangan simpan sebelum data tersedia.</p><Button variant="outline" class="mt-3" @click="refresh()">Muat ulang</Button></div>
    <Card>
      <CardHeader><CardTitle>Identitas &amp; pembayaran</CardTitle><CardDescription>Nama ini tampil di etalase dan panel admin. QRIS hanya aktif jika gambar dan nama merchant sudah diisi.</CardDescription></CardHeader>
      <CardContent>
        <form class="space-y-5" @submit.prevent="save">
          <fieldset :disabled="saving || uploading || !!loadError" class="grid min-w-0 gap-5 sm:grid-cols-2">
            <div><Label for="settings-store-name" class="mb-2 block">Nama toko</Label><Input id="settings-store-name" v-model="form.store_name" name="store_name" required maxlength="100" /></div>
            <div><Label for="settings-owner-name" class="mb-2 block">Nama pemilik</Label><Input id="settings-owner-name" v-model="form.owner_name" name="owner_name" required maxlength="100" /></div>
            <div class="sm:col-span-2"><Label for="settings-qris-name" class="mb-2 block">Nama merchant QRIS</Label><Input id="settings-qris-name" v-model="form.qris_merchant_name" name="qris_merchant_name" :required="!!form.qris_image_url" maxlength="100" aria-describedby="qris-name-help" /><p id="qris-name-help" class="mt-2 text-xs text-muted-foreground">Isi persis nama penerima yang terlihat di aplikasi pembayaran, bukan nama produk.</p></div>
            <div class="space-y-3 sm:col-span-2">
              <Label for="settings-qris-file" class="block">Gambar QRIS resmi toko</Label>
              <input id="settings-qris-file" ref="fileInput" name="qris_file" type="file" accept="image/jpeg,image/png,image/webp" class="block w-full min-w-0 rounded-lg border border-input bg-white p-3 text-sm" aria-describedby="qris-file-help" @change="upload" >
              <p id="qris-file-help" class="text-xs text-muted-foreground">JPG, PNG atau WebP maksimal 2 MB. Unggah gambar QR merchant resmi; simpan setelah unggahan selesai.</p>
              <p v-if="uploading" role="status" class="text-sm">Mengunggah QRIS…</p><p v-if="uploadError" role="alert" class="text-sm text-rose-700">{{ uploadError }}</p>
              <Label for="settings-qris-url" class="block">Atau URL gambar QRIS</Label><Input id="settings-qris-url" v-model="form.qris_image_url" name="qris_image_url" maxlength="500" placeholder="https://…" />
              <figure v-if="form.qris_image_url" class="space-y-3"><img v-if="!previewFailed" :src="form.qris_image_url" :alt="`Pratinjau QRIS ${form.qris_merchant_name || 'toko'}`" class="max-h-80 max-w-full rounded-xl border border-input bg-white p-3 object-contain" @error="previewFailed = true" ><p v-else role="alert" class="text-sm text-rose-700">Gambar gagal dimuat. Periksa URL atau unggah ulang QRIS.</p><Button type="button" variant="outline" @click="form.qris_image_url = ''; uploadError = ''">Hapus gambar QRIS</Button></figure>
              <p v-else class="text-sm text-muted-foreground">QRIS belum aktif. Pembeli masih bisa memilih Cash untuk ambil di toko.</p>
            </div>
          </fieldset>
          <p v-if="saveError" role="alert" class="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{{ saveError }}</p>
          <Button type="submit" :loading="saving" :disabled="uploading || !!loadError"><ImagePlus v-if="!saving" aria-hidden="true" class="size-4" /> Simpan pengaturan toko</Button>
        </form>
      </CardContent>
    </Card>
    <AdminAccountForm />
  </div>
</template>
