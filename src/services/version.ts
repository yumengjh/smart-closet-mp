import type { BuildInfo, ServerInfo } from '../domain/app-version'
import { request } from './http'
export const webBuild: BuildInfo = { version: '0.1.0', commit: '', builtAt: '' }
export async function serverBuild(): Promise<ServerInfo | null> {
  try { return await request<ServerInfo>('/api/health') } catch { return null }
}
