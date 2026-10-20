import { request, upload } from './http'
export type TemplateSlot = { roles: string[]; categoryAny: string[]; colorAny: string[]; styleAny: string[]; patternMax: number | null; fitAny?: string[]; patternMin?: number | null; describe?: string[] }
export type TemplateMeta = { kind: 'CLASSIC' | 'TREND'; audience: string[]; occasions: string[]; seasons: string[]; validFrom: string | null; validUntil: string | null; reference: string }
export type TemplateEntry = { id: string; text: string; bonus: number; defaultBonus: number; enabled: boolean; reviewStatus: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED'; reviewedBy: string | null; reviewedAtMs: number; slots: TemplateSlot[]; meta?: TemplateMeta }
export type SampleItem = { role: string; engineRole: string; category: string; primaryColor: string; secondaryColors: string[]; patterns: string[]; fit: string; length: string; wear: string; visibility: string; confidence: string; description: string }
export type SampleResult = {
  usable: boolean; rejectReason: string; presentation: string; seasons: string[]; occasions: string[]; styles: string[]; items: SampleItem[]
  pose: { stance: string; bodyAngle: string; gaze: string; hands: string; description: string; tendency: string }
  framing: { shot: string; cameraAngle: string; mirrorSelfie: boolean }; scene: { setting: string; description: string }
  hair: { length: string; description: string }; expression: string; highlights: string
}
export type OotdSample = {
  id: string; status: 'PENDING' | 'EXTRACTED' | 'FAILED' | 'APPROVED' | 'REJECTED'; sourceUrl: string | null; license: string; note: string | null; hasImage: boolean
  model: string | null; extraction: SampleResult | null; reviewed: SampleResult | null; error: string | null; rejectReason: string | null; presentation: string | null
  createdBy: string; createdAtMs: number; reviewedBy: string | null; templateId: string | null
}
export type SampleCount = Record<string, number>
export type SampleStats = {
  approved: number; byStatus: SampleCount; presentation: SampleCount; roles: SampleCount; bodies: { key: string; count: number }[]; colorPairs: { key: string; count: number }[]
  styles: { key: string; count: number }[]; seasons: SampleCount; occasions: SampleCount; stance: SampleCount; bodyAngle: SampleCount; gaze: SampleCount; shot: SampleCount; setting: SampleCount; hair: SampleCount; expression: SampleCount
  unknownItems: { category: string; role: string; description: string; count: number }[]; roleMismatches: number
}

const samplePath = (id: string) => `/api/admin/ootd-samples/${encodeURIComponent(id)}`
export const adminTemplateApi = {
  list: () => request<{ items: TemplateEntry[]; active: number }>('/api/admin/outfit-templates'),
  review: (id: string, body: Record<string, unknown>) => request<TemplateEntry>(`/api/admin/outfit-templates/${encodeURIComponent(id)}`, { method: 'PATCH', body }),
  batch: (ids: string[], reviewStatus: string) => request('/api/admin/outfit-templates/review', { method: 'POST', body: { ids, reviewStatus } }),
}
export const adminSampleApi = {
  list: () => request<{ items: OotdSample[] }>('/api/admin/ootd-samples'),
  stats: (presentation = '') => request<SampleStats>('/api/admin/ootd-samples/stats' + (presentation ? `?presentation=${encodeURIComponent(presentation)}` : '')),
  upload: (file: string, license: string, sourceUrl: string, note: string) => upload<OotdSample>('/api/admin/ootd-samples', file, { name: 'image', formData: { license, ...(sourceUrl ? { sourceUrl } : {}), ...(note ? { note } : {}) } }),
  get: (id: string) => request<OotdSample>(samplePath(id)),
  save: (id: string, body: SampleResult) => request<OotdSample>(samplePath(id), { method: 'PUT', body }),
  review: (id: string, decision: string) => request<OotdSample>(samplePath(id) + '/review', { method: 'POST', body: { decision } }),
  extract: (id: string) => request<OotdSample>(samplePath(id) + '/extract', { method: 'POST' }),
  template: (id: string, kind: string) => request<{ templateId: string }>(samplePath(id) + '/template-draft', { method: 'POST', body: { kind } }),
  remove: (id: string) => request(samplePath(id), { method: 'DELETE' }),
}
