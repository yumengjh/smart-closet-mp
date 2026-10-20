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
  async function signOut() { try { await closetApi.logout() } finally { signedOut() } }
  function signedOut() { user.value = null; taskCount.value = 0; pendingCount.value = 0 }
  function passwordRequired() { if (user.value) user.value.mustChangePassword = true; taskCount.value = 0; pendingCount.value = 0 }
  return { user, loadingUser, isSignedIn, taskCount, pendingCount, refreshUser, ensureUser, signOut, signedOut, passwordRequired }
})
