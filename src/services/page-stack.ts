// WeChat keeps at most 10 pages on the stack; navigateTo fails silently beyond that.
// These helpers pick navigateBack / redirectTo when the target is already behind us or the stack is getting full.
type StackPage = { route?: string; options?: Record<string, string | undefined> }
const MAX_STACK = 10

export const stack = () => getCurrentPages() as unknown as StackPage[]
export function currentRoute() { const pages = stack(); return pages.length ? pages[pages.length - 1].route || '' : '' }
function previousPage() { const pages = stack(); return pages.length > 1 ? pages[pages.length - 2] : undefined }

/** navigateTo, but replaces the current page instead once the stack is nearly full. */
export function pushPage(url: string) {
  if (stack().length >= MAX_STACK - 1) uni.redirectTo({ url })
  else uni.navigateTo({ url })
}

/** Go to a page that may already be the previous one: go back to it, otherwise replace (`replace`) or push. */
export function gotoPage(url: string, route: string, matches: (options: Record<string, string | undefined>) => boolean, replace: boolean) {
  const previous = previousPage()
  if (previous?.route === route && matches(previous.options || {})) { uni.navigateBack(); return }
  if (replace) uni.redirectTo({ url }); else pushPage(url)
}
