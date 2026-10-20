import type { OutfitElement } from '../../domain/outfit'
export type Point = { x: number; y: number }
export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
/** Board coordinates and centered rotation are identical to the web/Konva scene. */
export function frameStyle(item: OutfitElement) {
  return { left: `${item.x / 1080 * 100}%`, top: `${item.y / 1350 * 100}%`, width: `${item.width / 1080 * 100}%`, height: `${item.height / 1350 * 100}%`, transform: `translate(-50%, -50%) rotate(${item.rotation}deg)`, zIndex: item.zIndex + 1 }
}
export function imageCropStyle(item: OutfitElement) {
  return { position: 'absolute', width: `${100 / item.cropWidth}%`, height: `${100 / item.cropHeight}%`, left: `${-item.cropX / item.cropWidth * 100}%`, top: `${-item.cropY / item.cropHeight * 100}%` }
}
export function selectionCenter(items: OutfitElement[]): Point {
  if (!items.length) return { x: 540, y: 675 }
  return { x: items.reduce((sum, e) => sum + e.x, 0) / items.length, y: items.reduce((sum, e) => sum + e.y, 0) / items.length }
}
export function gestureElements(items: OutfitElement[], ids: string[], offset: Point, scale = 1) {
  const selected = items.filter(e => ids.includes(e.elementId || e.garmentId)), center = selectionCenter(selected)
  // Clamp one shared factor, preserving every sticker's aspect and relative group geometry.
  const maxScale = Math.min(...selected.map(e => Math.min(2160 / e.width, 2700 / e.height)))
  const minScale = Math.max(...selected.map(e => Math.max(24 / e.width, 24 / e.height)))
  const factor = selected.length ? clamp(scale, minScale, maxScale) : 1
  return items.map(e => !ids.includes(e.elementId || e.garmentId) ? e : { ...e, x: clamp(center.x + (e.x - center.x) * factor + offset.x, 0, 1080), y: clamp(center.y + (e.y - center.y) * factor + offset.y, 0, 1350), width: e.width * factor, height: e.height * factor })
}
export function cropPatch(item: OutfitElement, axis: 'x' | 'y' | 'width' | 'height', percent: number) {
  const crop = { x: item.cropX, y: item.cropY, width: item.cropWidth, height: item.cropHeight }
  crop[axis] = clamp(percent / 100, axis === 'width' || axis === 'height' ? .01 : 0, axis === 'x' || axis === 'y' ? .99 : 1)
  crop.width = Math.min(crop.width, 1 - crop.x); crop.height = Math.min(crop.height, 1 - crop.y)
  return { cropX: crop.x, cropY: crop.y, cropWidth: crop.width, cropHeight: crop.height }
}
