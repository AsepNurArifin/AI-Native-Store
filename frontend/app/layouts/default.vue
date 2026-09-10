<template>
  <div class="min-h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
    <header class="border-b border-slate-200 dark:border-slate-800">
      <div class="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <NuxtLink to="/" class="font-bold tracking-tight">AI-Native Store</NuxtLink>
        <nav class="flex items-center gap-2 text-sm">
          <NuxtLink to="/" class="rounded px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800">Belanja</NuxtLink>
          <NuxtLink to="/login" class="rounded px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800">Login Staff</NuxtLink>
          <NuxtLink to="/admin" class="rounded bg-slate-900 px-3 py-1.5 text-white dark:bg-white dark:text-slate-900">Admin</NuxtLink>
        </nav>
      </div>
    </header>
    <main class="mx-auto max-w-6xl px-4 py-6">
      <slot />
    </main>
    <footer class="border-t border-slate-200 py-6 text-center text-xs text-slate-500 dark:border-slate-800">
      AI-Native Store Management System — conversational commerce
    </footer>
  </div>
</template>
