<script setup lang="ts">
import { computed, getCurrentInstance, nextTick, ref, watch } from 'vue'
import { useToast } from 'wot-design-uni'
import { closetApi, fieldLabels, type Garment } from '../../services/api'
import { resolveMedia } from '../../services/media'
import { navigateOutfitLink } from '../../services/outfit'
import { mutateBoard, type WorkspaceBoard } from '../../domain/outfit-workspace'
import { copySticker, elementKey, normalizeScene, reorderOutfitElements, stickerLimit, type OutfitElement, type OutfitLayerMove } from '../../domain/outfit'
import { createOutfitElement, loadOutfitImage } from '../../domain/outfit-images'
import { createPersonElement, type PersonPart } from '../../domain/person-stickers'
import { arrangeOutfit } from '../../domain/outfit-layout'
import { clamp, frameStyle, gestureElements, imageCropStyle, type Point } from './board-geometry'
import AuthImage from '../AuthImage.vue'
import OutfitMaterials from './OutfitMaterials.vue'
import OutfitInspector from './OutfitInspector.vue'
const props = defineProps<{ board: WorkspaceBoard }>()
const selector = `board-${Math.random().toString(36).slice(2)}`, toast = useToast(selector)
const instance = getCurrentInstance(), boardWidth = ref(Math.min(680, uni.getSystemInfoSync().windowWidth - 64)), zoom = ref(1)
const pickerOpen = ref(false), inspectorOpen = ref(false), layersOpen = ref(false), helpOpen = ref(false), replacing = ref(''), adding = ref(false), exporting = ref(false)
const selected = computed(() => props.board.scene.elements.filter(e => props.board.selectedIds.includes(elementKey(e))))
const activeId = computed(() => props.board.selectedIds[props.board.selectedIds.length - 1] || '')
const current = computed(() => selected.value[selected.value.length - 1]), selectedIndex = computed(() => props.board.scene.elements.findIndex(e => elementKey(e) === activeId.value))
const canForward = computed(() => selectedIndex.value >= 0 && selectedIndex.value < props.board.scene.elements.length - 1), canBackward = computed(() => selectedIndex.value > 0)
const multiSelect = ref(false), preview = ref<OutfitElement[] | null>(null), elements = computed(() => preview.value || props.board.scene.elements)
const failedImage = ref(''), imageLoading = ref(false)
const infoOpen = ref(false), infoLoading = ref(false), infoError = ref(''), info = ref<Garment | null>(null)
const infoFields = computed(() => info.value ? Object.entries(fieldLabels).map(([key, label]) => ({ key, label, value: (info.value![key as keyof typeof fieldLabels] || []).join('、') })).filter(row => row.value) : [])
const keyFor = elementKey
let imageTicket = 0
async function checkImages() { const ticket = ++imageTicket; const urls = [...new Set(props.board.scene.elements.map(e => e.assetUrl))]; failedImage.value = ''; imageLoading.value = !!urls.length; const results = await Promise.allSettled(urls.map(loadOutfitImage)); if (ticket !== imageTicket) return; if (results.some(r => r.status === 'rejected')) failedImage.value = '部分贴纸图片暂时无法加载，请重试。图片全部加载后才能导出。'; imageLoading.value = false }
watch(() => props.board.scene.elements.map(e => e.assetUrl).join('|'), checkImages, { immediate: true })
watch(() => props.board.id, () => { preview.value = null; gesture = null; pickerOpen.value = false; inspectorOpen.value = false; replacing.value = ''; zoom.value = 1 })
function change(next: OutfitElement[], source = 'manual-edit') { if (props.board.locked || JSON.stringify(next) === JSON.stringify(props.board.scene.elements)) return; mutateBoard(props.board, { ...props.board.scene, elements: next }, true, source); props.board.selectedIds = props.board.selectedIds.filter(id => next.some(e => elementKey(e) === id)) }
function select(id: string, additive = multiSelect.value) { if (props.board.locked) return; props.board.selectedIds = additive ? props.board.selectedIds.includes(id) ? props.board.selectedIds.filter(key => key !== id) : [...props.board.selectedIds, id] : [id] }
function clearSelection() { if (!props.board.locked) props.board.selectedIds = [] }
function resetLayout() { if (!props.board.scene.elements.length || props.board.locked) return; change(arrangeOutfit(props.board.scene).elements, 'default-layout'); props.board.selectedIds = [] }
function patch(patch: Partial<OutfitElement>) { change(props.board.scene.elements.map(e => props.board.selectedIds.includes(elementKey(e)) ? { ...e, ...patch } : e)) }
function scale(factor: number) { change(gestureElements(props.board.scene.elements, props.board.selectedIds, { x: 0, y: 0 }, factor)) }
function offset(x: number, y: number) { change(gestureElements(props.board.scene.elements, props.board.selectedIds, { x, y })) }
function rotate(angle: number, relative: boolean) { change(props.board.scene.elements.map(e => props.board.selectedIds.includes(elementKey(e)) ? { ...e, rotation: ((relative ? e.rotation + angle : angle) % 360 + 360) % 360 } : e)) }
function flip() { change(props.board.scene.elements.map(e => props.board.selectedIds.includes(elementKey(e)) ? { ...e, flipX: !e.flipX } : e)) }
function moveLayer(direction: OutfitLayerMove, id = activeId.value) { change(reorderOutfitElements(props.board.scene.elements, id, direction)) }
function remove() { change(props.board.scene.elements.filter(e => !props.board.selectedIds.includes(elementKey(e)))); inspectorOpen.value = false; replacing.value = '' }
function duplicate() { const items = [...props.board.scene.elements], ids: string[] = []; for (const item of selected.value) { const limit = stickerLimit(items, item.kind || 'GARMENT'); if (limit) { toast.warning(limit); return } const copy = copySticker(item, items.length); ids.push(elementKey(copy)); items.push(copy) } change(items); props.board.selectedIds = ids }
function undo() { if (props.board.locked) return; const previous = props.board.undo.pop(); if (!previous) return; props.board.redo.push(props.board.scene.elements.map(e => ({ ...e }))); mutateBoard(props.board, { ...props.board.scene, elements: previous }, false, 'undo'); props.board.selectedIds = [] }
function redo() { if (props.board.locked) return; const next = props.board.redo.pop(); if (!next) return; props.board.undo.push(props.board.scene.elements.map(e => ({ ...e }))); mutateBoard(props.board, { ...props.board.scene, elements: next }, false, 'redo'); props.board.selectedIds = [] }
function replace() { replacing.value = activeId.value; inspectorOpen.value = false; pickerOpen.value = true }
async function addGarment(g: Garment) {
  const board = props.board, target = replacing.value
  if (adding.value || board.locked) return
  const existing = board.scene.elements.find(e => e.kind !== 'PERSON_PART' && e.garmentId === g.id)
  if (existing && !target) { select(elementKey(existing), false); pickerOpen.value = false; return }
  const old = board.scene.elements.find(e => elementKey(e) === target), limit = !old ? stickerLimit(board.scene.elements, 'GARMENT') : null
  if (limit) { toast.warning(limit); return }
  adding.value = true
  try {
    const candidate = await createOutfitElement(g, board.scene.elements)
    if (board.id !== props.board.id || board.locked || target !== replacing.value) return
    const laterLimit = !old ? stickerLimit(board.scene.elements, 'GARMENT') : null; if (laterLimit) throw new Error(laterLimit)
    let next = [...board.scene.elements]
    if (old) { const index = next.findIndex(e => elementKey(e) === target); if (index < 0) return; next[index] = { ...candidate, elementId: old.elementId, role: old.role, x: old.x, y: old.y, width: old.width, height: old.height, rotation: old.rotation, zIndex: old.zIndex, flipX: old.flipX, freeStretch: old.freeStretch } }
    else { next.push(candidate); if (!board.outfitId) next = arrangeOutfit({ ...board.scene, elements: next }).elements }
    change(next); select(old ? elementKey(old) : elementKey(candidate), false); replacing.value = ''; pickerOpen.value = false; toast.success(old ? '已替换衣物，保留原来的布局。' : `${candidate.garmentLabel}已加入画板。`)
  } catch (e) { toast.error(e instanceof Error ? e.message : '衣物图片暂时无法加载。') } finally { adding.value = false }
}
async function addPerson(part: PersonPart) { const board = props.board; if (adding.value || board.locked) return; const limit = stickerLimit(board.scene.elements, 'PERSON_PART'); if (limit) { toast.warning(limit); return } adding.value = true; try { await loadOutfitImage(part.url); if (board.id !== props.board.id || board.locked) return; const laterLimit = stickerLimit(board.scene.elements, 'PERSON_PART'); if (laterLimit) throw new Error(laterLimit); const item = createPersonElement(part, board.scene.elements.length); change([...board.scene.elements, item]); select(elementKey(item), false); pickerOpen.value = false } catch (e) { toast.error(e instanceof Error ? e.message : '人物贴纸无法加载。') } finally { adding.value = false } }
async function showInfo() { if (!current.value?.garmentId) return; const id = current.value.garmentId; infoOpen.value = true; infoLoading.value = true; infoError.value = ''; info.value = null; try { info.value = await closetApi.detail(id) } catch (e) { infoError.value = e instanceof Error ? e.message : '衣物信息暂时无法加载。' } finally { infoLoading.value = false } }
function fullInfo() { if (info.value) navigateOutfitLink('/garment/' + info.value.id) }
// Keep touch previews outside the persisted scene; one gesture creates exactly one undo step.
type Touch = { clientX?: number; clientY?: number; pageX?: number; pageY?: number; x?: number; y?: number }
type GestureEvent = { touches: Touch[] }
const touchesOf = (event: any): GestureEvent => ({ touches: Array.from(event?.touches || []) as Touch[] })
function point(t: Touch): Point { return { x: t.clientX ?? t.pageX ?? t.x ?? 0, y: t.clientY ?? t.pageY ?? t.y ?? 0 } }
function midpoint(touches: Touch[]) { const a = point(touches[0]), b = touches[1] ? point(touches[1]) : a; return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } }
function distance(touches: Touch[]) { if (touches.length < 2) return 0; const a = point(touches[0]), b = point(touches[1]); return Math.hypot(a.x - b.x, a.y - b.y) }
let gesture: { boardId: string; initial: OutfitElement[]; base: OutfitElement[]; ids: string[]; origin: Point; distance: number; moved: boolean } | null = null
function startGesture(event: GestureEvent, id: string) {
  if (props.board.locked || !event.touches.length) return
  if (!gesture) {
    if (!props.board.selectedIds.includes(id)) select(id, false)
    const items = props.board.scene.elements.map(e => ({ ...e }))
    gesture = { boardId: props.board.id, initial: items, base: items, ids: [...props.board.selectedIds], origin: midpoint(event.touches), distance: distance(event.touches), moved: false }
  } else if (event.touches.length > 1) { gesture.base = (preview.value || elements.value).map(e => ({ ...e })); gesture.origin = midpoint(event.touches); gesture.distance = distance(event.touches) }
}
function moveGesture(event: GestureEvent) {
  if (!gesture || !event.touches.length || props.board.locked) return
  if (event.touches.length > 1 && !gesture.distance) { gesture.base = (preview.value || elements.value).map(e => ({ ...e })); gesture.origin = midpoint(event.touches); gesture.distance = distance(event.touches); return }
  const p = midpoint(event.touches), pxScale = boardWidth.value * zoom.value / 1080
  const offset = { x: (p.x - gesture.origin.x) / pxScale, y: (p.y - gesture.origin.y) / pxScale }, factor = event.touches.length > 1 && gesture.distance ? distance(event.touches) / gesture.distance : 1
  if (Math.hypot(offset.x, offset.y) > 2 || Math.abs(factor - 1) > .005) gesture.moved = true
  preview.value = gestureElements(gesture.base, gesture.ids, offset, factor)
}
function endGesture() { const value = gesture; if (value && value.boardId === props.board.id && !props.board.locked && value.moved && preview.value) change(preview.value, 'touch-transform'); preview.value = null; gesture = null }
function cancelGesture() { preview.value = null; gesture = null }
function inspect(id: string) { select(id, false); inspectorOpen.value = true }
function fit() { zoom.value = 1 }
// A native 2d canvas is used only for export. All media is resolved through the cookie-aware service first.
async function exportPng() {
  if (!props.board.scene.elements.length || exporting.value) return
  exporting.value = true
  try {
    await nextTick()
    const node = await new Promise<any>((resolve, reject) => uni.createSelectorQuery().in(instance?.proxy as any).select('#outfit-export').fields({ node: true, size: true } as any, (result: any) => result?.node ? resolve(result.node) : reject(new Error('画板尚未就绪，请在微信中重试导出。'))).exec())
    node.width = 1080; node.height = 1350
    const context = node.getContext('2d'); context.fillStyle = '#ffffff'; context.fillRect(0, 0, 1080, 1350)
    for (const item of [...props.board.scene.elements].sort((a, b) => a.zIndex - b.zIndex)) {
      const path = await resolveMedia(item.assetUrl)
      const image = await new Promise<any>((resolve, reject) => { const i = node.createImage(); i.onload = () => resolve(i); i.onerror = () => reject(new Error('贴纸图片暂时无法加载，请重试。')); i.src = path })
      context.save(); context.translate(item.x, item.y); context.rotate(item.rotation * Math.PI / 180); if (item.flipX) context.scale(-1, 1)
      context.drawImage(image, item.cropX * image.width, item.cropY * image.height, item.cropWidth * image.width, item.cropHeight * image.height, -item.width / 2, -item.height / 2, item.width, item.height); context.restore()
    }
    const path = await new Promise<string>((resolve, reject) => uni.canvasToTempFilePath({ canvas: node, width: 1080, height: 1350, destWidth: 1080, destHeight: 1350, fileType: 'png', success: (result: any) => resolve(result.tempFilePath), fail: reject } as any, instance?.proxy))
    await new Promise<void>((resolve, reject) => uni.saveImageToPhotosAlbum({ filePath: path, success: () => resolve(), fail: reject }))
    toast.success('搭配图片已保存到相册。')
  } catch (e) { const msg = String((e as { errMsg?: string })?.errMsg || ''); toast.error(/auth|deny/i.test(msg) ? '请在微信设置中允许保存到相册后重试。' : e instanceof Error ? e.message : '导出图片失败，请重试。') } finally { exporting.value = false }
}
defineExpose({ exportPng, clearSelection })
</script>
<template><view class="editor">
  <view class="toolbar"><view class="actions"><wd-button size="small" plain :disabled="!board.undo.length || !!board.locked" @click="undo">撤销</wd-button><wd-button size="small" plain :disabled="!board.redo.length || !!board.locked" @click="redo">重做</wd-button></view><view class="actions"><wd-button type="text" size="small" @click="zoom = clamp(zoom / 1.2, .5, 3)">−</wd-button><text class="small">{{ Math.round(zoom * 100) }}%</text><wd-button type="text" size="small" @click="zoom = clamp(zoom * 1.2, .5, 3)">＋</wd-button><wd-button type="text" size="small" @click="fit">适应</wd-button></view></view>
  <view v-if="failedImage" class="notice warning">{{ failedImage }}<wd-button type="text" @click="checkImages">重试</wd-button></view>
  <scroll-view scroll-x scroll-y class="board-scroll"><view class="board-area" :style="{ width: boardWidth * zoom + 'px', height: boardWidth * zoom * 1.25 + 'px' }"><view class="board" :style="{ width: boardWidth * zoom + 'px', height: boardWidth * zoom * 1.25 + 'px' }" @tap="clearSelection">
    <view v-for="item in elements" :key="keyFor(item)" class="sticker" :class="{ selected: board.selectedIds.includes(keyFor(item)) }" :style="frameStyle(item)" @tap.stop="select(keyFor(item))" @longpress.stop="inspect(keyFor(item))" @touchstart.stop="startGesture(touchesOf($event), keyFor(item))" @touchmove.stop.prevent="moveGesture(touchesOf($event))" @touchend.stop="endGesture" @touchcancel.stop="cancelGesture"><view class="artwork" :style="{ transform: item.flipX ? 'scaleX(-1)' : '' }"><AuthImage :src="item.assetUrl" mode="scaleToFill" :style="imageCropStyle(item)" /></view></view>
    <view v-if="!elements.length" class="board-empty"><wd-icon name="picture" size="72rpx" /><view class="title">把喜欢的衣物放上画板</view><text class="line small">从衣柜选择单品，组合成一套穿搭。</text><wd-button size="small" :disabled="!!board.locked" @click.stop="pickerOpen = true">加入贴纸</wd-button></view>
  </view></view></scroll-view>
  <text class="line small">{{ elements.length }} 张贴纸 · 点选后拖动，双指缩放，长按调整属性</text><view class="editor-actions"><wd-button size="small" :disabled="!!board.locked" @click="pickerOpen = true">加入贴纸</wd-button><wd-button size="small" plain :disabled="!selected.length || !!board.locked" @click="inspectorOpen = true">属性{{ selected.length > 1 ? ` · ${selected.length}` : '' }}</wd-button><wd-button size="small" plain :disabled="!elements.length || !!board.locked" @click="resetLayout">整理穿搭</wd-button><wd-button size="small" plain @click="layersOpen = true">图层</wd-button><wd-button size="small" plain :loading="exporting" :disabled="!elements.length || !!failedImage || imageLoading || !!board.locked" @click="exportPng">导出图片</wd-button><wd-button type="text" size="small" @click="helpOpen = true">操作帮助</wd-button></view>
  <wd-popup v-model="pickerOpen" position="bottom" closable :z-index="25" @close="replacing = ''"><view class="sheet"><OutfitMaterials v-if="pickerOpen" :elements="board.scene.elements" :replacing="!!replacing" :adding="adding" @garment="addGarment" @person="addPerson" @cancel="replacing = ''" /></view></wd-popup>
  <wd-popup v-model="inspectorOpen" position="bottom" closable :z-index="25"><view class="sheet"><OutfitInspector :items="selected" :can-forward="canForward" :can-backward="canBackward" @patch="patch" @scale="scale" @rotate="rotate" @offset="offset" @layer="moveLayer" @flip="flip" @duplicate="duplicate" @replace="replace" @remove="remove" @info="showInfo" /></view></wd-popup>
  <wd-popup v-model="layersOpen" position="bottom" closable :z-index="25"><view class="sheet"><view class="sheet-head">图层</view><view class="actions"><wd-button size="small" :disabled="!!board.locked" @click="board.selectedIds = board.scene.elements.map(keyFor)">全选</wd-button><wd-button size="small" plain :disabled="!!board.locked" @click="clearSelection">清除选择</wd-button><wd-switch v-model="multiSelect" /><text class="small">多选</text></view><text class="line small">勾选可多选。上面覆盖下面，用前移、后移调整叠放顺序。</text><wd-status-tip v-if="!board.scene.elements.length" image="content" tip="加入贴纸后管理图层" /><view v-for="item in [...board.scene.elements].reverse()" :key="keyFor(item)" class="layer-row"><wd-checkbox :model-value="board.selectedIds.includes(keyFor(item))" :disabled="!!board.locked" @change="select(keyFor(item), true)" /><view class="thumb" @tap="select(keyFor(item), false)"><AuthImage :src="item.assetUrl" :width="320" /></view><view class="row-body"><text @tap="select(keyFor(item), false)">{{ item.garmentLabel }}</text><text class="line small">{{ item.kind === 'PERSON_PART' ? '人物' : '衣物' }} · 第 {{ item.zIndex + 1 }} 层{{ item.zIndex === elements.length - 1 ? ' · 顶层' : '' }}</text><view class="actions"><wd-button type="text" size="small" :disabled="item.zIndex === elements.length - 1 || !!board.locked" @click="moveLayer('forward', keyFor(item))">前移</wd-button><wd-button type="text" size="small" :disabled="item.zIndex === 0 || !!board.locked" @click="moveLayer('backward', keyFor(item))">后移</wd-button><wd-button type="text" size="small" :disabled="!!board.locked" @click="inspect(keyFor(item)); layersOpen = false">属性</wd-button></view></view></view></view></wd-popup>
  <wd-popup v-model="infoOpen" position="bottom" closable :z-index="35"><view class="sheet"><view class="sheet-head">衣物信息</view><wd-loading v-if="infoLoading" /><view v-else-if="infoError" class="notice error">{{ infoError }}<wd-button type="text" @click="showInfo">重试</wd-button></view><template v-else-if="info"><view class="info-image"><AuthImage :src="info.displayUrl" previewable /></view><view class="title section">{{ info.name || info.category[0] || '衣物' }}</view><view v-for="row in infoFields" :key="row.key" class="field"><text class="field-label">{{ row.label }}</text><text class="line">{{ row.value }}</text></view><text v-if="info.assessment" class="line">{{ info.assessment }}</text><wd-button block @click="fullInfo">查看完整衣物信息</wd-button></template></view></wd-popup>
  <wd-popup v-model="helpOpen" position="bottom" closable :z-index="35"><view class="sheet"><view class="sheet-head">画板操作帮助</view><text class="line">点选贴纸后拖动；双指调整大小；长按打开属性，调整旋转、裁剪、翻转和位置。</text><text class="line">在图层中勾选多张贴纸，可一起移动、缩放和调整。上面的图层覆盖下面。</text><text class="line">修改自动保留在此设备，保存到搭配库后可在其他设备继续编辑。</text><text class="line">导出图片会保存到微信相册，需要允许相册权限。</text></view></wd-popup>
  <canvas id="outfit-export" type="2d" class="export-canvas" /><wd-toast :selector="selector" />
</view></template>
<style lang="scss" scoped>@import './outfit.scss';.toolbar{display:flex;justify-content:space-between;align-items:center;gap:8rpx;flex-wrap:wrap;margin-bottom:20rpx}.toolbar .actions{gap:8rpx}.board-scroll{width:100%;height:calc((100vw - 64rpx) * 1.25);max-height:65vh;background:$surface-alt;border-radius:$radius-md;border:1rpx solid $line;box-sizing:border-box}.board-area{position:relative}.board{position:relative;background:$surface;overflow:hidden}.sticker{position:absolute;box-sizing:border-box}.artwork{position:relative;overflow:hidden;width:100%;height:100%}.sticker.selected{outline:3rpx solid $accent;outline-offset:3rpx}.sticker :deep(.auth-image){background:transparent}.board-empty{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:16rpx;padding:24rpx;text-align:center;color:$muted}.editor-actions{display:flex;gap:14rpx;flex-wrap:wrap;padding:12rpx 0}.layer-row{display:flex;align-items:center;gap:18rpx;border-bottom:1rpx solid $line;padding:20rpx 0}.info-image{height:420rpx}.export-canvas{position:fixed;left:-3000rpx;top:0;width:1080rpx;height:1350rpx;pointer-events:none}</style>
