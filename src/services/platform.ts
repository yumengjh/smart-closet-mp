import { request, HttpError, type RequestOptions } from './http'
export class PlatformRequestError extends Error {
  readonly uncertain: boolean
  readonly status?: number
  readonly code?: string
  constructor(message: string, uncertain = false, status?: number, code?: string) {
    super(message); this.name = 'PlatformRequestError'; this.uncertain = uncertain; this.status = status; this.code = code
  }
}
export async function platformRequest<T>(path: string, method = 'GET', body?: unknown, idempotencyKey?: string, options: { timeoutMs?: number } = {}): Promise<T> {
  try { return await request<T>(path, { method: method as RequestOptions['method'], body, idempotencyKey, ...options }) }
  catch (error) {
    if (error instanceof HttpError) throw new PlatformRequestError(error.message, error.uncertain, error.status, error.code)
    throw new PlatformRequestError(error instanceof Error ? error.message : '暂时无法连接到服务，请检查连接后重试。')
  }
}
export type Worn = { garmentId: string; revision: number; label: string; role: string; referenceAssetId: string; position: string }
export type Review = { items: Worn[]; slots: { role: string; label: string; state: string; items: Worn[] }[]; blockers: { code: string; message: string; action: string }[]; warnings: { code: string; message: string }[]; fingerprint: string; ruleVersion: string }
export type Profile = { revision: number; sex: string | null; heightCm: number | null; weightKg: number | null; bodyShape: string | null; measurements: Record<string, number>; preferences: Record<string, string>; defaultBaselineId: string | null }
export type ProfileSnapshot = { sex: string; heightCm: number; weightKg: number; bodyShape: string; sources: Record<string, string>; profileRevision: number }
export type Baseline = { id: string; revision: number; status: string; mediaUrl: string | null; sourcePhotoId: string | null; profile: ProfileSnapshot; createdAt: number; currentDefault: boolean; name: string | null }
export type RenderJob = { id: string; purpose: string; status: string; mediaUrl: string | null; baselineId: string | null; planId: string | null; error: string | null; feedback: string | null; createdAt: number; parentJobId: string | null; summary: RenderSummary | null }
export type BodyAdjustments = Partial<Record<'build' | 'shoulders' | 'waist' | 'hips' | 'legs', number>>
export type RenderSummary = { kind?: 'OOTD' | 'ADJUST'; retryOf?: string; model?: string; pose?: string; adjustments?: BodyAdjustments }
export type PoseJoint = 'HEAD' | 'NECK' | 'L_SHOULDER' | 'R_SHOULDER' | 'L_ELBOW' | 'R_ELBOW' | 'L_WRIST' | 'R_WRIST' | 'L_HIP' | 'R_HIP' | 'L_KNEE' | 'R_KNEE' | 'L_ANKLE' | 'R_ANKLE'
export type Pose = { id: string; name: string; source: 'PRESET' | 'PHOTO' | 'TEXT'; description: string; tags: string[]; keypoints: Partial<Record<PoseJoint, [number, number]>>; viewAngle: string | null; createdAt: number }
export type PoseCatalog = { presets: Pose[]; mine: Pose[]; extractionsToday: number; dailyExtractions: number }
export type PoseChoice = { mode: 'AUTO' } | { mode: 'PRESET' | 'CUSTOM'; id: string }
export type Capability = { provider: string; model: string; purpose: string; maxReferences: number; verified: boolean; version: number; notes: string }

export type RenderSubmission = { found: boolean; job: RenderJob | null }
