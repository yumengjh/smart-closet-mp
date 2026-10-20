import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

// Bundle the real services/stores together so Pinia and Vue keep one shared runtime.
const dir = await mkdtemp(join(tmpdir(), 'closet-mp-services-'))
const bundled = await build({ stdin: { contents: `
  export * from './src/services/api'; export * from './src/services/http';
  export * from './src/services/platform'; export * from './src/services/batches';
  export * from './src/services/quickIntake'; export * from './src/agent/api';
  export * from './src/recommend/api'; export * from './src/notifications/api';
  export * from './src/similar/api'; export * from './src/services/processing';
  export * from './src/stores/closet'; export * from './src/stores/processing';
  export * from './src/stores/preferences'; export * from './src/stores/theme';
  export * from './src/domain/workspace-registry'; export * from './src/domain/outfit-workspace';
  export { createPinia, setActivePinia } from 'pinia'; export { nextTick } from 'vue';
`, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', write: false, define: { 'import.meta.env': '{}' } })
const entry = join(dir, 'services.mjs')
await writeFile(entry, bundled.outputFiles[0].contents)
after(() => rm(dir, { recursive: true, force: true }))
const storage = new Map<string, string>()
const files = new Map<string, ArrayBuffer>()
const calls: any[] = [], events: string[] = []
const shows: (() => void)[] = [], hides: (() => void)[] = []
let dispatch: (options: any, task: any) => void = () => {}
const ok = (options: any, data: unknown, statusCode = 200) => options.success({ statusCode, data, header: {} })
;(globalThis as any).uni = {
  getStorageSync: (key: string) => storage.get(key) || '',
  setStorageSync: (key: string, value: string) => storage.set(key, value),
  removeStorageSync: (key: string) => storage.delete(key),
  $emit: (event: string) => events.push(event),
  onAppShow: (callback: () => void) => shows.push(callback),
  onAppHide: (callback: () => void) => hides.push(callback),
  onNetworkStatusChange: () => {},
  getFileSystemManager: () => ({ readFileSync: (path: string) => { const file = files.get(path); if (!file) throw new Error('missing file'); return file } }),
  getImageInfo: (options: any) => options.success({ type: 'jpeg', width: 200, height: 300, path: options.src }),
  getFileInfo: (options: any) => options.success({ size: 5 }),
  saveFile: (options: any) => { const path = '/saved/' + options.tempFilePath.split('/').pop(); files.set(path, new Uint8Array([1, 2]).buffer); options.success({ savedFilePath: path }) },
  removeSavedFile: (options: any) => { files.delete(options.filePath) },
  uploadFile: (options: any) => { calls.push(options); queueMicrotask(() => dispatch(options, {})); return { onProgressUpdate: (callback: any) => callback({ progress: 50 }) } },
  request(options: any) {
    calls.push(options)
    const task = { chunk: undefined as any, aborted: false, onChunkReceived(callback: any) { this.chunk = callback }, abort() { this.aborted = true; options.fail({ errMsg: 'abort' }) } }
    queueMicrotask(() => {
      if (options.url.endsWith('/api/auth/csrf')) { options.success({ statusCode: 200, data: { token: 'csrf' }, cookies: ['XSRF-TOKEN=csrf'], header: {} }); return }
      dispatch(options, task)
    })
    return task
  },
}
const app = await import(pathToFileURL(entry).href)
function reset(handler: typeof dispatch) {
  app.setActivePinia(app.createPinia()); calls.length = 0; events.length = 0
  dispatch = handler; app.setApiBase('https://closet.test')
}

const garmentView = { id: 'g', revision: 2, sourceAssetId: 's', displayAssetId: 'a', displayUrl: '/api/image', sourceUrl: '/api/source', sourceOrigin: 'USER_UPLOAD', images: [], automatic: { attributes: { category: { values: ['衬衫'], evidence: '领口' } } }, overrides: {}, effective: { category: ['衬衫'], primaryColor: ['浅蓝'] }, runs: [], status: 'ACTIVE', updatedAtMs: 1700000000000 }
const job = { id: 'j', status: 'RUNNING', createdAt: '2026-10-20T00:00:00Z', request: { garmentId: 'g' }, steps: [{ type: 'GENERATE', status: 'RUNNING' }], assets: [] }

test('ported contracts preserve garment mapping, plain bodies, keys and account endpoints', async () => {
  reset(options => {
    if (options.url.includes('/metadata')) ok(options, garmentView)
    else if (options.url.endsWith('/api/garments/g')) ok(options, garmentView)
    else if (options.url.includes('/recognize')) ok(options, job)
    else if (options.url.includes('/api/closet/garments?')) ok(options, { items: [garmentView], total: 1, page: 1, size: 20 })
    else ok(options, {})
  })
  app.storeCookies({ cookies: ['YIXU_SESSION=logged-in'] })
  const page = await app.closetApi.list({ status: 'ACTIVE', q: '蓝 衬衫', category: '', color: '', season: '', page: 1, size: 20 })
  assert.deepEqual(page.items[0].category, ['衬衫']); assert.equal(page.items[0].imageColor, '#a8c2d1')
  assert.match(calls.at(-1).url, /q=%E8%93%9D%20%E8%A1%AC%E8%A1%AB/)
  await app.closetApi.update('g', { fields: { category: ['外套'] }, resetFields: ['brand'] })
  assert.deepEqual(calls.at(-1).data, { revision: 2, fields: { category: ['外套'] }, resetFields: ['brand'] })
  assert.equal(calls.at(-1).header.Cookie, 'YIXU_SESSION=logged-in; XSRF-TOKEN=csrf')
  assert.equal(calls.at(-1).header['X-XSRF-TOKEN'], 'csrf')
  const task = await app.closetApi.recognize('g', '左边的外套')
  assert.equal(task.steps[0].name, 'AI 整理图片'); assert.ok(calls.at(-1).header['Idempotency-Key'])
  await app.closetApi.adminResetPassword('a/b')
  assert.equal(calls.at(-1).url, 'https://closet.test/api/admin/users/a%2Fb/password-reset')
  assert.deepEqual(calls.at(-1).data, {})
  await app.closetApi.consumePortableLogin('token')
  assert.deepEqual(calls.at(-1).data, { token: 'token' })
})

test('typed multipart includes JSON content type, binary original and idempotency without backend changes', async () => {
  reset(options => ok(options, { id: 'batch' }))
  files.set('/tmp/photo.png', new Uint8Array([0, 255, 1, 2]).buffer)
  const progress: number[] = []
  await app.batchApi.create('/tmp/photo.png', 'same-key', 'MULTIPLE', 'SMART', (value: number) => progress.push(value))
  const request = calls.at(-1), text = new TextDecoder().decode(request.data)
  assert.match(request.header['Content-Type'], /^multipart\/form-data; boundary=/)
  assert.match(text, /name="options"\r\nContent-Type: application\/json; charset=UTF-8\r\n\r\n\{"channel":"MULTIPLE","strategy":"SMART"\}/)
  assert.match(text, /name="file"; filename="photo.png"\r\nContent-Type: image\/png/)
  assert.ok(Buffer.from(request.data).includes(Buffer.from([0, 255, 1, 2])))
  assert.match(request.header.Cookie, /XSRF-TOKEN=csrf/); assert.equal(request.header['Idempotency-Key'], 'same-key'); assert.deepEqual(progress, [0, 100])
})

test('platform errors preserve status, code and uncertain only for possibly submitted writes', async () => {
  reset(options => ok(options, { code: 'DOWN', message: '稍后重试' }, 503))
  await assert.rejects(app.platformRequest('/api/me/profile', 'PUT', {}), (error: any) => error instanceof app.PlatformRequestError && error.uncertain && error.status === 503 && error.code === 'DOWN')
  await assert.rejects(app.platformRequest('/api/me/profile'), (error: any) => !error.uncertain)
  dispatch = options => options.url.endsWith('/api/auth/csrf') ? ok(options, {}, 401) : ok(options, {})
  // CSRF failures happen before a write is sent.
  const original = (globalThis as any).uni.request
  ;(globalThis as any).uni.request = (options: any) => { queueMicrotask(() => ok(options, {}, 401)); return {} }
  try { await assert.rejects(app.platformRequest('/api/me/profile', 'PUT', {}), (error: any) => !error.uncertain && error.status === 401) }
  finally { (globalThis as any).uni.request = original }
})

test('agent streaming survives single-byte Chinese/emoji and CRLF chunks and requires done', async () => {
  reset((options, task) => {
    const bytes = new TextEncoder().encode('event: delta\r\ndata: {"text":"你好👕"}\r\n\r\nevent: done\r\ndata: {}\r\n\r\n')
    for (const byte of bytes) task.chunk({ data: new Uint8Array([byte]).buffer })
    ok(options, new ArrayBuffer(0))
  })
  const received: any[] = []
  await app.streamMessage('session', { message: '搭配' }, (event: any) => received.push(event), new AbortController().signal)
  assert.deepEqual(received.map(event => event.event), ['delta', 'done'])
  assert.equal(received[0].data.text, '你好👕')
  dispatch = options => ok(options, new TextEncoder().encode('event: delta\ndata: {}\n\n').buffer)
  await assert.rejects(app.streamMessage('session', {}, () => {}, new AbortController().signal), /回复已中断/)
})

test('agent cancellation aborts request and maps HTTP failures to AgentRequestError', async () => {
  const controller = new AbortController(); let aborted = false
  reset((_options, task) => { const abort = task.abort.bind(task); task.abort = () => { aborted = true; abort() }; controller.abort() })
  await assert.rejects(app.streamMessage('session', {}, () => {}, controller.signal), (error: any) => error instanceof app.AgentRequestError && error.status === 0)
  assert.ok(aborted)
  dispatch = options => ok(options, { message: '额度不足' }, 429)
  await assert.rejects(app.agentRequest('/quota'), (error: any) => error instanceof app.AgentRequestError && error.status === 429)
})

test('quick intake keeps durable original and stable key after failure, isolates owners, releases it only after confirmation', async () => {
  reset(options => {
    if (options.url.endsWith('/api/closet/quick-intakes')) options.fail({ errMsg: 'timeout' })
    else ok(options, job)
  })
  const photo = await app.savePhoto('alice', '/tmp/intake.jpg', 'UPLOAD_READY', 'capture')
  assert.ok(files.has(photo.filePath))
  await app.pumpUploads(() => 'bob')
  assert.equal(calls.length, 0)
  await app.pumpUploads(() => 'alice')
  const first = calls.find(call => call.filePath)
  assert.equal(first.header['Idempotency-Key'], photo.id)
  assert.equal(first.header['X-Upload-Owner'], 'alice')
  await app.refreshUploads('alice')
  assert.equal(app.uploadRows.value[0].state, 'PENDING'); assert.ok(files.has(photo.filePath))
  // Simulate retry delay elapsed after a restart.
  const rows = JSON.parse(storage.get('yuda.quick-intake.v1')!); rows[0].nextAttemptAt = 0
  storage.set('yuda.quick-intake.v1', JSON.stringify(rows))
  dispatch = options => options.filePath ? ok(options, JSON.stringify({ intakeId: photo.id, garmentId: 'g', sourceSaved: true })) : ok(options, job)
  await app.pumpUploads(() => 'alice')
  await app.refreshUploads('alice')
  assert.equal(app.uploadRows.value[0].state, 'SAVED'); assert.equal(files.has(photo.filePath), false)
  assert.equal(calls.filter(call => call.filePath).at(-1).header['Idempotency-Key'], photo.id)
})

test('processing centre discovers batches and suppresses their child workflows', async () => {
  reset(options => {
    if (options.url.includes('/api/closet/tasks')) ok(options, [{ ...job, garmentId: 'g', title: '衣物', mode: '图片整理', steps: [] }])
    else if (options.url.endsWith('/api/closet/batches')) ok(options, [{ id: 'b', status: 'RUNNING', createdAtMs: Date.now(), sources: [], calls: [], targets: [{ jobId: 'j', status: 'RUNNING' }] }])
    else if (options.url.endsWith('/api/closet/batches/b')) ok(options, { id: 'b', status: 'RUNNING', createdAtMs: Date.now(), sources: [], calls: [], targets: [{ jobId: 'j', status: 'RUNNING' }] })
    else ok(options, [])
  })
  const store = app.useProcessingStore(); store.start('alice')
  try {
    for (let i = 0; i < 5; i++) await new Promise(resolve => setTimeout(resolve, 0))
    assert.equal(store.activeCount, 1); assert.equal(store.entries[0].kind, 'batch')
    assert.ok(calls.some(call => call.url.endsWith('/api/closet/batches')))
    store.trackTask({ ...job, garmentId: 'g', title: 'child', mode: '图片整理', steps: [] })
    assert.equal(store.entries.length, 1)
  } finally { store.stop() }
})

test('count refresh ignores stale responses after account switch', async () => {
  const responses: any[] = []
  reset(options => responses.push(options))
  const store = app.useClosetStore(); store.user = { username: 'alice', mustChangePassword: false }
  const pending = store.refreshCounts(); await Promise.resolve()
  store.user = { username: 'bob', mustChangePassword: false }
  for (const options of responses) ok(options, options.url.includes('/api/closet/tasks') ? [{ status: 'RUNNING', steps: [] }] : { items: [], total: 7 })
  await pending
  assert.equal(store.taskCount, 0); assert.equal(store.pendingCount, 0)
})

test('preferences persist and workspace pruning retains unsaved drafts', async () => {
  reset(options => ok(options, {}))
  const preferences = app.usePreferencesStore(), theme = app.useThemeStore()
  preferences.toggle(); theme.toggle(); await app.nextTick()
  assert.equal(storage.get('yuda.minimal.v1'), '1'); assert.equal(storage.get('yuda.theme.v1'), 'dark')
  app.registerAgentWorkspace('alice', 'agent:empty', 1)
  app.registerAgentWorkspace('alice', 'agent:draft', 1)
  storage.set('yixu.workspace.v1:alice:agent:draft', JSON.stringify({ boards: [{ scene: { elements: [{}] }, savedSignature: '' }] }))
  assert.deepEqual(app.pruneAgentWorkspaces('alice', app.AGENT_WORKSPACE_TTL_MS + 2), ['agent:empty'])
  assert.ok(app.listWorkspaces('alice').some((workspace: any) => workspace.id === 'agent:draft'))
})
