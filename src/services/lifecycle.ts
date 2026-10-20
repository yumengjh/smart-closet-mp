// Shared app visibility and connectivity for service polling (independent of a page instance).
let visible = true
let online = true
const listeners = new Set<() => void>()
uni.onAppShow(() => { visible = true; listeners.forEach(listener => listener()) })
uni.onAppHide(() => { visible = false; listeners.forEach(listener => listener()) })
uni.onNetworkStatusChange(status => { online = status.isConnected })
export const appVisible = () => visible
export const isOnline = () => online
export function onVisibilityChange(listener: () => void) { listeners.add(listener) }
export function offVisibilityChange(listener: () => void) { listeners.delete(listener) }
