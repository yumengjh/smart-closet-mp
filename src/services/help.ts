import { request } from './http'
export type Article = { id: string; title: string; markdown: string; href: string }
export const helpApi = { list: () => request<Article[]>('/api/agent/help') }
