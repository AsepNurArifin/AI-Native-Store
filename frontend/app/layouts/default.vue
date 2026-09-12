<template>
  <div class="min-h-screen bg-stone-50/50 text-stone-900 antialiased selection:bg-clay-500 selection:text-white">
    <!-- Sticky Glass Header -->
    <header class="sticky top-0 z-40 border-b border-stone-200/80 bg-white/80 backdrop-blur-md transition-colors">
      <div class="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <!-- Brand Logo -->
        <NuxtLink to="/" class="group flex items-center gap-2.5">
          <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-clay-600 text-white shadow-md group-hover:scale-105 transition-transform duration-200">
            <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5" />
              <path d="M8.5 8.5v.01" /><path d="M11.5 11.5v.01" /><path d="M15.5 8.5v.01" />
            </svg>
          </div>
          <div>
            <span class="font-display text-base font-bold tracking-tight text-stone-900">AI-Native <span class="text-clay-600">Store</span></span>
          </div>
        </NuxtLink>

        <!-- Navigation Links -->
        <nav class="flex items-center gap-2 text-sm font-medium">
          <NuxtLink
            to="/chat"
            class="rounded-xl px-3.5 py-2 text-stone-600 hover:bg-stone-100/80 hover:text-stone-900 transition-colors"
          >
            Demo Toko
          </NuxtLink>
          <NuxtLink
            to="/admin"
            class="rounded-xl px-3.5 py-2 text-stone-500 hover:bg-stone-100/80 hover:text-stone-800 transition-colors"
          >
            Admin
          </NuxtLink>
          <NuxtLink
            to="/login"
            class="group inline-flex items-center gap-1.5 rounded-xl bg-clay-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-clay-500 transition-all duration-150"
          >
            <span>Masuk</span>
            <span class="transition-transform duration-150 group-hover:translate-x-0.5">→</span>
          </NuxtLink>
        </nav>
      </div>
    </header>

    <!-- Main Content -->
    <main class="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <slot />
    </main>

    <!-- Modern Footer -->
    <footer class="border-t border-stone-200/80 py-8 text-center text-xs text-stone-500">
      <div class="mx-auto max-w-6xl px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div class="flex items-center gap-2">
          <span class="font-semibold text-stone-700">AI-Native Store Management System</span>
          <span>·</span>
          <span>Conversational Commerce</span>
        </div>
        <div class="flex items-center gap-2">
          <Badge variant="muted">Real-time Stock</Badge>
          <Badge variant="info">Multi-Agent AI</Badge>
          <Badge variant="success">Anti-Overbooking</Badge>
        </div>
      </div>
    </footer>
  </div>
</template>

