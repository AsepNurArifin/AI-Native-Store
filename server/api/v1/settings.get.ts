import { readStoreSettings } from '../../utils/store-settings'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return await readStoreSettings(getDb())
})
