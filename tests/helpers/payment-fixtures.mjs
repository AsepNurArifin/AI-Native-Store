import { orderBody } from './guest-client.mjs'

// A complete, deterministic 1×1 grayscale+alpha PNG, including IDAT and IEND.
export const paymentProofPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNg+A8AAQIBAEK+vGgAAAAASUVORK5CYII=',
  'base64'
)

export const alternatePaymentProofPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGP4/x8AAwAB//wl3FEAAAAASUVORK5CYII=',
  'base64'
)

export function qrisOrderBody(productId, expectedTotal, quantity = 1) {
  return {
    ...orderBody(productId, quantity),
    payment: { method: 'QRIS' },
    expected_total: expectedTotal
  }
}

export function paymentForm(body, proof = paymentProofPng, options = {}) {
  const form = new FormData()
  form.append('input', JSON.stringify(body))
  if (proof !== null) {
    form.append('proof', new Blob([proof], { type: options.type || 'image/png' }), options.filename || 'payment-proof.png')
  }
  return form
}
