import type { NarrativeText } from './roadmapNarrativePlanner';
const MAX_ENTRIES = 2048, MAX_BYTES = 8 * 1024 * 1024, TTL_MS = 15 * 60000;
const entries = new Map<string, {
    text: NarrativeText;
    expires: number;
    bytes: number;
}>();
let bytes = 0;
// Bounded process-local suppression of repeated invalid model content, never a successful cache hit.
const rejected = new Map<string, { attempts: number; expires: number }>();
const REJECTION_WINDOW_MS = 5 * 60000, MAX_INVALID_ATTEMPTS = 2;
export function canRequestNarrative(owner: string, id: string, version: string): boolean {
    const key = `${owner}:${id}:${version}`, value = rejected.get(key);
    if (!value) return true;
    if (value.expires <= Date.now()) { rejected.delete(key); return true; }
    return value.attempts < MAX_INVALID_ATTEMPTS;
}
export function recordInvalidNarrative(owner: string, id: string, version: string): void {
    const key = `${owner}:${id}:${version}`, previous = rejected.get(key);
    const value = previous && previous.expires > Date.now() ? previous : { attempts: 0, expires: Date.now() + REJECTION_WINDOW_MS };
    rejected.delete(key);
    while (rejected.size >= MAX_ENTRIES) rejected.delete(rejected.keys().next().value!);
    rejected.set(key, { attempts: Math.min(MAX_INVALID_ATTEMPTS, value.attempts + 1), expires: value.expires });
}
function remove(key: string) { const value = entries.get(key); if (value)
    bytes -= value.bytes; entries.delete(key); }
export function getNarrativeText(owner: string, id: string, version: string): NarrativeText | undefined {
    const key = `${owner}:${id}:${version}`, value = entries.get(key);
    if (!value)
        return;
    if (value.expires <= Date.now()) {
        remove(key);
        return;
    }
    entries.delete(key);
    entries.set(key, value);
    return { ...value.text };
}
export function putNarrativeText(owner: string, id: string, version: string, text: NarrativeText) {
    const key = `${owner}:${id}:${version}`, size = Buffer.byteLength(JSON.stringify(text)) + key.length * 2;
    if (size > MAX_BYTES)
        return;
    remove(key);
    rejected.delete(key);
    while (entries.size >= MAX_ENTRIES || bytes + size > MAX_BYTES) {
        const first = entries.keys().next().value;
        if (first === undefined)
            break;
        remove(first);
    }
    // No latest-version pointer: concurrent results cannot overwrite another version.
    entries.set(key, { text: { ...text }, expires: Date.now() + TTL_MS, bytes: size });
    bytes += size;
}
export function clearRoadmapNarrativeCache() { entries.clear(); rejected.clear(); bytes = 0; }
export const getRoadmapNarrativeCacheStats = () => ({ entries: entries.size, estimatedBytes: bytes, maxEntries: MAX_ENTRIES, maxBytes: MAX_BYTES });
