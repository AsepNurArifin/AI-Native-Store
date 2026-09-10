<template>
  <div class="space-y-8">
    <section class="grid items-center gap-6 py-8 md:grid-cols-2">
      <div>
        <h1 class="text-4xl font-extrabold tracking-tight">Belanja lewat chat, dibantu AI.</h1>
        <p class="mt-3 text-slate-600 dark:text-slate-300">
          Ceritakan kebutuhanmu — AI Sales mencarikan produk dari stok asli toko,
          membandingkan, lalu menyusun ringkasan pesanan. Kamu konfirmasi
          dengan <b>tombol</b>, bukan teks bebas.
        </p>
        <div class="mt-4 flex gap-2 text-sm">
          <ScBadge tone="bg-emerald-100 text-emerald-800">Stok real-time</ScBadge>
          <ScBadge tone="bg-slate-200 text-slate-800">Tanpa keranjang</ScBadge>
          <ScBadge tone="bg-slate-200 text-slate-800">2 channel: Web + WA</ScBadge>
        </div>
      </div>
      <ChatWidget />
    </section>
    <section class="grid gap-4 md:grid-cols-3">
      <ScCard><template #header><span class="font-semibold">1. Cerita</span></template>
        <p class="text-sm text-slate-600">Contoh: “butuh headset gaming di bawah 500 ribu”.</p></ScCard>
      <ScCard><template #header><span class="font-semibold">2. Bandingkan</span></template>
        <p class="text-sm text-slate-600">AI menampilkan produk + harga + stok dari database.</p></ScCard>
      <ScCard><template #header><span class="font-semibold">3. Konfirmasi</span></template>
        <p class="text-sm text-slate-600">Tekan <b>Konfirmasi Pesanan</b> — order tercatat atomik & anti-ganda.</p></ScCard>
    </section>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
</script>
