import type { AgentContext } from '../../agent/api'
/** The web assistant is an overlay on whichever route is open; the mini program page is told where it was opened from. */
const routes: Record<string, string> = { workspace: '/outfits/workspace', outfits: '/outfits', wardrobe: '/wardrobe', pending: '/pending', settings: '/settings', help: '/help', tasks: '/tasks', add: '/add', trash: '/trash', ootd: '/ootd' }
export function assistantRoute(from?: string, garmentId?: string) {
  if (from === 'garment' && garmentId) return `/garment/${garmentId}`
  return routes[from || ''] || '/assistant'
}
const names: Record<string, string> = { '/wardrobe': '我的衣柜', '/outfits': '组合台', '/settings': '我的设置', '/help': '平台帮助', '/tasks': '任务记录', '/pending': '未入柜', '/add': '添加衣物', '/trash': '回收站' }
export function assistantContextName(context: AgentContext) {
  return context.scene ? `${context.name || '组合台'} · ${context.selectedIds?.length || 0} 项选中` : context.garmentId ? '当前衣物详情' : names[context.route] || '当前页面'
}
export const waitingTopics = [
  { label: '聊聊穿搭', prompt: '给我一些日常通勤的穿搭灵感吧。' },
  { label: '衣物养护', prompt: '有哪些简单实用的衣物收纳和养护建议？' },
  { label: '随便聊聊', prompt: '衣物正在整理，陪我轻松聊一会儿吧。' },
]
export const welcomePrompts = [
  { label: '看看我的衣柜数量', prompt: '我有多少件衣物？请按品类统计' },
  { label: '准备通勤穿搭', prompt: '帮我组合三套通勤穿搭' },
  { label: '了解组合台怎么使用', prompt: '组合台怎么使用？' },
]
