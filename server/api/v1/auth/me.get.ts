import { getCurrentUser } from '../../../utils/auth'

export default defineEventHandler(async (event) => {
  const u = await getCurrentUser(event)
  return u
})
