// Mini program: use authenticated local image info; pixel scanning, Konva/DOM canvas export and download are omitted.
import { createUuid } from './id'
import type { Garment } from '../services/api'
import { resolveMedia } from '../services/media'
import type { OutfitElement } from './outfit'
import { formatGarmentLabel, nextElementPosition, OUTFIT_HEIGHT, OUTFIT_WIDTH, roleFromGarment } from './outfit'

export type OutfitImage = { path: string; naturalWidth: number; naturalHeight: number }
const imagePromises = new Map<string, Promise<OutfitImage>>()

export type GarmentArtwork = { assetId: string; url: string; kind: string; hasBackground: boolean }

export function artworkForGarment(garment: Garment): GarmentArtwork {
  const approved = garment.images.filter((image) => image.reviewStatus === 'APPROVED')
  const transparent = approved.find((image) => ['SEGMENT', 'ENSURE_TRANSPARENCY'].includes(image.kind))
  if (transparent) return { assetId: transparent.id, url: transparent.url, kind: transparent.kind, hasBackground: false }
  const sticker = approved.find((image) => image.kind === 'STICKER')
  if (sticker) return { assetId: sticker.id, url: sticker.url, kind: sticker.kind, hasBackground: false }
  const shown = garment.images.find((image) => image.id === garment.displayAssetId)
  if (shown?.url) return { assetId: shown.id, url: shown.url, kind: shown.kind, hasBackground: ['INPUT', 'GENERATE'].includes(shown.kind) }
  if (garment.displayUrl) return { assetId: garment.displayAssetId, url: garment.displayUrl, kind: 'DISPLAY', hasBackground: true }
  if (garment.sourceUrl) return { assetId: garment.sourceAssetId || `source-${garment.id}`, url: garment.sourceUrl, kind: 'INPUT', hasBackground: true }
  throw new Error('这件衣物还没有可用图片。')
}

export function loadOutfitImage(url: string): Promise<OutfitImage> {
  const cached = imagePromises.get(url)
  if (cached) return cached
  const pending = resolveMedia(url).then(path => new Promise<OutfitImage>((resolve, reject) => {
    uni.getImageInfo({ src: path, success: info => resolve({ path: info.path, naturalWidth: info.width, naturalHeight: info.height }), fail: () => reject(new Error('贴纸图片暂时无法加载，请重试。')) })
  }))
  imagePromises.set(url, pending)
  pending.catch(() => imagePromises.delete(url))
  return pending
}
type Bounds = { x: number; y: number; width: number; height: number }
export function transparentBounds(_image: OutfitImage): Bounds { return { x: 0, y: 0, width: 1, height: 1 } }

export async function createOutfitElement(garment: Garment, current: OutfitElement[]): Promise<OutfitElement> {
  const role = roleFromGarment(garment)
  const artwork = artworkForGarment(garment)
  const image = await loadOutfitImage(artwork.url)
  const crop = transparentBounds(image)
  const position = nextElementPosition(role, current)
  const aspect = (image.naturalWidth * crop.width) / Math.max(1, image.naturalHeight * crop.height)
  const width = position.width
  const height = Math.max(80, Math.min(1260, width / Math.max(0.32, Math.min(2.6, aspect))))
  const x = Math.max(width / 2 + 16, Math.min(OUTFIT_WIDTH - width / 2 - 16, position.x))
  const y = Math.max(height / 2 + 16, Math.min(OUTFIT_HEIGHT - height / 2 - 16, position.y))
  return {
    elementId: createUuid(), kind: 'GARMENT', flipX: false, freeStretch: false,
    garmentId: garment.id, assetId: artwork.assetId, role,
    x, y, width, height, rotation: 0, zIndex: current.length,
    garmentLabel: formatGarmentLabel(garment), cropX: crop.x, cropY: crop.y,
    cropWidth: crop.width, cropHeight: crop.height,
    garmentRevision: garment.revision, assetUrl: artwork.url, imageWidth: image.naturalWidth,
    imageHeight: image.naturalHeight, assetKind: artwork.kind, garmentStatus: 'ACTIVE',
    garmentChanged: false, imageChanged: false,
  }
}

