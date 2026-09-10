<template>
  <div class="min-h-screen bg-slate-50/50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 antialiased selection:bg-indigo-500 selection:text-white">
    <!-- Ambient Background Glow -->
    <div class="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div class="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-gradient-to-tr from-indigo-500/15 via-purple-500/10 to-pink-500/10 blur-[120px] rounded-full" />
    </div>

    <!-- Sticky Glass Header -->
    <header class="sticky top-0 z-40 border-b border-slate-200/80 bg-white/80 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-950/80 transition-colors">
      <div class="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <!-- Brand Logo -->
        <NuxtLink to="/" class="group flex items-center gap-2.5">
          <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform duration-200">
            <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5" />
              <path d="M8.5 8.5v.01" /><path d="M11.5 11.5v.01" /><path d="M15.5 8.5v.01" />
            </svg>
          </div>
          <div>
            <span class="font-display text-base font-bold tracking-tight text-slate-900 dark:text-white">AI-Native <span class="ai-gradient-text">Store</span></span>
            <div class="flex items-center gap-1.5 -mt-0.5">
              <span class="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span class="text-[10px] font-medium tracking-wide uppercase text-slate-400 dark:text-slate-500">AI Sales Online</span>
            </div>
          </div>
        </NuxtLink>

        <!-- Navigation Links -->
        <nav class="flex items-center gap-2 text-sm font-medium">
          <NuxtLink
            to="/"
            class="rounded-xl px-3.5 py-2 text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/80 dark:hover:text-slate-100 transition-colors"
          >
            Toko & Chat
          </NuxtLink>
          <NuxtLink
            to="/login"
            class="rounded-xl px-3.5 py-2 text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/80 dark:hover:text-slate-100 transition-colors"
          >
            Login
          </NuxtLink>
          <NuxtLink
            to="/admin"
            class="group relative inline-flex items-center gap-1.5 overflow-hidden rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 transition-all duration-150"
          >
            <span>Admin Portal</span>
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
    <footer class="border-t border-slate-200/80 py-8 text-center text-xs text-slate-500 dark:border-slate-800/80 dark:text-slate-400">
      <div class="mx-auto max-w-6xl px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div class="flex items-center gap-2">
          <span class="font-semibold text-slate-700 dark:text-slate-300">AI-Native Store Management System</span>
          <span>·</span>
          <span>Conversational Commerce</span>
        </div>
        <div class="flex items-center gap-2">
          <ScBadge tone="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">Real-time Stock</ScBadge>
          <ScBadge tone="bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">Multi-Agent AI</ScBadge>
          <ScBadge tone="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">Anti-Overbooking</ScBadge>
        </div>
      </div>
    </footer>
  </div>
</template>

