/**
 * Mini program transport. The server keeps the web session model (YIXU_SESSION cookie + Spring CSRF), so this layer
 * plays the browser's part: it keeps a cookie jar in storage, sends it on every request and fetches a CSRF token
 * before each write. Images under /api need the same cookies, which <image> cannot send: see services/media.ts.
 */
const JAR_KEY = 'yuda.cookies'
const BASE_KEY = 'yuda.api-base'

export class HttpError extends Error {
  readonly status: number
  readonly code?: string
  /** A write that may have reached the server (timeout, dropped connection, 5xx): the caller should re-check. */
  readonly uncertain: boolean
  constructor(message: string, status: number, code?: string, uncertain = false) {
    super(message); this.name = 'HttpError'; this.status = status; this.code = code; this.uncertain = uncertain
  }
}

// ---- server address -------------------------------------------------------------------------------------------

/** Build-time default, overridable at runtime from the login page so a demo build can point at any deployment. */
export function apiBase(): string {
  const saved = uni.getStorageSync(BASE_KEY) as string | ''
  return (saved || import.meta.env?.VITE_API_BASE_URL || '').replace(/\/$/, '')
}
export function setApiBase(base: string) {
  const value = base.trim().replace(/\/$/, '')
  if (value && !/^https?:\/\/[^/?#@\s]+$/.test(value)) throw new Error('服务地址只填协议和域名，例如 https://closet.example.com')
  if (value) uni.setStorageSync(BASE_KEY, value); else uni.removeStorageSync(BASE_KEY)
  clearCookies()
}
export function apiUrl(path: string): string {
  if (!/^\/api(?:\/|\?|$)/.test(path) || path.includes('\\') || path.includes('..')) throw new Error('无效的 API 路径。')
  return apiBase() + path
}
export function isApiMedia(path: string | null | undefined): path is string {
  if (!path) return false
  if (/^\/api(?:\/|\?|$)/.test(path)) return true
  const base = apiBase()
  return Boolean(base) && path.startsWith(base + '/api/')
}

// ---- cookie jar -----------------------------------------------------------------------------------------------

type Jar = Record<string, string>
let jar: Jar | null = null
function readJar(): Jar {
  if (!jar) { try { jar = JSON.parse(uni.getStorageSync(JAR_KEY) || '{}') as Jar } catch { jar = {} } }
  return jar
}
function writeJar() { uni.setStorageSync(JAR_KEY, JSON.stringify(jar ?? {})) }
export function clearCookies() { jar = {}; writeJar(); csrfToken = null }
export function cookieHeader(): string {
  return Object.entries(readJar()).map(([name, value]) => `${name}=${value}`).join('; ')
}

/** WeChat gives `cookies: string[]`; H5 and some base libraries only give a comma-joined Set-Cookie header. */
function collectSetCookie(response: { header?: Record<string, unknown>; cookies?: string[] }): string[] {
  if (Array.isArray(response.cookies) && response.cookies.length) return response.cookies
  const header = response.header ?? {}
  const raw = (header['Set-Cookie'] ?? header['set-cookie']) as string | string[] | undefined
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  // Split on commas that start a new cookie, not the ones inside Expires=Wed, 21 Oct ...
  return raw.split(/,(?=\s*[A-Za-z0-9_-]+=)/)
}
export function storeCookies(response: { header?: Record<string, unknown>; cookies?: string[] }) {
  const cookies = collectSetCookie(response)
  if (!cookies.length) return
  const current = readJar()
  for (const line of cookies) {
    const [pair, ...attributes] = line.split(';')
    const index = pair.indexOf('=')
    if (index <= 0) continue
    const name = pair.slice(0, index).trim(), value = pair.slice(index + 1).trim()
    const expired = attributes.some(a => /^\s*max-age\s*=\s*0\s*$/i.test(a)) || value === ''
    if (expired) delete current[name]; else current[name] = value
  }
  writeJar()
}

// ---- requests -------------------------------------------------------------------------------------------------

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'
export type RequestOptions = { method?: Method; body?: unknown; headers?: Record<string, string>; timeoutMs?: number; idempotencyKey?: string }

let csrfToken: string | null = null
const SESSION_OPEN_PATHS = ['/api/auth/login', '/api/auth/portable-login', '/api/auth/me', '/api/auth/register']

function raw(url: string, method: Method, header: Record<string, string>, data: unknown, timeout: number) {
  return new Promise<UniApp.RequestSuccessCallbackResult & { cookies?: string[] }>((resolve, reject) => {
    uni.request({
      url, method: method as UniApp.RequestOptions['method'], header, data: data as UniApp.RequestOptions['data'], timeout,
      success: response => resolve(response as UniApp.RequestSuccessCallbackResult & { cookies?: string[] }),
      fail: error => reject(error),
    })
  })
}

async function fetchCsrf(): Promise<string> {
  const response = await raw(apiUrl('/api/auth/csrf'), 'GET', { Cookie: cookieHeader() }, undefined, 15000)
  storeCookies(response)
  if (response.statusCode === 401) throw new HttpError('登录已失效，请重新登录。', 401)
  if (response.statusCode >= 400) throw new HttpError('无法获取提交凭证，请稍后重试。', response.statusCode)
  csrfToken = (response.data as { token: string }).token
  return csrfToken
}
export async function writeHeaders(): Promise<Record<string, string>> {
  const token = await fetchCsrf()
  return { Cookie: cookieHeader(), 'X-XSRF-TOKEN': token }
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase() as Method
  const write = !['GET', 'HEAD', 'OPTIONS'].includes(method)
  const header: Record<string, string> = { Accept: 'application/json', ...options.headers }
  if (options.body !== undefined) header['Content-Type'] = 'application/json'
  if (options.idempotencyKey) header['Idempotency-Key'] = options.idempotencyKey
  if (write) header['X-XSRF-TOKEN'] = await fetchCsrf()
  header.Cookie = cookieHeader()
  let response
  try { response = await raw(apiUrl(path), method, header, options.body, options.timeoutMs ?? 30000) }
  catch (cause) {
    const message = String((cause as { errMsg?: string })?.errMsg ?? '')
    throw new HttpError(/timeout/i.test(message) ? '请求超时，请核对提交结果。' : write ? '连接中断，尚无法确认提交结果。' : '暂时无法连接到服务，请检查网络后重试。', 0, undefined, write)
  }
  storeCookies(response)
  const status = response.statusCode
  if (status >= 400) {
    const data = (typeof response.data === 'object' && response.data ? response.data : {}) as { code?: string; message?: string; detail?: string }
    if (status === 401 && !SESSION_OPEN_PATHS.includes(path)) uni.$emit('closet-session-expired')
    if (status === 403 && data.code === 'PASSWORD_CHANGE_REQUIRED') uni.$emit('closet-password-change-required')
    throw new HttpError(data.message || data.detail || `请求失败 (${status})`, status, data.code, write && (status >= 500 || status === 408))
  }
  return (status === 204 ? undefined : response.data) as T
}

export type UploadOptions = {
  name?: string; formData?: Record<string, string>; timeoutMs?: number; idempotencyKey?: string
  headers?: Record<string, string>; onProgress?: (percent: number) => void
  /** Spring typed request parts require application/json for these fields. */
  jsonFields?: string[]
}

/** Multipart upload of a local file, preserving the web server's typed JSON parts. */
export async function upload<T>(path: string, filePath: string, options: UploadOptions = {}): Promise<T> {
  const header = { ...options.headers, ...(await writeHeaders()) }
  if (options.idempotencyKey) header['Idempotency-Key'] = options.idempotencyKey
  let response: { statusCode: number; data: unknown; header?: Record<string, unknown>; cookies?: string[] }
  options.onProgress?.(0)
  try {
    if (options.jsonFields?.length) {
      const boundary = `----yuda${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`
      header['Content-Type'] = `multipart/form-data; boundary=${boundary}`
      const body = multipart(filePath, boundary, options)
      response = await raw(apiUrl(path), 'POST', header, body, options.timeoutMs ?? 120000)
    } else {
      response = await new Promise<UniApp.UploadFileSuccessCallbackResult>((resolve, reject) => {
        const task = uni.uploadFile({
          url: apiUrl(path), filePath, name: options.name ?? 'file', formData: options.formData, header, timeout: options.timeoutMs ?? 120000,
          success: resolve, fail: reject,
        })
        task?.onProgressUpdate?.(event => options.onProgress?.(event.progress))
      })
    }
  } catch (cause) {
    if (cause instanceof Error && !('errMsg' in cause)) throw cause
    throw new HttpError('上传中断，尚无法确认是否已提交。', 0, undefined, true)
  }
  storeCookies(response)
  let data: { code?: string; message?: string; detail?: string } = {}
  try { data = typeof response.data === 'string' ? JSON.parse(response.data || '{}') : response.data as typeof data } catch { /* Non-JSON error page. */ }
  if (response.statusCode >= 400) {
    if (response.statusCode === 401) uni.$emit('closet-session-expired')
    if (response.statusCode === 403 && data?.code === 'PASSWORD_CHANGE_REQUIRED') uni.$emit('closet-password-change-required')
    throw new HttpError(data?.message || data?.detail || `上传失败 (${response.statusCode})`, response.statusCode, data?.code, response.statusCode >= 500 || response.statusCode === 408)
  }
  options.onProgress?.(100)
  return (response.statusCode === 204 ? undefined : data) as T
}

function multipart(filePath: string, boundary: string, options: UploadOptions): ArrayBuffer {
  const pieces: Uint8Array[] = []
  const append = (value: string) => pieces.push(encodeUtf8(value))
  const safe = (value: string) => value.replace(/[\r\n"\\]/g, '_')
  for (const [key, value] of Object.entries(options.formData ?? {})) {
    append(`--${boundary}\r\nContent-Disposition: form-data; name="${safe(key)}"\r\n${options.jsonFields?.includes(key) ? 'Content-Type: application/json; charset=UTF-8\r\n' : ''}\r\n${value}\r\n`)
  }
  const filename = filePath.split('/').pop() || 'photo'
  const mime = /\.png$/i.test(filename) ? 'image/png' : /\.jpe?g$/i.test(filename) ? 'image/jpeg' : 'application/octet-stream'
  append(`--${boundary}\r\nContent-Disposition: form-data; name="${safe(options.name ?? 'file')}"; filename="${safe(filename)}"\r\nContent-Type: ${mime}\r\n\r\n`)
  const file = uni.getFileSystemManager().readFileSync(filePath)
  if (typeof file === 'string') throw new Error('无法读取照片原始数据。')
  pieces.push(new Uint8Array(file))
  append(`\r\n--${boundary}--\r\n`)
  const bytes = new Uint8Array(pieces.reduce((length, part) => length + part.length, 0))
  let offset = 0
  for (const part of pieces) { bytes.set(part, offset); offset += part.length }
  return bytes.buffer
}

function encodeUtf8(value: string): Uint8Array {
  const bytes: number[] = []
  for (const char of value) {
    const c = char.codePointAt(0)!
    if (c < 0x80) bytes.push(c)
    else if (c < 0x800) bytes.push(0xc0 | c >> 6, 0x80 | c & 63)
    else if (c < 0x10000) bytes.push(0xe0 | c >> 12, 0x80 | c >> 6 & 63, 0x80 | c & 63)
    else bytes.push(0xf0 | c >> 18, 0x80 | c >> 12 & 63, 0x80 | c >> 6 & 63, 0x80 | c & 63)
  }
  return new Uint8Array(bytes)
}

/** Streaming UTF-8 decoder for base libraries without a native decoder, including split multibyte characters. */
function createDecoder() {
  let pending = new Uint8Array(0)
  return (buffer: ArrayBuffer, final = false) => {
    const bytes = new Uint8Array(pending.length + buffer.byteLength)
    bytes.set(pending); bytes.set(new Uint8Array(buffer), pending.length)
    let out = '', i = 0
    while (i < bytes.length) {
      const start = i, c = bytes[i++]
      const count = c < 0x80 ? 0 : c >= 0xc2 && c < 0xe0 ? 1 : c >= 0xe0 && c < 0xf0 ? 2 : c >= 0xf0 && c < 0xf5 ? 3 : -1
      if (count < 0) { out += '\ufffd'; continue }
      if (bytes.length - i < count) { i = start; break }
      let point = c & (count === 0 ? 127 : (1 << (6 - count)) - 1)
      let valid = true
      for (let j = 0; j < count; j++) {
        if ((bytes[i] & 0xc0) !== 0x80) { valid = false; break }
        point = point << 6 | bytes[i++] & 63
      }
      if (!valid || count === 1 && point < 0x80 || count === 2 && (point < 0x800 || point >= 0xd800 && point <= 0xdfff) || count === 3 && (point < 0x10000 || point > 0x10ffff)) out += '\ufffd'
      else out += String.fromCodePoint(point)
    }
    pending = bytes.slice(i)
    if (final && pending.length) { out += '\ufffd'; pending = new Uint8Array(0) }
    return out
  }
}

export type StreamOptions = { timeoutMs?: number; signal?: AbortSignal }
/** POST with cookie/CSRF, chunked SSE parsing and cancellation of the underlying request task. */
export async function streamPost(path: string, body: unknown, onEvent: (event: { event: string; data: string }) => void, options: StreamOptions = {}): Promise<void> {
  const aborted = () => new HttpError('回复已中断。消息可能已经计入额度，请查看会话后再主动重试。', 0, undefined, true)
  if (options.signal?.aborted) throw aborted()
  const header = { ...(await writeHeaders()), 'Content-Type': 'application/json', Accept: 'text/event-stream' }
  if (options.signal?.aborted) throw aborted()
  let buffer = ''
  const decode = createDecoder()
  const feed = (value: string) => {
    buffer += value
    // Normalize only complete CRLF pairs so a pair split between chunks is preserved.
    buffer = buffer.replace(/\r\n/g, '\n')
    let index: number
    while ((index = buffer.indexOf('\n\n')) >= 0) {
      const block = buffer.slice(0, index); buffer = buffer.slice(index + 2)
      if (block.length > 200000) throw new Error('回复数据过大。')
      let event = 'message'; const data: string[] = []
      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim()
        else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''))
      }
      if (data.length) onEvent({ event, data: data.join('\n') })
    }
    if (buffer.length > 200000) throw new Error('回复数据过大。')
  }
  await new Promise<void>((resolve, reject) => {
    let chunked = false, settled = false
    let task: { abort?: () => void; onChunkReceived?: (cb: (r: { data: ArrayBuffer }) => void) => void } | undefined
    const finish = (error?: unknown) => {
      if (settled) return
      settled = true; options.signal?.removeEventListener('abort', abort)
      if (error) reject(error); else resolve()
    }
    const abort = () => { finish(aborted()); task?.abort?.() }
    options.signal?.addEventListener('abort', abort, { once: true })
    task = uni.request({
      url: apiUrl(path), method: 'POST', header, data: body as UniApp.RequestOptions['data'], timeout: options.timeoutMs ?? 300000,
      enableChunked: true, responseType: 'arraybuffer',
      success: (response: UniApp.RequestSuccessCallbackResult) => {
        if (settled) return
        try {
          storeCookies(response as unknown as { header?: Record<string, unknown>; cookies?: string[] })
          if (response.statusCode >= 400) {
            let data: { message?: string; code?: string } = {}
            try { data = JSON.parse(typeof response.data === 'string' ? response.data : decode(response.data as ArrayBuffer, true)) } catch { /* Keep default message. */ }
            if (response.statusCode === 401) uni.$emit('closet-session-expired')
            if (data.code === 'PASSWORD_CHANGE_REQUIRED') uni.$emit('closet-password-change-required')
            finish(new HttpError(data.message || `请求失败 (${response.statusCode})`, response.statusCode, data.code, response.statusCode >= 500 || response.statusCode === 408)); return
          }
          if (!chunked && response.data) feed(typeof response.data === 'string' ? response.data : decode(response.data as ArrayBuffer))
          feed(decode(new ArrayBuffer(0), true)); finish()
        } catch (error) { finish(error) }
      },
      fail: () => finish(new HttpError('连接中断，回复可能不完整。', 0, undefined, true)),
    } as UniApp.RequestOptions & { enableChunked: boolean }) as unknown as typeof task
    task?.onChunkReceived?.(chunk => {
      if (settled) return
      try { chunked = true; feed(decode(chunk.data)) }
      catch (error) { finish(error); task?.abort?.() }
    })
    if (options.signal?.aborted) abort()
  })
}
