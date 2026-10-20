import type { TemplateMeta, TemplateSlot } from '../../services/admin'
export const ROLE: Record<string, string> = { TOP: '上装', BOTTOM: '下装', ONE_PIECE: '连衣裙/连体', OVERALL: '背带裙/背带裤', SHOES: '鞋', HAT: '帽', HEADWEAR: '头饰', BAG: '包', HANDHELD: '手持物', SOCKS: '袜子/裤袜', OUTER: '外层' }
export const COLOR: Record<string, string> = { BLACK: '黑', WHITE: '白', GRAY: '灰', BEIGE: '米', BROWN: '棕', NAVY: '藏蓝', DENIM: '牛仔蓝', BLUE: '蓝', RED: '红', ORANGE: '橙', YELLOW: '黄', GREEN: '绿', PURPLE: '紫', PINK: '粉' }
const AUDIENCE: Record<string, string> = { FEMALE: '女', MALE: '男' }
const OCCASION: Record<string, string> = { DAILY: '日常', COMMUTE: '通勤', DATE: '约会', SPORT: '运动', OUTDOOR: '户外', FORMAL: '正式', TRAVEL: '度假', HOME: '居家' }
export function metaText(m?: TemplateMeta) {
  if (!m) return ''
  const parts = [m.audience.length ? '适合' + m.audience.map(a => AUDIENCE[a] || a).join('/') : '男女皆可']
  if (m.seasons.length) parts.push(m.seasons.join('/') + '季')
  if (m.occasions.length) parts.push(m.occasions.map(o => OCCASION[o] || o).join('/'))
  if (m.kind === 'TREND') parts.push(`有效期 ${m.validFrom || '—'} 至 ${m.validUntil || '—'}`)
  return parts.join(' · ')
}
export function expired(m?: TemplateMeta) { return !!m?.validUntil && m.validUntil < new Date().toISOString().slice(0, 10) }
export function slotText(s: TemplateSlot) {
  const parts = [s.roles.map(r => ROLE[r] || r).join('/') || '任意位置']
  if (s.categoryAny.length) parts.push(s.categoryAny.join('/'))
  if (s.colorAny.length) parts.push('颜色 ' + s.colorAny.map(c => COLOR[c] || c).join('/'))
  if (s.styleAny.length) parts.push('风格 ' + s.styleAny.join('/'))
  if (s.patternMax !== null && s.patternMax !== undefined) parts.push(s.patternMax === 0 ? '纯色' : `花纹≤${s.patternMax}`)
  if (s.patternMin) parts.push('需带花纹')
  if (s.fitAny?.length) parts.push('版型 ' + s.fitAny.join('/'))
  return parts.join('，')
}
