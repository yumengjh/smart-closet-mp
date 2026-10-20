import { computed, watch } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useThemeStore } from '../stores/theme'
import { usePreferencesStore } from '../stores/preferences'
import { useClosetStore } from '../stores/closet'
import { applyChrome, applyPendingBadge } from '../services/chrome'

/**
 * Call once in every page's setup and put `<page-meta :page-style="pageStyle" />` first in its template.
 * Gives the page the dark-theme variables, keeps navigation bar / tab bar / badge in step, and exposes minimal mode.
 */
export function useAppearance() {
  const theme = useThemeStore(), preferences = usePreferencesStore(), closet = useClosetStore()
  const sync = () => { applyChrome(theme.isDark); applyPendingBadge(closet.pendingCount) }
  onShow(sync)
  watch(() => theme.isDark, sync)
  watch(() => closet.pendingCount, count => applyPendingBadge(count))
  return { pageStyle: computed(() => theme.pageStyle), isDark: computed(() => theme.isDark), minimal: computed(() => preferences.minimal) }
}
