<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>

  <!-- Lapisan umpan balik global: notifikasi + dialog konfirmasi.
       Di luar <NuxtLayout> supaya tetap muncul di halaman tanpa layout
       (mis. /login) dan tidak ikut ter-scroll bersama isi halaman. -->
  <ToastHost />
  <ConfirmHost />
</template>
