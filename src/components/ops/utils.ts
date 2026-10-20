import { useClosetStore } from '../../stores/closet'
export async function requireAdmin() {
  const closet = useClosetStore()
  await closet.ensureUser()
  if (closet.user?.role === 'ADMIN') return true
  uni.switchTab({ url: '/pages/wardrobe/index' }); return false
}
export function go(path: string) {
  const [pathname, query = ''] = path.split('?')
  const tabs: Record<string, string> = { '/wardrobe': 'wardrobe', '/pending': 'pending', '/outfits': 'outfits', '/ootd': 'ootd', '/settings': 'settings' }
  if (tabs[pathname]) {
    // switchTab cannot carry query parameters; consume the intent on the destination's onLoad.
    if (query) uni.reLaunch({ url: `/pages/${tabs[pathname]}/index?${query}` })
    else uni.switchTab({ url: `/pages/${tabs[pathname]}/index` })
    return
  }
  const garment = pathname.match(/^\/garment\/([^/]+)$/), batch = pathname.match(/^\/batches\/([^/]+)$/)
  if (garment) uni.navigateTo({ url: `/pkg-closet/garment/index?id=${encodeURIComponent(garment[1])}${query ? '&' + query : ''}` })
  else if (batch) uni.navigateTo({ url: `/pkg-closet/batch/index?id=${encodeURIComponent(batch[1])}` })
  else {
    const routes: Record<string, string> = { '/tasks': '/pkg-closet/tasks/index', '/add': '/pkg-closet/add/index', '/help': '/pkg-closet/help/index', '/admin/templates': '/pkg-admin/templates/index' }
    if (routes[pathname]) uni.navigateTo({ url: routes[pathname] + (query ? '?' + query : '') })
  }
}
export function when(value: string | number) {
  const date = new Date(value), time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  return date.toDateString() === new Date().toDateString() ? `今天 ${time}` : `${date.getMonth() + 1}月${date.getDate()}日 ${time}`
}
export const errorText = (cause: unknown, fallback: string) => cause instanceof Error ? cause.message : fallback
export function copy(value: string) { return new Promise<void>((resolve, reject) => uni.setClipboardData({ data: value, success: () => resolve(), fail: reject })) }
export const options = (labels: Record<string, string>) => Object.entries(labels).map(([value, label]) => ({ value, label }))
