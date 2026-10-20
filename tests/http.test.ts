// Runs services/http.ts against a real server (CLOSET_TEST_SERVER, default http://127.0.0.1:8080) through a uni shim.
import { test } from 'node:test'
import assert from 'node:assert/strict'

const base = process.env.CLOSET_TEST_SERVER ?? 'http://127.0.0.1:8080'
const storage = new Map<string, string>()
;(globalThis as any).uni = {
  getStorageSync: (k: string) => storage.get(k) ?? '',
  setStorageSync: (k: string, v: string) => storage.set(k, v),
  removeStorageSync: (k: string) => storage.delete(k),
  $emit: () => {},
  request({ url, method, header, data, success, fail }: any) {
    fetch(url, { method, headers: header, body: data === undefined ? undefined : JSON.stringify(data) })
      .then(async r => { const text = await r.text(); let body: unknown = text; try { body = JSON.parse(text) } catch {}
        success({ statusCode: r.status, data: body, header: Object.fromEntries(r.headers), cookies: r.headers.getSetCookie() }) })
      .catch(fail)
  },
}
;(globalThis as any).import_meta_env = {}
const http = await import('../src/services/http.ts')

test('storeCookies parses joined Set-Cookie headers and expiry', () => {
  http.clearCookies()
  http.storeCookies({ header: { 'Set-Cookie': 'A=1; Path=/; Expires=Wed, 21 Oct 2026 07:28:00 GMT, B=2; HttpOnly' } })
  assert.equal(http.cookieHeader(), 'A=1; B=2')
  http.storeCookies({ cookies: ['A=; Max-Age=0'] })
  assert.equal(http.cookieHeader(), 'B=2')
})

test('write requests carry cookie + CSRF: wrong password gets 401, not CSRF 403', async (t) => {
  try { await fetch(base + '/api/health') } catch { t.skip('server not running'); return }
  http.setApiBase(base)
  await assert.rejects(http.request('/api/auth/login', { method: 'POST', body: { username: 'nobody-mp-test', password: 'x' } }),
    (e: any) => e.status === 401 && e.message.includes('账号或密码不正确'))
  assert.match(http.cookieHeader(), /XSRF-TOKEN=/)
})
