// uni.switchTab cannot carry a query string, so tab-to-tab handoff goes through one storage key per tab.
// Writers call openTab(); the tab page reads the request once in onShow via useTabQuery() / takeTabQuery().
import { onShow } from '@dcloudio/uni-app'
import { onUnmounted } from 'vue'

export type TabName = 'wardrobe' | 'pending' | 'outfits' | 'ootd' | 'settings'
export const TAB_NAMES: readonly TabName[] = ['wardrobe', 'pending', 'outfits', 'ootd', 'settings']
const storageKey = (tab: TabName) => `yixu.tab-query:${tab}`
const eventName = (tab: TabName) => `yixu-tab-query:${tab}`

/** Parses `a=1&b=2` (with or without a leading `?`) into a plain object. */
export function parseQuery(text: string): Record<string, string> {
  const result: Record<string, string> = {}
  for (const part of text.replace(/^\?/, '').split('&')) {
    if (!part) continue
    const index = part.indexOf('=')
    const rawKey = index < 0 ? part : part.slice(0, index), rawValue = index < 0 ? '' : part.slice(index + 1)
    try { result[decodeURIComponent(rawKey)] = decodeURIComponent(rawValue) } catch { result[rawKey] = rawValue }
  }
  return result
}

function currentTab(): TabName | null {
  const pages = getCurrentPages()
  const route = pages.length ? (pages[pages.length - 1] as { route?: string }).route || '' : ''
  return TAB_NAMES.find(tab => route === `pages/${tab}/index`) || null
}

/** Switches to a tab page and hands it an optional query (read once by that page). */
export function openTab(tab: TabName, query: Record<string, string | undefined> = {}) {
  const clean = Object.fromEntries(Object.entries(query).filter(([, value]) => value !== undefined && value !== '')) as Record<string, string>
  try {
    if (Object.keys(clean).length) uni.setStorageSync(storageKey(tab), JSON.stringify(clean))
    else uni.removeStorageSync(storageKey(tab))
  } catch { /* Opening the tab still works without the query. */ }
  // Switching to the tab that is already showing does not fire onShow, so tell it directly.
  if (currentTab() === tab) { uni.$emit(eventName(tab)); return }
  uni.switchTab({ url: `/pages/${tab}/index` })
}

/** Returns and clears the pending handoff for a tab ({} when there is none). */
export function takeTabQuery(tab: TabName): Record<string, string> {
  try {
    const raw = uni.getStorageSync(storageKey(tab))
    if (!raw) return {}
    uni.removeStorageSync(storageKey(tab))
    const value = JSON.parse(String(raw))
    return value && typeof value === 'object' ? value as Record<string, string> : {}
  } catch { return {} }
}

/** In a tab page's setup: calls `handler` with the handoff query (if any) on every show and when the tab is re-opened in place. */
export function useTabQuery(tab: TabName, handler: (query: Record<string, string>) => void) {
  const run = () => { const query = takeTabQuery(tab); if (Object.keys(query).length) handler(query) }
  onShow(run)
  const listener = () => run()
  uni.$on(eventName(tab), listener)
  onUnmounted(() => uni.$off(eventName(tab), listener))
}
