import { request, upload } from './http'
export type IntakeStrategy = 'SMART' | 'FULL' | 'MANUAL'
export type IntakeChannel = 'SINGLE' | 'MULTIPLE'
export type Marker = { sourceId: string; x: number; y: number }
export type BatchSource = { id: string; name: string; originalUrl: string; previewUrl: string; bytes: number; width: number; height: number }
export type BatchTarget = { id: string; sourceId: string; garmentId: string; jobId?: string; visibleFraction: number; keyDetailsVisible: boolean; completion: boolean; confirmed: boolean; reason: string; status: string; outputUrl?: string; slot: number; recognition: { target: { description: string; worn: boolean; bounds: { x: number; y: number; width: number; height: number } }; attributes: Record<string, { values: string[] }> } }
export type BatchCall = { id: string; type: string; status: string; model: string; startedAtMs: number; finishedAtMs?: number; usage: unknown; costUsd: number | null; error?: string; targetIds: string[]; referenceUrl?: string; atlasUrl?: string; size?: string; quality?: string; referenceSide: number }
export type IntakeBatch = { id: string; channel: IntakeChannel; strategy: IntakeStrategy; status: string; metrics?: {uploaded:number; recognized:number; skipped:number; generated:number; confirmed:number}; error?: string; createdAtMs: number; sources: BatchSource[]; targets: BatchTarget[]; calls: BatchCall[] }
export type GenerateOptions = { targetIds: string[]; groupSize: number; referenceSide: number; sizePolicy: 'FIXED' | 'PER_ITEM'; provider?: string; model?: string; quality: string }
export const batchApi = {
  provenance: (id: string) => request<{batchId?: string; originalUrl?: string; previewUrl?: string; completion?: boolean}>(`/api/closet/batches/garments/${id}/source`),
  resumeLocal: (id: string, callId: string) => request<IntakeBatch>(`/api/closet/batches/${id}/calls/${callId}/resume-local`,{method:'POST'}),
  get: (id: string) => request<IntakeBatch>(`/api/closet/batches/${id}`),
  history: () => request<IntakeBatch[]>('/api/closet/batches'),
  create(file: string, key: string, channel: IntakeChannel, strategy: IntakeStrategy, progress: (percent: number) => void) {
    return upload<IntakeBatch>('/api/closet/batches', file, { name: 'file', formData: { options: JSON.stringify({ channel, strategy }) }, jsonFields: ['options'], idempotencyKey: key, onProgress: progress })
  },
  append(file: string, id: string, key: string, progress: (percent: number) => void) {
    return upload<IntakeBatch>(`/api/closet/batches/${id}/sources`, file, { name: 'file', idempotencyKey: key, onProgress: progress })
  },
  start: (id: string, key: string, markers: Marker[], recognition: { provider?: string; model?: string }, generation: { provider?: string; model?: string }, reviewBeforeGeneration = false) => request<IntakeBatch>(`/api/closet/batches/${id}/start`, { method: 'POST', idempotencyKey: key, body: { recognition: { markers, ...recognition }, generationProvider: generation.provider, generationModel: generation.model, reviewBeforeGeneration } }),
  detect: (id: string, key: string, markers: Marker[], model: { provider?: string; model?: string }) => request<IntakeBatch>(`/api/closet/batches/${id}/recognize`, { method: 'POST', idempotencyKey: key, body: { markers, ...model } }),
  generate: (id: string, key: string, options: GenerateOptions) => request<IntakeBatch>(`/api/closet/batches/${id}/generate`, { method: 'POST', idempotencyKey: key, body: options }),
}
