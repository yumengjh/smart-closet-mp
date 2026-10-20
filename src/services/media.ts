/**
 * <image> cannot send the session cookie, so images under /api are downloaded with it first and shown from the
 * temp file. Downloads are cached per URL for the life of the app and limited to a few at a time (WeChat allows 10
 * concurrent network tasks in total, shared with requests).
 */
import { apiUrl, cookieHeader, isApiMedia, storeCookies } from './http'
import { variantPath } from '../domain/image-variants'

const MAX_PARALLEL = 4
const cache = new Map<string, Promise<string>>()
const queue: (() => void)[] = []
let running = 0

function next() {
  if (running >= MAX_PARALLEL) return
  const job = queue.shift()
  if (job) { running++; job() }
}

function download(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    queue.push(() => uni.downloadFile({
      url, header: { Cookie: cookieHeader() },
      success: response => {
        storeCookies(response as unknown as { header?: Record<string, unknown> })
        if (response.statusCode === 200 && response.tempFilePath) resolve(response.tempFilePath)
        else {
          if (response.statusCode === 401) uni.$emit('closet-session-expired')
          reject(new Error(`图片加载失败 (${response.statusCode})`))
        }
      },
      fail: () => reject(new Error('图片加载失败')),
      complete: () => { running--; next() },
    }))
    next()
  })
}

/** Local path for any image the server returns: /api paths are downloaded with cookies, others pass through. */
export function resolveMedia(path: string | null | undefined, width?: number): Promise<string> {
  if (!path) return Promise.reject(new Error('没有图片'))
  const sized = width ? variantPath(path, width) : path
  if (!isApiMedia(sized)) return Promise.resolve(sized)
  const url = sized.startsWith('/api') ? apiUrl(sized) : sized
  let pending = cache.get(url)
  if (!pending) {
    pending = download(url)
    pending.catch(() => cache.delete(url))
    cache.set(url, pending)
  }
  return pending
}

/** Drop cached copies after an image changes on the server (re-processing, new sticker). */
export function forgetMedia(path?: string) {
  if (!path) { cache.clear(); return }
  for (const key of [...cache.keys()]) if (key.includes(path)) cache.delete(key)
}
