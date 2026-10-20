import { request } from '../services/api';
import type { Explanation, InspirationView, IntentInput, RecommendationStats, RecommendationView, RecommendedOutfit, StyleProfileView, SwapView, Verdict, WearSummary } from './types';
type Signal = {
    kind: 'VIEW_DETAIL' | 'OPEN_WORKSPACE' | 'SWAP_OUT';
    logId?: string;
    garmentId?: string;
};
let pending: Signal[] = [];
let timer: ReturnType<typeof setTimeout> | undefined;
// Turning off "根据我的行为调整推荐" stops weak-signal reports at the source (design 8.8); unknown means allowed.
let signalsEnabled = true;
function flush() {
    clearTimeout(timer);
    timer = undefined;
    if (!pending.length)
        return;
    const events = pending;
    pending = [];
    // Weak signals are best effort (design 8.8): failures are dropped silently and never retried.
    request('/api/recommendations/events', { method: 'POST', body: { events } }).catch(() => { });
}
uni.onAppHide(flush);
/** Last run shown on a page, so "为什么没推荐它" from a garment page can explain against it. */
const LAST_RUN = 'yixu.recommend.last-run.v1';
export function rememberRun(runId: string) { try {
    uni.setStorageSync(LAST_RUN, runId);
}
catch { /* private mode */ } }
export function lastRun(): string | null { try {
    return uni.getStorageSync(LAST_RUN) || null;
}
catch {
    return null;
} }
export const recommendApi = {
    recommend(intent: IntentInput) {
        return request<RecommendationView>('/api/recommendations', { method: 'POST', body: intent }).then(view => { rememberRun(view.runId); return view; });
    },
    inspiration(temperatureC?: number | null) {
        const q = temperatureC === null || temperatureC === undefined ? '' : `?temperatureC=${temperatureC}`;
        return request<InspirationView>(`/api/recommendations/inspiration${q}`);
    },
    stats(days = 30) { return request<RecommendationStats>(`/api/recommendations/stats?days=${days}`); },
    more(runId: string, count = 3) { return request<RecommendationView>(`/api/recommendations/${runId}/more?count=${count}`); },
    swap(runId: string, outfitKey: string, garmentId: string) {
        return request<SwapView>(`/api/recommendations/${runId}/outfits/${outfitKey}/swap?garmentId=${encodeURIComponent(garmentId)}`);
    },
    adopt(runId: string, garmentIds: string[]) {
        return request<RecommendedOutfit>(`/api/recommendations/${runId}/outfits`, { method: 'POST', body: { garmentIds } });
    },
    explain(runId: string, target: {
        garmentId?: string;
        outfitKey?: string;
    }) {
        const q = target.garmentId ? `garmentId=${encodeURIComponent(target.garmentId)}` : `outfitKey=${encodeURIComponent(target.outfitKey || '')}`;
        return request<Explanation>(`/api/recommendations/${runId}/explain?${q}`);
    },
    feedback(logId: string, verdict: Verdict, reasons: string[] = [], garmentId?: string) {
        return request<{
            logId: string;
            verdict: Verdict;
            reasons: string[];
            doubted?: {
                garmentId: string;
                name: string;
            };
        }>(`/api/recommendations/logs/${logId}/feedback`, {
            method: 'POST', body: { verdict, reasons, garmentId },
        });
    },
    wear(input: {
        outfitId?: string;
        garmentIds?: string[];
    }) {
        return request<{
            id: string;
            wornOn: string;
            garmentIds: string[];
        }>('/api/wear-logs', { method: 'POST', body: input });
    },
    wearSummary(garmentId: string) { return request<WearSummary>(`/api/wear-logs/garments/${garmentId}`); },
    outfitWear() { return request<Record<string, string>>('/api/wear-logs/outfits'); },
    profile() { return request<StyleProfileView>('/api/style-profile').then(p => { signalsEnabled = p.settings.profileEnabled; return p; }); },
    updateProfile(patch: Record<string, unknown>) {
        return request<StyleProfileView['settings']>('/api/style-profile', { method: 'PATCH', body: patch }).then(s => { signalsEnabled = s.profileEnabled; return s; });
    },
    signal(signal: Signal) {
        if (!signal.logId || !signalsEnabled)
            return;
        pending.push(signal);
        if (pending.length >= 10)
            flush();
        else if (timer === undefined)
            timer = setTimeout(flush, 5000);
    },
};
