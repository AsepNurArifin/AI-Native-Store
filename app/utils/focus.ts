export function handleDialogKeydown(event: KeyboardEvent, container: HTMLElement, close: () => void): void {
  if (event.defaultPrevented || (event.key !== 'Tab' && event.key !== 'Escape')) return

  const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]')
  let topDialog: HTMLElement | undefined
  for (let i = dialogs.length - 1; i >= 0; i--) {
    const dialog = dialogs.item(i)
    if (dialog.getClientRects().length && getComputedStyle(dialog).visibility !== 'hidden') {
      topDialog = dialog
      break
    }
  }
  if (topDialog !== container) return

  if (event.key === 'Escape') {
    event.preventDefault()
    close()
    return
  }

  const candidates = container.querySelectorAll<HTMLElement>(
    'a[href], button, input, select, textarea, summary, [contenteditable="true"], [tabindex]'
  )
  const focusables = Array.from(candidates).filter(element => (
    element.tabIndex >= 0
    && !element.matches(':disabled')
    && !element.closest('[inert]')
    && element.getClientRects().length > 0
    && getComputedStyle(element).visibility !== 'hidden'
  ))
  const first = focusables[0]
  const last = focusables[focusables.length - 1]
  if (!first || !last) {
    event.preventDefault()
    container.focus()
    return
  }

  const active = document.activeElement
  if (!focusables.some(element => element === active)) {
    event.preventDefault()
    ;(event.shiftKey ? last : first).focus()
  }
  else if (event.shiftKey && active === first) {
    event.preventDefault()
    last.focus()
  }
  else if (!event.shiftKey && active === last) {
    event.preventDefault()
    first.focus()
  }
}
