import type { SessionUser } from '../domain/session';
import { createUuid } from '../domain/id';
import { queryString } from './query'
import { request, upload, clearCookies, apiBase } from './http';
export { request } from './http';
import { normalizeScene, sceneWrite } from '../domain/outfit';
import type { PersonCatalog } from '../domain/person-stickers';
import type { MetadataField } from '../domain/metadata';
import type { Outfit, OutfitScene } from '../domain/outfit';
export type ClosetStatus = 'DRAFT' | 'ACTIVE' | 'TRASHED';
export type ImageProcessing = {
    jobId: string;
    status: string;
    stickerRequired: boolean;
    stickerReady: boolean;
    stickerAssetId: string | null;
};
export type TransparencyReport = {
    verdict: string;
    hasAlpha: boolean;
    transparentRatio: number;
    reasons: string[];
};
export type GarmentTarget = {
    description: string;
    worn: boolean;
    bounds: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
};
export type Garment = {
    name?: string | null;
    favorite?: boolean;
    id: string;
    revision: number;
    sourceAssetId: string;
    displayAssetId: string;
    status: ClosetStatus;
    updatedAt: string;
    displayUrl: string;
    sourceUrl: string;
    category: string[];
    automatic: Record<string, string[]>;
    metadataEvidence?: Record<string, {
        status?: string;
        evidence?: string;
    }>;
    overrides: Record<string, string[]>;
    primaryColor: string[];
    secondaryColors: string[];
    patterns: string[];
    neckline: string[];
    sleeveLength: string[];
    garmentLength: string[];
    closure: string[];
    fit?: string[];
    thickness?: string[];
    wearingModes?: string[];
    texture: string[];
    styles: string[];
    seasons: string[];
    brand: string[];
    size: string[];
    materialComposition: string[];
    careInstructions: string[];
    visibleText: string[];
    sourceOrigin: 'USER_UPLOAD' | 'GENERATED' | 'UNKNOWN';
    imageProcessing?: ImageProcessing | null;
    assessment?: string;
    target?: GarmentTarget | null;
    issues?: {
        message: string;
    }[];
    reviewMessage?: string;
    imageColor: string;
    taskStatus?: 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'NEEDS_REVIEW' | 'FAILED' | 'UNKNOWN' | 'CANCEL_REQUESTED' | 'CANCELLED';
    taskId?: string;
    restoreStatus?: 'ACTIVE' | 'DRAFT';
    images: {
        id: string;
        url: string;
        kind: string;
        reviewStatus: string;
        aiGenerated?: boolean;
    }[];
};
export type TaskStep = {
    name: string;
    type?: string;
    status: 'completed' | 'running' | 'failed' | 'waiting' | 'review' | 'skipped';
    startedAt?: string;
    finishedAt?: string;
    inputUrl?: string;
    outputUrl?: string;
    error?: string;
    transparency?: {
        after: TransparencyReport;
    };
    recognition?: {
        target?: GarmentTarget | null;
        assessment?: string;
        issues?: {
            code?: string;
            message: string;
            suggestedAction?: string;
        }[];
    };
};
export type ClosetTask = {
    id: string;
    garmentId: string;
    parentJobId?: string;
    title: string;
    status: NonNullable<Garment['taskStatus']>;
    mode: '识别并整理' | '仅识别' | '本地贴纸' | '图片整理';
    createdAt: string;
    steps: TaskStep[];
    note?: string;
    updatedAt?: string;
    inputUrl?: string;
    outputUrl?: string;
    assets?: Garment['images'];
    attempts?: {
        provider: string;
        model: string;
        status: string;
        startedAt: string;
        finishedAt?: string;
    }[];
};
export const fieldLabels: Record<keyof Pick<Garment, 'category' | 'primaryColor' | 'secondaryColors' | 'patterns' | 'neckline' | 'sleeveLength' | 'garmentLength' | 'closure' | 'texture' | 'fit' | 'thickness' | 'wearingModes' | 'styles' | 'seasons' | 'brand' | 'size' | 'materialComposition' | 'careInstructions' | 'visibleText'>, string> = {
    category: '品类', primaryColor: '主色', secondaryColors: '辅色', patterns: '图案', neckline: '领型',
    sleeveLength: '袖长', garmentLength: '衣物长度', closure: '门襟', texture: '表面纹理', styles: '风格',
    fit: '版型建议（需核对）', thickness: '厚薄线索（需核对）', wearingModes: '穿着用途建议（需核对）',
    seasons: '季节', brand: '品牌', size: '尺码', materialComposition: '成分', careInstructions: '洗护', visibleText: '可见文字',
};
export type ListQuery = {
    status: ClosetStatus;
    q: string;
    category: string;
    color: string;
    season: string;
    page: number;
    size: number;
    sort?: string;
};
/** Hybrid wardrobe search result (server: GET /api/garments/search); reasons/parsed/hints are written by the server. */
export type SearchResult = {
    items: Garment[];
    reasons: Record<string, string[]>;
    total: number;
    page: number;
    hasMore: boolean;
    mode: string;
    parsed: {
        filters: Record<string, string[] | string>;
        freeText: string;
    } | null;
    emptyHint: string;
    notice: string;
    imageStyle: {
        applied: string;
        dominant: string;
    } | null;
    /** Image understanding right now (design 模型内存与图像向量 G17): READY, INDEXING, NOT_INSTALLED, LOW_MEMORY or FAILED with a message to show. */
    imageModel?: ImageModelStatus | null;
    /** Picture searches only: how the picture was compared, and the matting used. */
    note?: string;
    matting?: string;
};
export type ImageModelStatus = {
    state: 'READY' | 'INDEXING' | 'NOT_INSTALLED' | 'LOW_MEMORY' | 'FAILED';
    message: string;
    indexed: number;
    total: number;
    textSearch: boolean;
};
type SearchResponse = Omit<SearchResult, 'items' | 'reasons'> & {
    items: {
        garment: GarmentView;
        score: number;
        reasons: string[];
    }[];
};
function searchResult(result: SearchResponse): SearchResult {
    const reasons: Record<string, string[]> = {};
    const items = result.items.map(hit => { const g = fromView(hit.garment); reasons[g.id] = hit.reasons; return g; });
    return { ...result, items, reasons };
}
export type GarmentPage = {
    items: Garment[];
    total: number;
    page: number;
    size: number;
};
export type ProcessingChoice = {
    value: string;
    label: string;
};
export type UserRole = 'ADMIN' | 'USER';
export type RegistrationMode = 'CLOSED' | 'INVITE' | 'OPEN';
export type RegisteredVia = 'ADMIN' | 'INVITE' | 'OPEN';
export type Registration = {
    mode: RegistrationMode;
};
export type RegisterRequest = {
    username: string;
    password: string;
    displayName?: string;
    inviteCode?: string;
};
export type AccountProfile = {
    username: string;
    displayName: string | null;
    role: UserRole;
    createdAtMs: number;
    lastLoginAtMs: number | null;
    registeredVia: RegisteredVia;
};
export type ProfileUpdate = {
    displayName: string | null;
};
export type PasswordChange = {
    currentPassword: string;
    newPassword: string;
    signOutOthers?: boolean;
};
export type AccountDeactivation = {
    currentPassword: string;
};
export type AccountSession = {
    sessionRef: string;
    device: string;
    createdAtMs: number;
    lastAccessAtMs: number;
    expiresAtMs: number;
    portable: boolean;
    current: boolean;
};
export type RevokedSessions = {
    revokedSessions: number;
};
export type AdminUser = AccountProfile & {
    enabled: boolean;
    mustChangePassword: boolean;
    deactivatedAtMs: number | null;
    garmentCount: number;
};
export type AdminUsersQuery = {
    q?: string;
    status?: 'ENABLED' | 'DISABLED';
    role?: UserRole;
    page: number;
    size: number;
};
export type AdminUsersPage = {
    items: AdminUser[];
    total: number;
    page: number;
    size: number;
};
export type AdminUserCreate = {
    username: string;
    displayName?: string;
    role: UserRole;
};
export type TemporaryPassword = {
    username: string;
    temporaryPassword: string;
    revokedSessions?: number;
};
export type AdminStatusUpdate = {
    enabled: boolean;
};
export type AdminStatusResult = RevokedSessions & {
    username: string;
    enabled: boolean;
};
export type AdminRoleUpdate = {
    role: UserRole;
};
export type AdminRoleResult = RevokedSessions & {
    username: string;
    role: UserRole;
};
export type QuotaBucket = {
    limit: number;
    used: number;
    overridden: boolean;
};
export type AccountQuota = {
    image: QuotaBucket;
    agent: QuotaBucket;
    resetAtMs: number;
};
export type QuotaUpdate = {
    imageDailyLimit: number | null;
    agentDailyLimit: number | null;
};
export type AccountEvent = {
    occurredAtMs: number;
    actor: string;
    action: string;
    detail: string | null;
};
export type AdminRegistration = Registration & {
    activeInviteCount: number;
};
export type RegistrationInvite = {
    id: string;
    note: string | null;
    maxUses: number;
    usedCount: number;
    createdBy: string;
    createdAtMs: number;
    expiresAtMs: number;
    revokedAtMs: number | null;
    status: 'ACTIVE' | 'USED_UP' | 'EXPIRED' | 'REVOKED';
};
export type InviteCreate = {
    note?: string;
    maxUses: number;
    expiresInDays: number;
};
export type InviteCreated = RegistrationInvite & {
    code: string;
};
const delay = (ms = 160) => new Promise(resolve => setTimeout(resolve, ms));
type GarmentView = {
    name?: string | null;
    favorite?: boolean;
    id: string;
    revision: number;
    sourceAssetId: string;
    sourceUrl: string;
    sourceOrigin: Garment['sourceOrigin'];
    displayAssetId: string;
    displayUrl: string;
    images: Garment['images'];
    automatic: {
        assessment?: string;
        target?: GarmentTarget | null;
        issues?: {
            message: string;
        }[];
        attributes?: Record<string, {
            values: string[];
            status?: string;
            evidence?: string;
        }>;
    } | null;
    overrides: Record<string, string[]>;
    effective: Record<string, string[]>;
    latestRecognitionJobId: string | null;
    latestImageJobId: string | null;
    runs: {
        id: string;
        status: string;
        createdAtMs: number;
    }[];
    imageProcessing?: ImageProcessing | null;
    status: Garment['status'];
    createdAtMs: number;
    updatedAtMs: number;
};
type WorkflowResponse = {
    id: string;
    parentJobId?: string;
    status: string;
    createdAt: string;
    updatedAt: string;
    inputUrl?: string;
    outputUrl?: string;
    error?: {
        message: string;
    } | null;
    request: {
        garmentId?: string;
        steps?: {
            type: string;
        }[];
    };
    steps: {
        type: string;
        status: string;
        startedAt?: string;
        finishedAt?: string;
        inputUrl?: string;
        outputUrl?: string;
        error?: {
            message: string;
        };
        transparency?: TaskStep['transparency'];
        recognition?: TaskStep['recognition'];
    }[];
    assets: Garment['images'];
    attempts?: ClosetTask['attempts'];
};
export const stepLabels: Record<string, string> = { RECOGNIZE: 'AI 识别衣物', GENERATE: 'AI 整理图片', SEGMENT: '本地抠图', ENSURE_TRANSPARENCY: '检查透明背景', STICKER: '制作贴纸' };
export const colors: Record<string, string> = { '白色': '#e3e2dc', '奶油白': '#e6e0d5', '黑色': '#383a38', '浅蓝': '#a8c2d1', '海军蓝': '#3e5368', '橄榄绿': '#737e60', '陶土红': '#b76e55', '鼠尾草绿': '#9cae98', '卡其色': '#b3a081', '燕麦色': '#c8baa3', '炭灰': '#666761' };
function fromView(view: GarmentView): Garment {
    const status = view.status || 'ACTIVE';
    const latestId = [...(view.runs || [])].sort((a, b) => b.createdAtMs - a.createdAtMs)[0]?.id || view.latestRecognitionJobId || view.latestImageJobId;
    let latestStatus = view.runs.find((run) => run.id === latestId)?.status || '';
    if (view.imageProcessing && ['QUEUED', 'RUNNING', 'CANCEL_REQUESTED'].includes(view.imageProcessing.status))
        latestStatus = view.imageProcessing.status;
    const taskStatus = latestStatus === 'QUEUED' ? 'QUEUED' : latestStatus === 'RUNNING' ? 'RUNNING' : latestStatus === 'CANCEL_REQUESTED' ? 'CANCEL_REQUESTED'
        : latestStatus === 'NEEDS_REVIEW' ? 'NEEDS_REVIEW' : latestStatus === 'FAILED' ? 'FAILED' : latestStatus === 'CANCELLED' ? 'CANCELLED'
            : latestStatus === 'SUCCEEDED' ? 'SUCCEEDED' : latestStatus === 'UNKNOWN' ? 'UNKNOWN' : undefined;
    return {
        id: view.id, name: view.name, favorite: view.favorite, revision: view.revision, sourceAssetId: view.sourceAssetId, displayAssetId: view.displayAssetId, images: view.images || [], assessment: view.automatic?.assessment, target: view.automatic?.target, issues: view.automatic?.issues || [], status, updatedAt: new Date(view.updatedAtMs).toISOString(), displayUrl: view.displayUrl, sourceUrl: view.sourceUrl,
        metadataEvidence: view.automatic?.attributes || {}, automatic: Object.fromEntries(Object.entries(view.automatic?.attributes || {}).map(([key, attribute]) => [key, attribute.values])), overrides: view.overrides || {},
        category: view.effective.category || [], primaryColor: view.effective.primaryColor || [], secondaryColors: view.effective.secondaryColors || [],
        patterns: view.effective.patterns || [], neckline: view.effective.neckline || [], sleeveLength: view.effective.sleeveLength || [],
        garmentLength: view.effective.garmentLength || [], closure: view.effective.closure || [], texture: view.effective.texture || [], fit: view.effective.fit || [], thickness: view.effective.thickness || [], wearingModes: view.effective.wearingModes || [],
        styles: view.effective.styles || [], seasons: view.effective.seasons || [], brand: view.effective.brand || [], size: view.effective.size || [],
        materialComposition: view.effective.materialComposition || [], careInstructions: view.effective.careInstructions || [], visibleText: view.effective.visibleText || [],
        sourceOrigin: view.sourceOrigin, imageColor: colors[view.effective.primaryColor?.[0] || ''] || '#d6d5cc',
        taskStatus, taskId: latestId || undefined, imageProcessing: view.imageProcessing,
    };
}
function fromJob(job: WorkflowResponse): ClosetTask {
    const status: ClosetTask['status'] = ['QUEUED', 'RUNNING', 'CANCEL_REQUESTED', 'SUCCEEDED', 'NEEDS_REVIEW', 'FAILED', 'CANCELLED', 'UNKNOWN'].includes(job.status)
        ? job.status as ClosetTask['status'] : 'UNKNOWN';
    const mode = job.steps.some((step) => step.type === 'GENERATE') ? job.steps.some((step) => step.type === 'RECOGNIZE') ? '识别并整理' : '图片整理' : job.steps.some((step) => step.type === 'RECOGNIZE') ? '仅识别' : '本地贴纸';
    return { id: job.id, parentJobId: job.parentJobId, garmentId: job.request.garmentId || '', title: '衣物图片处理', status, mode, createdAt: job.createdAt, updatedAt: job.updatedAt,
        inputUrl: job.inputUrl, outputUrl: job.outputUrl, assets: job.assets || [], attempts: job.attempts || [],
        steps: job.steps.map((step) => ({ name: stepLabels[step.type] || step.type, type: step.type,
            startedAt: step.startedAt, finishedAt: step.finishedAt, inputUrl: step.inputUrl, outputUrl: step.outputUrl, error: step.error?.message, transparency: step.transparency, recognition: step.recognition,
            status: step.status === 'SUCCEEDED' ? 'completed' : step.status === 'RUNNING' ? 'running' : ['FAILED', 'UNKNOWN', 'INTERRUPTED'].includes(step.status) ? 'failed' : step.status === 'NEEDS_REVIEW' ? 'review' : step.status === 'SKIPPED' ? 'skipped' : 'waiting' })),
        note: job.error?.message,
    };
}
export type PortableLoginLink = {
    id: string;
    createdAt: number;
    expiresAt: number;
    sessionExpiresAt: number | null;
    status: 'PENDING' | 'USED' | 'EXPIRED' | 'REVOKED';
};
export type PortableLoginGrant = {
    id: string;
    token: string;
    expiresAt: number;
};
export const closetApi = {
    async metadataOptions(): Promise<Record<string, string[]>> {
        return request<Record<string, string[]>>('/api/closet/metadata-options');
    },
    async metadataFields(): Promise<MetadataField[]> {
        return (await request<{
            fields: MetadataField[];
        }>('/api/recognition/schema')).fields;
    },
    async processingChoices(): Promise<{
        generation: ProcessingChoice[];
        recognition: ProcessingChoice[];
    }> {
        type Provider = {
            id: string;
            defaultModel: string | null;
            configured: boolean;
            preferred?: boolean;
        };
        const [generators, recognizers] = await Promise.all([
            request<Provider[]>('/api/generation/providers'), request<Provider[]>('/api/recognition/providers'),
        ]);
        const choices = (providers: Provider[]) => providers.filter((provider) => provider.configured && provider.defaultModel)
            .map((provider) => ({ value: JSON.stringify({ provider: provider.id, model: provider.defaultModel }), label: `${provider.id} · ${provider.defaultModel}` }));
        const generation = choices(generators);
        const recognition = choices(recognizers).sort((a, b) => Number(JSON.parse(b.value).provider === recognizers.find((provider) => provider.preferred)?.id) - Number(JSON.parse(a.value).provider === recognizers.find((provider) => provider.preferred)?.id));
        return { generation, recognition };
    },
    async search(q: string, page: number, imageStyle?: string): Promise<SearchResult> {
        const params = queryString({ q, page: String(page), ...(imageStyle ? { imageStyle } : {}) });
        return searchResult(await request<SearchResponse>(`/api/garments/search?${params}`));
    },
    /** 超级搜索: a picture (and optional words) against the closet; same result shape as {@link search}. */
    async superSearch(image: string, q: string, page: number): Promise<SearchResult> {
 return searchResult(await upload<SearchResponse>('/api/garments/search', image, { name: 'image', formData: { q, page: String(page) } }))
 },
    async list(query: ListQuery): Promise<GarmentPage> {
        {
            const page = await request<{
                items: GarmentView[];
                total: number;
                page: number;
                size: number;
            }>(`/api/closet/garments?${queryString({ ...query, q: query.q || '', category: query.category || '', color: query.color || '', season: query.season || '', size: String(query.size), page: String(query.page), sort: query.sort || 'updated' })}`);
            return { ...page, items: page.items.map(fromView) };
        }
    },
    async detail(id: string): Promise<Garment> {
        return fromView(await request<GarmentView>(`/api/garments/${id}`));
    },
    async personStickers(): Promise<PersonCatalog> {
        return request<PersonCatalog>('/api/person-stickers');
    },
    async outfits(): Promise<Outfit[]> {
        return request<Outfit[]>('/api/outfits');
    },
    async outfit(id: string): Promise<Outfit> {
        return request<Outfit>(`/api/outfits/${id}`);
    },
    async saveOutfit(id: string | null, revision: number | null, name: string, scene: OutfitScene): Promise<Outfit> {
        const payload = { name, revision, scene: sceneWrite(normalizeScene(scene)) };
        return id
            ? request<Outfit>(`/api/outfits/${id}`, { method: 'PUT', body: payload })
            : request<Outfit>('/api/outfits', { method: 'POST', body: payload });
    },
    async deleteOutfit(id: string, revision: number): Promise<void> {
        return request<void>(`/api/outfits/${id}?revision=${revision}`, { method: 'DELETE' });
    },
    async tasks(): Promise<ClosetTask[]> {
        return (await request<ClosetTask[]>('/api/closet/tasks?page=1&size=50')).map(task => ({ ...task, steps: task.steps.map(step => ({ ...step, name: stepLabels[step.name] || step.name })) }));
    },
    async create(file: string, mode: Exclude<ClosetTask['mode'], '图片整理'>, options: {
        restage: boolean;
        precut: boolean;
        postcut: boolean;
        rotationDegrees: number;
        transparencyPolicy?: 'AUTO' | 'FORCE';
        generationProvider?: string;
        generationModel?: string;
        recognitionProvider?: string;
        recognitionModel?: string;
    }): Promise<ClosetTask> {
        {
            return fromJob(await upload<WorkflowResponse>('/api/closet/garments', file, { name: 'file', formData: { workflow: JSON.stringify({ mode, ...options }) }, jsonFields: ['workflow'], idempotencyKey: createUuid() }));
        }
    },
    async task(id: string): Promise<ClosetTask> {
        return fromJob(await request<WorkflowResponse>(`/api/workflows/${id}`));
    },
    async continueSticker(taskId: string, assetId: string, policy: 'FORCE' | 'REVIEWED', key: string): Promise<ClosetTask> {
        if (policy === 'REVIEWED')
            await request(`/api/workflows/${taskId}/assets/${assetId}/review`, { method: 'POST', body: { decision: 'APPROVED', note: '人工核对透明背景与完整衣物后继续制作贴纸' } });
        return fromJob(await request<WorkflowResponse>(`/api/workflows/${taskId}/continue`, { method: 'POST', idempotencyKey: key, body: { assetId, policy, method: 'U2NET' } }));
    },
    async confirm(id: string, patch: Partial<Garment> & {
        fields?: Record<string, string[]>;
        resetFields?: string[];
        revision?: number;
        assetId?: string;
        allowIncompleteSticker?: boolean;
    }) {
        {
            const view = await request<GarmentView>(`/api/garments/${id}`);
            return fromView(await request<GarmentView>(`/api/closet/garments/${id}/confirm`, { method: 'POST', body: { revision: patch.revision ?? view.revision, assetId: patch.assetId ?? view.displayAssetId, fields: patch.fields || {}, resetFields: patch.resetFields || [], allowIncompleteSticker: patch.allowIncompleteSticker || false } }));
        }
    },
    async update(id: string, patch: Partial<Garment> & {
        fields?: Record<string, string[]>;
        resetFields?: string[];
        revision?: number;
    }) {
        {
            const view = await request<GarmentView>(`/api/garments/${id}`);
            return fromView(await request<GarmentView>(`/api/garments/${id}/metadata`, { method: 'PATCH', body: { revision: patch.revision ?? view.revision, fields: patch.fields || {}, resetFields: patch.resetFields || [] } }));
        }
    },
    async chooseDisplay(id: string, assetId: string, revision: number) {
        return fromView(await request<GarmentView>(`/api/garments/${id}/display-image`, { method: 'POST', body: { revision, assetId } }));
    },
    async trash(id: string, revision?: number) { return this.setStatus(id, 'TRASHED', revision); },
    async restore(id: string, status: 'ACTIVE' | 'DRAFT' = 'ACTIVE', revision?: number) { return this.setStatus(id, status, revision); },
    async setStatus(id: string, status: ClosetStatus, revision?: number) {
        {
            const view = await request<GarmentView>(`/api/garments/${id}`);
            const result = await request<GarmentView>(`/api/closet/garments/${id}/${status === 'TRASHED' ? 'trash' : 'restore'}`, { method: 'POST', body: { revision: revision ?? view.revision } });
            return fromView(result);
        }
    },
    async cancel(taskId: string) {
        return request(`/api/workflows/${taskId}/cancel`, { method: 'POST' });
    },
    async cancelAndWait(taskId: string) {
        await this.cancel(taskId);
        const deadline = Date.now() + 10 * 60000;
        let wait = 600;
        while (Date.now() < deadline) {
            await delay(wait);
            const task = await request<WorkflowResponse>(`/api/workflows/${taskId}`);
            if (!['QUEUED', 'RUNNING', 'CANCEL_REQUESTED'].includes(task.status))
                return;
            wait = Math.min(wait * 1.6, 5000);
        }
        throw new Error('任务仍在收尾，请稍后再移入回收站。');
    },
    async recognize(id: string, targetDescription = '') { return this.startExistingRun(id, '仅识别', targetDescription); },
    async reprocess(id: string) { return this.startExistingRun(id, '识别并整理'); },
    async startExistingRun(id: string, mode: ClosetTask['mode'], targetDescription = '') {
        {
            const task = mode === '仅识别'
                ? await request<WorkflowResponse>(`/api/garments/${id}/recognize`, { method: 'POST', idempotencyKey: createUuid(), body: { targetDescription } })
                : await request<WorkflowResponse>(`/api/closet/garments/${id}/reprocess`, { method: 'POST', idempotencyKey: createUuid(), body: { restage: true, precut: false, postcut: true } });
            return fromJob(task);
        }
    },
    async quota() {
        return request<{
            limit: number;
            used: number;
            resetAt: string;
        }>('/api/me/quota');
    },
    async registration(): Promise<Registration> {
        return request('/api/auth/registration');
    },
    async register(payload: RegisterRequest): Promise<SessionUser> {
        {
            const user = await request<SessionUser>('/api/auth/register', { method: 'POST', body: payload });
            return user;
        }
    },
    async profile(): Promise<AccountProfile> {
        return request('/api/auth/profile');
    },
    async updateProfile(payload: ProfileUpdate): Promise<AccountProfile> {
        return request('/api/auth/profile', { method: 'PATCH', body: payload });
    },
    async sessions(): Promise<AccountSession[]> {
        return request('/api/auth/sessions');
    },
    async signOutOtherSessions(): Promise<RevokedSessions> {
        return request('/api/auth/sessions/others', { method: 'DELETE' });
    },
    async deactivate(currentPassword: string): Promise<void> {
        {
            await request<void>('/api/auth/deactivate', { method: 'POST', body: { currentPassword } satisfies AccountDeactivation });
            return;
        }
    },
    async adminUsers(query: AdminUsersQuery): Promise<AdminUsersPage> {
        {
            const params = queryString(query);
            return request(`/api/admin/users?${params}`);
        }
    },
    async adminCreateUser(payload: AdminUserCreate): Promise<TemporaryPassword> {
        return request('/api/admin/users', { method: 'POST', body: payload });
    },
    async adminSetUserStatus(username: string, payload: AdminStatusUpdate): Promise<AdminStatusResult> {
        return request(`/api/admin/users/${encodeURIComponent(username)}/status`, { method: 'PATCH', body: payload });
    },
    async adminSetUserRole(username: string, payload: AdminRoleUpdate): Promise<AdminRoleResult> {
        return request(`/api/admin/users/${encodeURIComponent(username)}/role`, { method: 'PATCH', body: payload });
    },
    async adminResetPassword(username: string): Promise<TemporaryPassword> {
        return request(`/api/admin/users/${encodeURIComponent(username)}/password-reset`, { method: 'POST', body: {} });
    },
    async adminRevokeSessions(username: string): Promise<RevokedSessions> {
        return request(`/api/admin/users/${encodeURIComponent(username)}/sessions`, { method: 'DELETE' });
    },
    async adminUserQuota(username: string): Promise<AccountQuota> {
        return request(`/api/admin/users/${encodeURIComponent(username)}/quota`);
    },
    async adminUpdateQuota(username: string, payload: QuotaUpdate): Promise<AccountQuota> {
        return request(`/api/admin/users/${encodeURIComponent(username)}/quota`, { method: 'PUT', body: payload });
    },
    async adminUserEvents(username: string): Promise<AccountEvent[]> {
        return request(`/api/admin/users/${encodeURIComponent(username)}/events`);
    },
    async adminRegistration(): Promise<AdminRegistration> {
        return request('/api/admin/registration');
    },
    async adminInvites(): Promise<RegistrationInvite[]> {
        return request('/api/admin/invites');
    },
    async adminCreateInvite(payload: InviteCreate): Promise<InviteCreated> {
        return request('/api/admin/invites', { method: 'POST', body: payload });
    },
    async adminRevokeInvite(id: string): Promise<void> {
        return request(`/api/admin/invites/${encodeURIComponent(id)}`, { method: 'DELETE' });
    },
    async login(username: string, password: string) {
        {
            const result = await request<SessionUser>('/api/auth/login', { method: 'POST', body: { username, password } });
            return result;
        }
    },
    async createPortableLoginLink(currentPassword: string) {
        return request<PortableLoginGrant>('/api/auth/portable-links', { method: 'POST', body: { currentPassword } });
    },
    async portableLoginLinks() {
        return request<PortableLoginLink[]>('/api/auth/portable-links');
    },
    async revokePortableLoginLink(id: string) {
        await request<void>(`/api/auth/portable-links/${encodeURIComponent(id)}`, { method: 'DELETE' });
    },
    async consumePortableLogin(token: string) {
        const base = apiBase();
        if (base && !base.startsWith('https:') && !/^http:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(base)) throw new Error('便携登录需要 HTTPS。');
        const user = await request<SessionUser>('/api/auth/portable-login', { method: 'POST', body: { token } });
        return user;
    },
    async currentUser() {
        return request<SessionUser>('/api/auth/me');
    },
    async logout() { try { await request('/api/auth/logout', { method: 'POST' }) } finally { clearCookies() } },
    async changePassword(currentPassword: string, newPassword: string, signOutOthers = true) {
        {
            await request('/api/auth/password', { method: 'POST', body: { currentPassword, newPassword, signOutOthers } satisfies PasswordChange });
        }
    },
};
