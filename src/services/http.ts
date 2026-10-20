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
  return { Cookie: cookieHeader(), 'X-XSRF-TOKEN': await fetchCsrf() }
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

/** multipart upload of one local file (camera / album temp path) with extra form fields. */
export async function upload<T>(path: string, filePath: string, options: { name?: string; formData?: Record<string, string>; timeoutMs?: number; idempotencyKey?: string } = {}): Promise<T> {
  const header = await writeHeaders()
  if (options.idempotencyKey) header['Idempotency-Key'] = options.idempotencyKey
  const response = await new Promise<UniApp.UploadFileSuccessCallbackResult>((resolve, reject) => {
    uni.uploadFile({
      url: apiUrl(path), filePath, name: options.name ?? 'file', formData: options.formData, header, timeout: options.timeoutMs ?? 120000,
      success: resolve,
      fail: () => reject(new HttpError('上传中断，尚无法确认是否已提交。', 0, undefined, true)),
    })
  })
  storeCookies(response as unknown as { header?: Record<string, unknown> })
  let data: { code?: string; message?: string } & Record<string, unknown> = {}
  try { data = response.data ? JSON.parse(response.data) : {} } catch { /* non-JSON error page */ }
  if (response.statusCode >= 400) {
    if (response.statusCode === 401) uni.$emit('closet-session-expired')
    throw new HttpError(data.message || `上传失败 (${response.statusCode})`, response.statusCode, data.code, response.statusCode >= 500)
  }
  return data as T
}

/**
 * POST that streams `text/event-stream` back (assistant replies). WeChat delivers chunks through onChunkReceived;
 * other targets fall back to one response at the end. `onEvent` receives each parsed SSE event.
 */
export async function streamPost(path: string, body: unknown, onEvent: (event: { event: string; data: string }) => void, options: { timeoutMs?: number } = {}): Promise<void> {
  const header = { ...(await writeHeaders()), 'Content-Type': 'application/json', Accept: 'text/event-stream' }
  let buffer = ''
  const decoder = typeof TextDecoder === 'function' ? new TextDecoder('utf-8') : null
  const feed = (text: string) => {
    buffer += text
    let index
    while ((index = buffer.indexOf('\n\n')) >= 0) {
      const block = buffer.slice(0, index); buffer = buffer.slice(index + 2)
      let event = 'message'; const data: string[] = []
      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim()
        else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''))
      }
      if (data.length) onEvent({ event, data: data.join('\n') })
    }
  }
  const decode = (bytes: ArrayBuffer) => decoder ? decoder.decode(new Uint8Array(bytes), { stream: true }) : utf8(new Uint8Array(bytes))
  await new Promise<void>((resolve, reject) => {
    let chunked = false
    const task = uni.request({
      url: apiUrl(path), method: 'POST', header, data: body as UniApp.RequestOptions['data'], timeout: options.timeoutMs ?? 300000,
      // @ts-expect-error WeChat-only option
      enableChunked: true, responseType: 'arraybuffer',
      success: response => {
        storeCookies(response as unknown as { header?: Record<string, unknown> })
        if (response.statusCode >= 400) {
          if (response.statusCode === 401) uni.$emit('closet-session-expired')
          let message = `请求失败 (${response.statusCode})`
          try { message = (JSON.parse(decode(response.data as ArrayBuffer)) as { message?: string }).message || message } catch { /* keep default */ }
          reject(new HttpError(message, response.statusCode)); return
        }
        if (!chunked && response.data) feed(typeof response.data === 'string' ? response.data : decode(response.data as ArrayBuffer))
        feed('\n\n'); resolve()
      },
      fail: () => reject(new HttpError('连接中断，回复可能不完整。', 0, undefined, true)),
    }) as unknown as { onChunkReceived?: (cb: (r: { data: ArrayBuffer }) => void) => void }
    task?.onChunkReceived?.(chunk => { chunked = true; feed(decode(chunk.data)) })
  })
}

/** Minimal UTF-8 decoder for base libraries without TextDecoder; multi-byte sequences split across chunks are rare enough here. */
function utf8(bytes: Uint8Array): string {
  let out = '', i = 0
  while (i < bytes.length) {
    const c = bytes[i++]
    if (c < 0x80) out += String.fromCharCode(c)
    else if (c < 0xe0) out += String.fromCharCode(((c & 0x1f) << 6) | (bytes[i++] & 0x3f))
    else if (c < 0xf0) out += String.fromCharCode(((c & 0x0f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f))
    else {
      const point = (((c & 0x07) << 18) | ((bytes[i++] & 0x3f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f)) - 0x10000
      out += String.fromCharCode(0xd800 + (point >> 10), 0xdc00 + (point & 0x3ff))
    }
  }
  return out
}
