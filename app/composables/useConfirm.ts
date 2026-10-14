/**
 * Dialog konfirmasi sebagai pop-up (pengganti `window.confirm`/`window.prompt`).
 *
 * SEBELUMNYA admin memakai dialog native browser untuk aksi destruktif
 * (`confirm('Hapus "…"?')`). Dialog itu tidak bisa di-style, terlihat asing di
 * panel yang sudah rapi, dan tidak konsisten dengan notifikasi pop-up lain.
 *
 * API ini promise-based: `if (!await confirm.ask({ ... })) return`.
 */

export interface ConfirmOptions {
  title: string
  /** Penjelasan singkat; boleh memuat detail risiko. */
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  /** `danger` = tombol merah untuk aksi destruktif. */
  tone?: 'default' | 'danger'
  /**
   * Aksi kedua yang-destructive-dan-berbeda, mis. "Nonaktifkan" vs "Hapus Paksa".
   * Tombolnya muncul di sebelah kiri tombol utama.
   */
  alt?: { label: string, tone?: 'default' | 'danger' }
  /** Bila diisi, dialog jadi input teks (pengganti `window.prompt`). */
  input?: {
    label?: string
    placeholder?: string
    value?: string
  }
}

/** Hasil `ask()`: `'alt'`, `'primary'`, atau `null` (batal/Escape). */
export type ConfirmChoice = 'alt' | 'primary' | null

export interface ConfirmState extends ConfirmOptions {
  /** `ask` = tombol biasa, `askText` = tombol + input teks. */
  mode: 'ask' | 'askText'
}

/**
 * Resolver tidak bisa disimpan di `useState` (fungsi tidak bisa diserialisasi
 * ke payload SSR), jadi disimpan di scope modul. Aman karena `ask()` hanya
 * dipanggil dari event handler di sisi klien, dan hanya satu dialog boleh
 * terbuka pada satu waktu.
 */
let resolver: ((value: boolean | string | ConfirmChoice) => void) | null = null

/** Dipanggil `<ConfirmHost>` saat pengguna menekan tombol / Escape. */
export function resolveConfirm(value: boolean | string | ConfirmChoice) {
  const done = resolver
  resolver = null
  done?.(value)
}

export function useConfirm() {
  const state = useState<ConfirmState | null>('ui:confirm', () => null)

  function open(opts: ConfirmOptions & { mode: 'ask' | 'askText' }): Promise<boolean | string | ConfirmChoice> {
    // Dialog yang belum ditutup (double-click) digantikan oleh yang baru.
    resolver?.(null)
    state.value = {
      mode: opts.mode,
      title: opts.title,
      message: opts.message,
      confirmLabel: opts.confirmLabel ?? (opts.mode === 'ask' ? 'Lanjutkan' : 'Simpan'),
      cancelLabel: opts.cancelLabel ?? 'Batal',
      tone: opts.tone ?? 'default',
      alt: opts.alt,
      input: opts.input
    }
    return new Promise((resolve) => {
      resolver = (value) => {
        state.value = null
        resolve(value)
      }
    })
  }

  /**
   * Konfirmasi dengan 2 atau 3 pilihan.
   * Bila `alt` diisi, hasilnya `'alt'` atau `'primary'`; tanpa `alt`, cukup
   * `true` / `false` supaya call site lama tidak berubah.
   */
  function choose(opts: ConfirmOptions): Promise<ConfirmChoice> {
    return open({ ...opts, mode: 'ask' }).then(v => (v === true ? 'primary' : v === 'alt' ? 'alt' : null))
  }

  /** Konfirmasi ya/tidak. */
  function ask(opts: Omit<ConfirmOptions, 'alt'>): Promise<boolean> {
    return open({ ...opts, mode: 'ask' }).then(v => v === true)
  }

  /** Konfirmasi + satu input teks. `null` bila dibatalkan. */
  function askText(opts: ConfirmOptions): Promise<string | null> {
    return open({ ...opts, mode: 'askText' }).then(v => (typeof v === 'string' ? v : null))
  }

  return { state, choose, ask, askText }
}
