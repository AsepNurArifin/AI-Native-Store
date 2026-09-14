<template>
  <div class="min-h-screen bg-stone-50/50 text-stone-900 antialiased selection:bg-clay-500 selection:text-white">
    <!-- Sticky Glass Header -->
    <header class="sticky top-0 z-40 border-b border-stone-200/80 bg-white/80 backdrop-blur-md transition-colors">
      <div class="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <!-- Brand Logo -->
        <NuxtLink to="/" class="group flex items-center gap-2.5">
          <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-clay-600 text-white shadow-md group-hover:scale-105 transition-transform duration-200">
            <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 9h18l-1.5 10.5a2 2 0 0 1-2 1.5H6.5a2 2 0 0 1-2-1.5L3 9Z" />
              <path d="M8 9V6a4 4 0 0 1 8 0v3" />
            </svg>
          </div>
          <div class="min-w-0">
            <div class="whitespace-nowrap font-display text-base font-bold tracking-tight text-stone-900">Toko <span class="text-clay-700">Bu Ratna</span></div>
            <div class="text-[10px] font-medium text-stone-500">HP, laptop &amp; aksesoris</div>
          </div>
        </NuxtLink>

        <!-- Navigation Links -->
        <nav class="flex items-center gap-2 text-sm font-medium">
          <NuxtLink
            to="/#rak"
            class="hidden whitespace-nowrap rounded-xl px-3.5 py-2 text-stone-600 hover:bg-stone-100/80 hover:text-stone-900 transition-colors sm:inline-flex"
          >
            Rak
          </NuxtLink>
          <NuxtLink
            to="/#cara-belanja"
            class="hidden rounded-xl px-3.5 py-2 text-stone-600 hover:bg-stone-100/80 hover:text-stone-900 transition-colors sm:inline-flex"
          >
            Cara Belanja
          </NuxtLink>
          <NuxtLink
            to="/chat"
            class="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl bg-clay-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-clay-500 transition-colors duration-150 sm:px-4"
          >
            <span class="sm:hidden">Chat Toko</span>
            <span class="hidden sm:inline">Belanja via Chat</span>
          </NuxtLink>
        </nav>
      </div>
    </header>

    <!-- Main Content -->
    <main class="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <slot />
    </main>

    <!-- Footer Toko -->
    <footer class="border-t border-stone-200/80 py-8 text-xs text-stone-500">
      <div class="mx-auto max-w-6xl px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div class="text-center sm:text-left">
          <p>© 2026 · Toko demo</p>
        </div>
      </div>
    </footer>
  </div>
</template>

