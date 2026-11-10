<template>
  <!-- Navigasi admin, dipakai sidebar desktop dan drawer mobile (satu sumber). -->
  <div class="admin-navigation">
    <div>
      <p class="admin-nav-label">
        Operasional toko
      </p>
      <nav class="admin-nav-group" aria-label="Operasional toko">
        <NuxtLink
          to="/admin"
          exact-active-class="admin-nav-active"
          class="admin-nav-link"
        >
          <LayoutDashboard class="h-4 w-4 shrink-0" />
          <span>Dashboard</span>
        </NuxtLink>

        <!-- Modul Owner-only: semua API di belakangnya menuntut role OWNER,
             jadi menyembunyikan linknya mencegah klik-403 yang sia-sia. -->
        <template v-if="auth.isOwner">
        <NuxtLink
          to="/admin/products"
          active-class="admin-nav-active"
          class="admin-nav-link"
        >
          <Package class="h-4 w-4 shrink-0" />
          <span>Katalog Produk</span>
        </NuxtLink>

        <NuxtLink
          to="/admin/inventory"
          active-class="admin-nav-active"
          class="admin-nav-link"
        >
          <ArrowLeftRight class="h-4 w-4 shrink-0" />
          <span>Inventori &amp; Stok</span>
        </NuxtLink>

        <NuxtLink
          to="/admin/orders"
          active-class="admin-nav-active"
          class="admin-nav-link"
        >
          <ShoppingCart class="h-4 w-4 shrink-0" />
          <span>Pesanan</span>
        </NuxtLink>

        <NuxtLink
          to="/admin/promotions"
          active-class="admin-nav-active"
          class="admin-nav-link"
        >
          <Ticket class="h-4 w-4 shrink-0" />
          <span>Promosi &amp; Kupon</span>
        </NuxtLink>
        <NuxtLink to="/admin/settings" active-class="admin-nav-active" class="admin-nav-link">
          <Settings class="h-4 w-4 shrink-0" />
          <span>Pengaturan toko &amp; akun</span>
        </NuxtLink>
        </template>
      </nav>
    </div>

    <div v-if="auth.isOwner">
      <p class="admin-nav-label">
        Pelanggan &amp; AI
      </p>
      <nav class="admin-nav-group" aria-label="Pelanggan dan AI">
        <template v-if="auth.isOwner">
        <NuxtLink
          to="/admin/conversations"
          active-class="admin-nav-active"
          class="admin-nav-link"
        >
          <MessagesSquare class="h-4 w-4 shrink-0" />
          <span>Percakapan Chat</span>
        </NuxtLink>

        <NuxtLink
          to="/admin/customers"
          active-class="admin-nav-active"
          class="admin-nav-link"
        >
          <Users class="h-4 w-4 shrink-0" />
          <span>Pelanggan</span>
        </NuxtLink>

        <NuxtLink
          to="/admin/analytics"
          active-class="admin-nav-active"
          class="admin-nav-link"
        >
          <ChartColumn class="h-4 w-4 shrink-0" />
          <span>Analitik &amp; Metrik</span>
        </NuxtLink>
        </template>
        <template v-if="auth.isOwner">
          <NuxtLink
            to="/admin/actions"
            active-class="admin-nav-active"
            class="admin-nav-link"
          >
            <span class="flex items-center gap-3">
              <ListChecks class="h-4 w-4 shrink-0" />
              <span>Aksi AI</span>
            </span>
            <span class="admin-nav-chip">HITL</span>
          </NuxtLink>

          <NuxtLink
            to="/admin/audit"
            active-class="admin-nav-active"
            class="admin-nav-link"
          >
            <Shield class="h-4 w-4 shrink-0" />
            <span>Audit Trail</span>
          </NuxtLink>
        </template>
      </nav>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  ArrowLeftRight,
  ChartColumn,
  LayoutDashboard,
  ListChecks,
  MessagesSquare,
  Package,
  Shield,
  Settings,
  ShoppingCart,
  Ticket,
  Users
} from '@lucide/vue'

const auth = useAuthStore()
</script>
