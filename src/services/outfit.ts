import { shallowRef } from 'vue'
import { openTab, parseQuery, TAB_NAMES } from './tab-route'
import { pushPage } from './page-stack'
import { arrangeOutfit, orderOutfitLayers } from '../domain/outfit-layout'
import { closetApi } from '../services/api'
import { artworkForGarment, createOutfitElement, loadOutfitImage } from '../domain/outfit-images'
import { elementKey, normalizeScene, OUTFIT_VERSION, stickerLimit, type OutfitElement, type OutfitScene } from '../domain/outfit'
import type { AgentContext, Candidate, Proposal } from '../agent/api'

export const canvasBridge = shallowRef<null | {
  context: () => AgentContext;
  apply: (scene: OutfitScene, name?: string) => void;
  save: () => Promise<void>;
}>(null)
export function pageContext(route: string): AgentContext {
  const canvas = canvasBridge.value?.context()
  if (canvas?.route === route) return JSON.parse(JSON.stringify(canvas))
  if (route.startsWith('/garment/')) return { route, garmentId: route.slice(9) }
  return { route }
}
// Several recommendation cards ask for the same garments at once; share one request each for a short while.
const DETAIL_TTL_MS = 30_000
const details = new Map<string, { at: number; promise: ReturnType<typeof closetApi.detail> }>()
function garmentDetail(id: string) {
  const hit = details.get(id)
  if (hit && Date.now() - hit.at < DETAIL_TTL_MS) return hit.promise
  const promise = closetApi.detail(id); details.set(id, { at: Date.now(), promise }); promise.catch(() => details.delete(id))
  return promise
}
export async function candidateScene(candidate: Candidate, people: OutfitElement[] = []): Promise<OutfitScene> {
  const elements = people.map(item => ({ ...item }))
  // Fetch every garment and start loading its picture at once; only the layout below needs to go one by one.
  const garments = await Promise.all(candidate.garmentIds.map(garmentDetail))
  await Promise.all(garments.map(garment => loadOutfitImage(artworkForGarment(garment).url).catch(() => undefined)))
  for (const garment of garments) {
    if (garment.status !== 'ACTIVE') throw new Error('候选衣物已不在衣柜中，请重新生成。')
    const limit = stickerLimit(elements, 'GARMENT'); if (limit) throw new Error(limit)
    elements.push(await createOutfitElement(garment, elements))
  }
  return arrangeOutfit(normalizeScene({ version: OUTFIT_VERSION, elements }))
}
export async function editedScene(proposal: Proposal): Promise<OutfitScene> {
  let elements = proposal.context.scene?.elements.map(item => ({ ...item })) || []
  let selectionChanged = false
  for (const op of proposal.payload.operations || []) {
    if (op.op !== 'transform') selectionChanged = true
    const index = elements.findIndex(item => elementKey(item) === op.elementId)
    if (op.op !== 'add' && index < 0) throw new Error('这张贴纸已不存在，请重新生成建议。')
    if (op.op === 'remove') elements.splice(index, 1)
    else if (op.op === 'transform') elements[index] = { ...elements[index], ...op.patch }
    else {
      const garment = await closetApi.detail(op.garmentId!)
      if (garment.status !== 'ACTIVE') throw new Error('衣物已不在衣柜中。')
      const limit = op.op === 'add' ? stickerLimit(elements, 'GARMENT') : null; if (limit) throw new Error(limit)
      const item = await createOutfitElement(garment, elements)
      if (op.op === 'replace') elements[index] = { ...item, elementId: elements[index].elementId, x: elements[index].x, y: elements[index].y, zIndex: elements[index].zIndex }
      else elements.push(item)
    }
  }
  const scene = normalizeScene({ version: OUTFIT_VERSION, elements: elements.sort((a, b) => a.zIndex - b.zIndex).map((item, zIndex) => ({ ...item, zIndex })) })
  return selectionChanged ? orderOutfitLayers(scene) : scene
}


export function openOutfitDraft(username: string, scene: OutfitScene, name: string, query: Record<string, string> = {}) {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`
  uni.setStorageSync(`yixu.outfit-draft.v1:${username}:new:${id}`, JSON.stringify({ name, revision: null, scene, savedAt: Date.now() }))
  const params = Object.entries({ id: 'new', draft: id, ...query }).map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join('&')
  return new Promise<void>((resolve, reject) => uni.navigateTo({ url: `/pkg-outfit/workspace/index?${params}`, success: () => resolve(), fail: reject }))
}
export async function openRecommendedOutfit(username: string, outfit: import('../recommend/types').RecommendedOutfit, runId?: string) {
  const scene = await candidateScene({ name: outfit.name, reason: '', garmentIds: outfit.garments.map(g => g.id) })
  await openOutfitDraft(username, scene, outfit.name, { from: 'recommend', ...(runId ? { run: runId, key: outfit.key } : {}) })
  if (outfit.logId) (await import('../recommend/api')).recommendApi.signal({ kind: 'OPEN_WORKSPACE', logId: outfit.logId })
}

/** Mini program routes corresponding to web navigation events and help links. */
export function navigateOutfitLink(path: string) {
  const [pathname, query = ''] = path.split('?')
  const tab = TAB_NAMES.find(name => pathname === `/${name}`)
  if (tab) { openTab(tab, parseQuery(query)); return }
  let target = ''
  if (pathname === '/outfits/workspace') target = '/pkg-outfit/workspace/index'
  else if (pathname.startsWith('/outfits/')) target = `/pkg-outfit/workspace/index?id=${encodeURIComponent(pathname.slice(9))}`
  else if (pathname.startsWith('/garment/')) target = `/pkg-closet/garment/index?id=${encodeURIComponent(pathname.slice(9))}`
  else target = ({ '/add': '/pkg-closet/add/index', '/tasks': '/pkg-closet/tasks/index', '/trash': '/pkg-closet/trash/index', '/help': '/pkg-closet/help/index' } as Record<string, string>)[pathname] || ''
  if (target) pushPage(target + (query ? (target.includes('?') ? '&' : '?') + query : ''))
}

/** AbortController is not provided by all WeChat base libraries; http.streamPost only needs this small signal contract. */
export function outfitStreamAbort() {
  const listeners = new Set<() => void>()
  const signal = { aborted: false, addEventListener: (_event: string, cb: () => void) => listeners.add(cb), removeEventListener: (_event: string, cb: () => void) => listeners.delete(cb) }
  return { signal: signal as unknown as AbortSignal, abort: () => { signal.aborted = true; for (const cb of listeners) cb(); listeners.clear() } }
}
