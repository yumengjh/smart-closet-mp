import { test } from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'

// Bundle the real helpers with the shared scene domain so the test checks the exact web data contract.
const bundled = await build({ stdin: { contents: `
  export * from './src/components/outfit/board-geometry';
  export * from './src/domain/outfit';
  export * from './src/components/assistant/chat-helpers';
`, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', write: false, external: ['vue'] })
const code = bundled.outputFiles[0].text
const lib = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'))

const item = (id: string, overrides: Record<string, unknown> = {}) => ({
  garmentId: id, elementId: id, kind: 'GARMENT', assetId: 'a' + id, role: 'TOP', x: 400, y: 500, width: 400, height: 500,
  rotation: 0, zIndex: 0, garmentLabel: id, cropX: 0, cropY: 0, cropWidth: 1, cropHeight: 1, flipX: false, freeStretch: false,
  assetUrl: '/x.png', imageWidth: 400, imageHeight: 500, assetKind: 'SEGMENT', ...overrides,
})

test('single-sticker drag moves by the board delta and keeps size', () => {
  const [moved, other] = lib.gestureElements([item('a'), item('b', { x: 100 })], ['a'], { x: 30, y: -20 })
  assert.equal(moved.x, 430); assert.equal(moved.y, 480); assert.equal(moved.width, 400)
  assert.equal(other.x, 100)
})

test('drag is clamped to the 1080x1350 board', () => {
  const [moved] = lib.gestureElements([item('a')], ['a'], { x: 5000, y: -5000 })
  assert.equal(moved.x, 1080); assert.equal(moved.y, 0)
})

test('pinch scales a group around its centre and keeps the relative geometry', () => {
  const items = [item('a', { x: 300, y: 400 }), item('b', { x: 500, y: 400, zIndex: 1 })]
  const [a, b] = lib.gestureElements(items, ['a', 'b'], { x: 0, y: 0 }, 2)
  assert.equal(b.x - a.x, 400); assert.equal(a.width, 800); assert.equal(a.height, 1000); assert.equal((a.x + b.x) / 2, 400)
})

test('pinch factor is clamped by the web size limits', () => {
  const [big] = lib.gestureElements([item('a')], ['a'], { x: 0, y: 0 }, 100)
  assert.equal(big.width, 2160); assert.equal(big.height, 2700)
  const [small] = lib.gestureElements([item('a')], ['a'], { x: 0, y: 0 }, 0.001)
  assert.ok(small.width >= 24 && small.height >= 24)
})

test('empty selection leaves the scene untouched', () => {
  const items = [item('a')]
  assert.deepEqual(lib.gestureElements(items, [], { x: 10, y: 10 }, 3), items)
  assert.deepEqual(lib.selectionCenter([]), { x: 540, y: 675 })
})

test('frame style uses the same centre-based percentages as the web board', () => {
  const style = lib.frameStyle(item('a', { x: 540, y: 675, width: 540, height: 675, rotation: 30, zIndex: 2 }))
  assert.equal(style.left, '50%'); assert.equal(style.top, '50%'); assert.equal(style.width, '50%'); assert.equal(style.height, '50%')
  assert.equal(style.transform, 'translate(-50%, -50%) rotate(30deg)'); assert.equal(style.zIndex, 3)
})

test('crop patch keeps the crop window inside the image', () => {
  const patch = lib.cropPatch(item('a', { cropX: 0.5 }), 'width', 100)
  assert.equal(patch.cropWidth, 0.5); assert.equal(patch.cropX, 0.5)
  assert.equal(lib.cropPatch(item('a'), 'x', 200).cropX, 0.99)
})

test('gesture result round-trips through the web scene writer unchanged', () => {
  const scene = lib.normalizeScene({ version: 2, elements: [item('a'), item('b', { x: 700, zIndex: 1, rotation: 45 })] })
  const moved = lib.normalizeScene({ version: 2, elements: lib.gestureElements(scene.elements, ['a', 'b'], { x: 12.5, y: -7 }, 1.1) })
  const written = lib.sceneWrite(moved)
  for (const element of written.elements) {
    assert.ok(!('assetUrl' in element)); assert.ok(!('imageWidth' in element))
    for (const key of ['x', 'y', 'width', 'height', 'rotation']) assert.ok(Number.isFinite(element[key]), key)
  }
  // Reading back what was written yields the same placement values (web reads the same server payload).
  const again = lib.normalizeScene(written)
  assert.deepEqual(again.elements.map((e: any) => [e.elementId, e.x, e.y, e.width, e.height, e.rotation, e.zIndex]),
    moved.elements.map((e: any) => [e.elementId, e.x, e.y, e.width, e.height, e.rotation, e.zIndex]))
})

test('assistant context maps mini program entry to the web route', () => {
  assert.equal(lib.assistantRoute('workspace'), '/outfits/workspace')
  assert.equal(lib.assistantRoute('outfits'), '/outfits')
  assert.equal(lib.assistantRoute('garment', 'g1'), '/garment/g1')
  assert.equal(lib.assistantRoute('nope'), '/assistant')
  assert.equal(lib.assistantContextName({ route: '/wardrobe' }), '我的衣柜')
  assert.equal(lib.assistantContextName({ route: '/garment/g1', garmentId: 'g1' }), '当前衣物详情')
  assert.equal(lib.assistantContextName({ route: '/x' }), '当前页面')
})
