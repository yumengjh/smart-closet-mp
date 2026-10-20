import { isOnline } from '../services/lifecycle'
import { createUuid } from '../domain/id';
import { reactive } from 'vue';
import { agentRequest, AgentRequestError } from './api';
import { useClosetStore } from '../stores/closet';
import { traceScene } from './trace-data';
import type { OutfitScene } from '../domain/outfit';
export const traceUpload = reactive({ pending: 0, error: '' });
type Entry = {
    session: string;
    body: Record<string, unknown>;
};
const queues = new Map<string, Entry[]>();
let sending = false;
function queue(owner: string) {
    let entries = queues.get(owner);
    if (!entries) {
        try {
            entries = JSON.parse(uni.getStorageSync(`yixu.trace-outbox.v1:${owner}`) || '[]');
        }
        catch { }
        queues.set(owner, Array.isArray(entries) ? entries : []);
    }
    return queues.get(owner)!;
}
function save(owner: string) {
    traceUpload.pending = queue(owner).length;
    try {
        uni.setStorageSync(`yixu.trace-outbox.v1:${owner}`, JSON.stringify(queue(owner)));
    }
    catch {
        traceUpload.error = '本机存储不足，未上传记录暂留内存，请保持页面打开。';
    }
}
export function recordBoardTrace(owner: string, session: string, boardId: string, source: string, before?: OutfitScene, after?: OutfitScene, extra: Record<string, unknown> = {}) {
    let device: string | null = null;
    let sequence = Date.now();
    try {
        device = uni.getStorageSync('yixu.trace-device.v1');
        sequence = Math.max(sequence, Number(uni.getStorageSync('yixu.trace-sequence.v1') || '0') + 1);
        uni.setStorageSync('yixu.trace-sequence.v1', String(sequence));
    }
    catch { }
    if (!device) {
        device = createUuid();
        try {
            uni.setStorageSync('yixu.trace-device.v1', device);
        }
        catch { }
    }
    queue(owner).push({ session, body: { eventId: createUuid(), deviceId: device, clientSequence: sequence, occurredAt: Date.now(), workspaceId: `agent:${session}`, boardId, source, before: traceScene(before), after: traceScene(after), ...extra } });
    save(owner);
    void flushBoardTrace();
}
export async function flushBoardTrace() {
    if (sending)
        return;
    const owner = useClosetStore().user?.username;
    if (!owner || !isOnline())
        return;
    sending = true;
    try {
        const entries = queue(owner);
        while (entries.length && useClosetStore().user?.username === owner) {
            const entry = entries[0]!;
            try {
                await agentRequest(`/sessions/${entry.session}/board-events`, 'POST', entry.body);
            }
            catch (e) {
                if (e instanceof AgentRequestError && e.status === 404) {
                    entries.shift();
                    save(owner);
                    continue;
                }
                ;
                traceUpload.error = e instanceof Error ? e.message : '画板记录未上传';
                break;
            }
            entries.shift();
            traceUpload.error = '';
            save(owner);
        }
    }
    finally {
        sending = false;
        traceUpload.pending = queue(owner).length;
    }
}
export function discardSessionTrace(owner: string, session?: string) {
    queues.set(owner, queue(owner).filter(e => session && e.session !== session));
    save(owner);
}
uni.onNetworkStatusChange(status => { if (status.isConnected) void flushBoardTrace() });
