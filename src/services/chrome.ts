// Native chrome (navigation bar, tab bar, tab badge) cannot be styled with CSS; these helpers keep it in step with the theme and counts.
const tabs = ['/pages/wardrobe/index', '/pages/pending/index', '/pages/outfits/index', '/pages/ootd/index', '/pages/settings/index']
const PENDING_TAB_INDEX = 1
const quiet = { fail: () => { /* Not a tab page or the bar is hidden; the next onShow tries again. */ } }

export function applyChrome(dark: boolean) {
  uni.setNavigationBarColor({ frontColor: dark ? '#ffffff' : '#000000', backgroundColor: dark ? '#171c1a' : '#f7f8fa', ...quiet })
  uni.setBackgroundColor({ backgroundColor: dark ? '#171c1a' : '#f7f8fa', backgroundColorTop: dark ? '#171c1a' : '#f7f8fa', backgroundColorBottom: dark ? '#171c1a' : '#f7f8fa', ...quiet })
  if (isTabPage()) uni.setTabBarStyle({ color: dark ? '#93a39b' : '#858a97', selectedColor: dark ? '#6fcf9f' : '#1f5c45', backgroundColor: dark ? '#242b27' : '#ffffff', borderStyle: dark ? 'black' : 'white', ...quiet })
}

/** 未入柜 tab badge; 0 removes it. */
export function applyPendingBadge(count: number) {
  if (!isTabPage()) return
  if (count > 0) uni.setTabBarBadge({ index: PENDING_TAB_INDEX, text: count > 99 ? '99+' : String(count), ...quiet })
  else uni.removeTabBarBadge({ index: PENDING_TAB_INDEX, ...quiet })
}

function isTabPage() {
  const pages = getCurrentPages()
  const route = pages.length ? (pages[pages.length - 1] as { route?: string }).route || '' : ''
  return tabs.includes(`/${route}`)
}
