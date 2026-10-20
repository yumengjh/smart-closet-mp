import { useNotificationStore } from './notifications'
import { canUseCloset } from '../domain/session'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { closetApi } from '../services/api'
import type { SessionUser } from '../domain/session'

export const useClosetStore = defineStore('closet', () => {
  const user = ref<SessionUser | null>(null)
  const loadingUser = ref(false)
  let userInitialized = false
  let userRequest: Promise<void> | null = null
  const taskCount = ref(0)
  const pendingCount = ref(0)
  const isSignedIn = computed(() => Boolean(user.value))

  function refreshUser() {
    if (userRequest) return userRequest
    userRequest = (async () => {
      loadingUser.value = true
      try { user.value = await closetApi.currentUser() }
      catch { user.value = null }
      finally { loadingUser.value = false; userInitialized = true; userRequest = null }
    })()
    return userRequest
  }
  async function ensureUser() { if (!userInitialized) await refreshUser() }
  async function refreshCounts() {
    if (!canUseCloset(user.value)) { taskCount.value = 0; pendingCount.value = 0; return }
    const requestedUser = user.value?.username
    try {
      const [tasks, pending] = await Promise.all([
        closetApi.tasks(),
        closetApi.list({ status: 'DRAFT', q: '', category: '', color: '', season: '', page: 1, size: 1 }),
      ])
      if (user.value?.username !== requestedUser) return
      taskCount.value = tasks.filter((task) => ['QUEUED', 'RUNNING', 'CANCEL_REQUESTED'].includes(task.status)).length
      // Fewer garments waiting for review usually means one just entered the closet: its duplicate check follows shortly.
      if (pending.total < pendingCount.value) useNotificationStore().expectSoon()
      pendingCount.value = pending.total
    } catch { /* Keep the last known counts until the next successful response. */ }
  }
  async function signOut() { try { await closetApi.logout() } finally { signedOut() } }
  function signedOut() { uni.removeStorageSync('closetWorkflow'); user.value = null; taskCount.value = 0; pendingCount.value = 0 }
  function passwordRequired() { if (user.value) user.value.mustChangePassword = true; taskCount.value = 0; pendingCount.value = 0 }
  return { user, loadingUser, isSignedIn, taskCount, pendingCount, refreshUser, ensureUser, refreshCounts, clearSession: signedOut, signOut, signedOut, passwordRequired }
})
