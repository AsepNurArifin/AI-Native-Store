import { webIdentity } from '../../../utils/identity'

/** Issue a private guest cookie before payment so retry ownership stays stable. */
export default defineEventHandler((event) => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store, max-age=0')
  webIdentity(event)
  return { ready: true }
})
