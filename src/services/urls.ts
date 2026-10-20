import { apiUrl, isApiMedia } from './http'
import { resolveMedia } from './media'
import { variantPath } from '../domain/image-variants'
export { apiUrl, isApiMedia }
/** Authenticated media must resolve to a local path before being displayed. */
export function mediaUrl(path: string | null | undefined): Promise<string | undefined> {
  return path ? resolveMedia(path) : Promise.resolve(undefined)
}
export function thumbUrl(path: string | null | undefined, width: number): Promise<string | undefined> {
  return mediaUrl(variantPath(path, width))
}
/** Mini program images take a single source; retained for shared callers. */
export function thumbSrcset(path: string | null | undefined, widths: readonly number[]): Promise<string | undefined> {
  return path && widths.length ? resolveMedia(path, widths[widths.length - 1]) : Promise.resolve(undefined)
}
