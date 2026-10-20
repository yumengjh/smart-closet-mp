/**
 * Mini program port of ../smart-closet/src/services/api.ts: same endpoints and types, no mock mode.
 * Only the account calls are here yet; the rest is ported in the next step.
 */
import { request, clearCookies } from './http'
import type { SessionUser } from '../domain/session'

export type Registration = { mode: 'CLOSED' | 'INVITE' | 'OPEN' }

export const closetApi = {
  registration: () => request<Registration>('/api/auth/registration'),
  login: (username: string, password: string) => request<SessionUser>('/api/auth/login', { method: 'POST', body: { username, password } }),
  currentUser: () => request<SessionUser>('/api/auth/me'),
  async logout() { try { await request('/api/auth/logout', { method: 'POST' }) } finally { clearCookies() } },
  changePassword: (currentPassword: string, newPassword: string, signOutOthers = true) =>
    request<void>('/api/auth/password', { method: 'POST', body: { currentPassword, newPassword, signOutOthers } }),
}
