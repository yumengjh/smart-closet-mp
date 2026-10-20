/** Closet-only supplemental endpoints, matching the web and existing server. */
import { request, closetApi } from './api'
export type SimilarItem = { id:string; name:string; status:string; displayUrl:string|null; level:'DUPLICATE'|'VERY_SIMILAR'|'SIMILAR'|null; reasons:string[] }
export type SimilarView = { items:SimilarItem[]; ready:{text:boolean;image:boolean}; imageModel?:{state:string;message:string} }
export type ProcessingStep = { key:string;label:string;state:string;detail:string;atMs:number|null }
export const closetTools = {
  capabilities: () => request<{quickIntake:boolean}>('/api/processing/capabilities'),
  similar: (id:string) => request<SimilarView>(`/api/garments/${id}/similar?limit=5`),
  flags: (ids:string[]) => ids.length ? request<{flags:Record<string,SimilarItem>}>('/api/garments/similar-flags?'+ids.map(id=>`ids=${encodeURIComponent(id)}`).join('&')) : Promise.resolve({flags:{}}),
  dismiss: (a:string,b:string) => request('/api/garments/similar-dismissals',{method:'POST',body:{garmentA:a,garmentB:b}}),
  processing: (id:string) => request<{steps:ProcessingStep[]}>(`/api/garments/${id}/processing-status`),
  async basic(id:string, revision:number, patch:{favorite?:boolean;name?:string}) {
    await request(`/api/garments/${id}`,{method:'PATCH',body:{revision,...patch}})
    return closetApi.detail(id)
  },
  wear: (id:string) => request<{count:number;lastWornOn:string;daysSince:number}>(`/api/wear-logs/garments/${id}`),
  recommend: () => request<{runId:string}>('/api/recommendations',{method:'POST',body:{occasion:'DAILY',count:3}}),
  explain: (run:string,id:string) => request<{summary:string[];outfit?:{rules:{id:string;hit:boolean;label:string;delta:number;evidence?:string}[]};bestOutfit?:{rules:{id:string;hit:boolean;label:string;delta:number;evidence?:string}[]}}>(`/api/recommendations/${run}/explain?garmentId=${encodeURIComponent(id)}`),
}
