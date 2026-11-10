import { getCurrentUser } from '../../../utils/auth'

export default defineEventHandler(async (event) => {
  const u = await getCurrentUser(event)
  return { id: u.id, name: u.name, email: u.email, role: u.role, status: u.status, created_at: u.createdAt }
})
