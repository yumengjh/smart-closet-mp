import { readAgentStream } from './sse'
import { request, streamPost, HttpError, type RequestOptions } from '../services/http'
import type { OutfitScene } from '../domain/outfit'
export type AgentContext = { route: string; workspaceId?: string; boardId?: string; contentVersion?: number; boardCount?: number; garmentId?: string; outfitId?: string; name?: string; revision?: number | null; selectedIds?: string[]; scene?: OutfitScene }
export type AgentSession = { id: string; title: string; model: string | null; updatedAt: number }
export type Memory = { id: string; content: string; category: string; updatedAt: number }
export type Candidate = { name: string; reason: string; garmentIds: string[]; recommendation?: import('../recommend/types').RecommendedOutfit }
export type EditOperation = { op: 'add' | 'remove' | 'replace' | 'transform'; elementId?: string; garmentId?: string; patch?: Record<string, number | boolean> }
export type Proposal = { id: string; kind: 'OUTFITS' | 'RECOMMENDATION' | 'EDIT' | 'SAVE' | 'GARMENT_CHOICE' | 'GARMENT_LIST'; payload: { items?: { id: string; name?: string; category?: string[]; primaryColor?: string[] }[]; truncated?: boolean; candidates?: Candidate[]; summary?: string; operations?: EditOperation[]; runId?: string; intent?: string; intentInput?: import('../recommend/types').IntentInput; limits?: string[]; notes?: string[]; query?: string; total?: number }; context: AgentContext; consumed: boolean }
export type Article = { id: string; title: string; markdown: string; href: string }
export type AgentEvent = { event: string; data: any }
export type AgentMessage = { id: string; role: string; content: string; status: string; events: AgentEvent[]; requestId?: string | null }
export type Models = { defaultModel: string; models: string[]; configured: boolean }
export type Quota = { limit: number; used: number; resetAt: string }

export class AgentRequestError extends Error { constructor(message: string, public status: number) { super(message) } }
function agentError(error: unknown): never {
  if (error instanceof HttpError) throw new AgentRequestError(error.message, error.status)
  throw error
}
export async function agentRequest<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  try { return await request<T>('/api/agent' + path, { method: method as RequestOptions['method'], body }) }
  catch (error) { return agentError(error) }
}
export async function streamMessage(session: string, body: unknown, onEvent: (event: AgentEvent) => void, signal: AbortSignal) {
  try {
    await readAgentStream(receive => streamPost(`/api/agent/sessions/${session}/messages`, body, receive, { signal }), onEvent)
  } catch (error) { agentError(error) }
}
