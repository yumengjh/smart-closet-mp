import { useClosetStore } from '../../stores/closet'
import { pushPage } from '../../services/page-stack'
import { openTab, parseQuery, TAB_NAMES } from '../../services/tab-route'
export async function requireAdmin() {
  const closet = useClosetStore()
  await closet.ensureUser()
  if (closet.user?.role === 'ADMIN') return true
  openTab('wardrobe'); return false
}
export function go(path: string) {
  const [pathname, query = ''] = path.split('?')
  const tab = TAB_NAMES.find(name => pathname === `/${name}`)
  if (tab) { openTab(tab, parseQuery(query)); return }
  const garment = pathname.match(/^\/garment\/([^/]+)$/), batch = pathname.match(/^\/batches\/([^/]+)$/)
  if (garment) pushPage(`/pkg-closet/garment/index?id=${encodeURIComponent(garment[1])}${query ? '&' + query : ''}`)
  else if (batch) pushPage(`/pkg-closet/batch/index?id=${encodeURIComponent(batch[1])}`)
  else {
    const routes: Record<string, string> = { '/tasks': '/pkg-closet/tasks/index', '/add': '/pkg-closet/add/index', '/help': '/pkg-closet/help/index', '/admin/templates': '/pkg-admin/templates/index' }
    if (routes[pathname]) pushPage(routes[pathname] + (query ? '?' + query : ''))
  }
}
export function when(value: string | number) {
  const date = new Date(value), time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  return date.toDateString() === new Date().toDateString() ? `今天 ${time}` : `${date.getMonth() + 1}月${date.getDate()}日 ${time}`
}
export const errorText = (cause: unknown, fallback: string) => cause instanceof Error ? cause.message : fallback
export function copy(value: string) { return new Promise<void>((resolve, reject) => uni.setClipboardData({ data: value, success: () => resolve(), fail: reject })) }
export const options = (labels: Record<string, string>) => Object.entries(labels).map(([value, label]) => ({ value, label }))
