// Mini program stub: keeps the sound preference and public hooks; synthesized web cues are omitted.
import { readonly, ref } from 'vue'
const preferenceKey = 'yixu.sound.v1'
const enabled = ref(false)
try { enabled.value = uni.getStorageSync(preferenceKey) === 'on' } catch { /* Optional preference. */ }
export const soundEnabled = readonly(enabled)
export function playSound(_cue = 'tap') {}
export function sliderSound(_position: number) {}
export function hoverSound(_event: { pointerType?: string; buttons?: number }) {}
export function toggleSound() {
  enabled.value = !enabled.value
  try { uni.setStorageSync(preferenceKey, enabled.value ? 'on' : 'off') } catch { /* Keep session preference. */ }
}
export function unlockSound() {}
export function installInteractionSounds() { return () => {} }
