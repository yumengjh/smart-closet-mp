// Persistent mini program photo queue. Original files are saved before their queue record is acknowledged.
import { createUuid } from '../domain/id'
import { ref } from 'vue'
import { closetApi } from './api'
import { request, upload, HttpError } from './http'
import { isOnline } from './lifecycle'
import { useProcessingStore } from '../stores/processing'

export type Hint = { kind: 'POINT' | 'BOX'; x: number; y: number; width?: number; height?: number }
export type QuickView = { intakeId: string; garmentId: string; sourceSaved: boolean; revision: number; awaitTargetHint: boolean; task: { status: string; steps: { type: string; status: string; error?: { message: string } }[] }; garment: { status: string; sourceUrl: string; displayUrl: string; displayAssetId: string; images: { id: string; kind: string; url: string; aiGenerated: boolean }[]; imageProcessing?: { stickerReady: boolean } }; quality: { needsEnhancement: boolean; reason: string } | null }
export type LocalPhoto = { id: string; owner: string; filePath?: string; name: string; options: { admissionMode: string; captureSessionId: string; targetHint?: Hint }; created: number; state: 'PENDING' | 'UPLOADING' | 'SAVED' | 'ERROR' | 'MARKING'; nextAttemptAt?: number; leaseUntil?: number; leaseOwner?: string; error?: string; result?: QuickView }
export const uploadRows = ref<LocalPhoto[]>([])
export const uploadError = ref('')
const storageKey = 'yuda.quick-intake.v1'
const workerId = createUuid()
function readAll(): LocalPhoto[] {
  const value = JSON.parse(uni.getStorageSync(storageKey) || '[]')
  if (!Array.isArray(value)) throw new Error('本机照片队列无法读取。')
  return value
}
function change<T>(action: (rows: LocalPhoto[]) => T): T {
  const rows = readAll(), value = action(rows)
  uni.setStorageSync(storageKey, JSON.stringify(rows))
  return value
}
function removeFile(filePath?: string) {
  if (filePath) uni.removeSavedFile({ filePath, fail: () => {} })
}
export async function refreshUploads(owner: string) {
  uploadRows.value = readAll().filter(row => row.owner === owner).sort((a, b) => b.created - a.created)
}
export async function savePhoto(owner: string, file: string, mode: string, session: string, marking = false) {
  const info = await new Promise<UniApp.GetImageInfoSuccessData>((resolve, reject) => uni.getImageInfo({ src: file, success: resolve, fail: reject }))
  const size = await new Promise<number>((resolve, reject) => uni.getFileInfo({ filePath: file, success: result => resolve(result.size), fail: reject }))
  if (!['jpeg', 'jpg', 'png'].includes((info.type || '').toLowerCase()) || size > 50 * 1024 * 1024) throw new Error('请选择不超过 50 MB 的 JPEG 或 PNG 照片。')
  let saved: string | undefined
  try {
    saved = await new Promise<string>((resolve, reject) => uni.saveFile({ tempFilePath: file, success: result => resolve(result.savedFilePath), fail: reject }))
    const row: LocalPhoto = { id: createUuid(), owner, filePath: saved, name: file.split('/').pop() || 'photo', options: { admissionMode: mode, captureSessionId: session }, state: marking ? 'MARKING' : 'PENDING', created: Date.now() }
    change(rows => { rows.push(row) })
    uploadError.value = ''; await refreshUploads(owner); return row
  } catch {
    removeFile(saved)
    uploadError.value = '本机空间不足或无法保存，请停止拍摄并释放空间。此照片尚未安全保存。'
    throw new Error(uploadError.value)
  }
}
export async function markPhoto(id: string, owner: string, hint?: Hint) {
  change(rows => {
    const row = rows.find(item => item.id === id && item.owner === owner)
    if (!row || row.state !== 'MARKING') return
    row.options.targetHint = hint ? { kind: hint.kind, x: hint.x, y: hint.y, ...(hint.width === undefined ? {} : { width: hint.width }), ...(hint.height === undefined ? {} : { height: hint.height }) } : undefined
    row.state = 'PENDING'
  }); await refreshUploads(owner)
}
export async function updateSavedResult(id: string, owner: string, result: QuickView) {
  change(rows => { const row = rows.find(item => item.id === id && item.owner === owner && item.state === 'SAVED'); if (row) row.result = result })
}
export async function checkLocalStorage(owner: string) { await refreshUploads(owner); uploadError.value = '' }
export async function retryPhoto(id: string, owner: string) {
  change(rows => { const row = rows.find(item => item.id === id && item.owner === owner && item.state === 'ERROR'); if (row) { row.state = 'PENDING'; row.error = undefined; row.nextAttemptAt = 0 } })
}
export async function removePhotos(ids: string[], owner: string) {
  const wanted = new Set(ids)
  const removed = change(rows => {
    const removed = rows.filter(row => wanted.has(row.id) && row.owner === owner && row.state !== 'UPLOADING')
    const keys = new Set(removed.map(row => row.id))
    for (let i = rows.length - 1; i >= 0; i--) if (keys.has(rows[i].id)) rows.splice(i, 1)
    return removed
  })
  removed.forEach(row => removeFile(row.filePath)); await refreshUploads(owner)
}
export async function removePhoto(id: string, owner: string) { await removePhotos([id], owner) }
function claim(owner: string) {
  return change(rows => {
    if (rows.filter(row => row.state === 'UPLOADING' && (row.leaseUntil || 0) > Date.now()).length >= 2) return
    const row = rows.filter(row => row.owner === owner && (row.nextAttemptAt || 0) <= Date.now() && (row.state === 'PENDING' || row.state === 'UPLOADING' && (row.leaseUntil || 0) <= Date.now())).sort((a, b) => a.created - b.created)[0]
    if (row) { row.state = 'UPLOADING'; row.leaseOwner = workerId; row.leaseUntil = Date.now() + 30000 }
    return row
  })
}
function finish(row: LocalPhoto, result?: QuickView, error?: string, retrySoon = false) {
  const removed = change(rows => {
    const current = rows.find(item => item.id === row.id && item.leaseOwner === workerId)
    if (!current) return
    const path = result ? current.filePath : undefined
    Object.assign(current, { filePath: result ? undefined : current.filePath, state: result ? 'SAVED' : retrySoon ? 'PENDING' : 'ERROR', result, error, nextAttemptAt: retrySoon ? Date.now() + 5000 : 0, leaseUntil: 0 })
    return path
  })
  removeFile(removed)
}
function renew(row: LocalPhoto) {
  change(rows => { const current = rows.find(item => item.id === row.id && item.leaseOwner === workerId && item.state === 'UPLOADING'); if (current) current.leaseUntil = Date.now() + 30000 })
}
let pumpBusy = false
export async function pumpUploads(getOwner: () => string | undefined) {
  if (pumpBusy || !isOnline()) return
  pumpBusy = true
  try {
    const owner = getOwner(); if (!owner) return
    const rows: LocalPhoto[] = []
    for (let i = 0; i < 2; i++) { const row = claim(owner); if (row) rows.push(row) }
    if (rows.length && getOwner() === owner) await refreshUploads(owner)
    await Promise.all(rows.map(async row => {
      if (getOwner() !== owner) { finish(row, undefined, '账户已切换，请回到原账户重试。'); return }
      const heartbeat = setInterval(() => { try { renew(row) } catch { /* Lease will expire for safe retry. */ } }, 10000)
      try {
        if (!row.filePath) throw new Error('本机原图已丢失，请重新选择照片。')
        const result = await upload<QuickView>('/api/closet/quick-intakes', row.filePath, { name: 'file', idempotencyKey: row.id, headers: { 'X-Upload-Owner': owner }, formData: { options: JSON.stringify(row.options) } })
        if (!result.sourceSaved || result.intakeId !== row.id) throw new Error('服务器尚未确认保存')
        finish(row, result)
        if (getOwner() === owner) {
          await refreshUploads(owner)
          void closetApi.task(result.intakeId).then(task => { if (getOwner() === owner) useProcessingStore().trackTask(task) }).catch(() => {})
        }
      } catch (cause) {
        finish(row, undefined, cause instanceof Error ? cause.message : '未收到保存确认，可安全重试。', cause instanceof HttpError && cause.status === 0 || !isOnline())
      } finally { clearInterval(heartbeat); if (getOwner() === owner) await refreshUploads(owner) }
    }))
    if (getOwner() === owner) await refreshUploads(owner)
  } catch (cause) { uploadError.value = cause instanceof Error ? cause.message : '本机照片队列无法读取。' }
  finally { pumpBusy = false }
}
export const quickApi = {
  get: (id: string) => request<QuickView>(`/api/closet/quick-intakes/${id}`),
  provenance: (garment: string) => request<{ intakeId?: string }>(`/api/closet/quick-intakes/garment/${garment}`),
  enhance: (id: string, key: string, feedback: string) => request<QuickView>(`/api/closet/quick-intakes/${id}/enhance`, { method: 'POST', idempotencyKey: key, body: { feedback } }),
}
