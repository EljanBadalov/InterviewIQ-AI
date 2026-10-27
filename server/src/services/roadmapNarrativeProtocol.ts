/** Transport-only compression. Canonical IDs, content versions and bounded facts stay intact. */
export function compactNarrativePacket<T extends { nodes: Array<{ context: any; [key: string]: unknown }> }>(payload: T): T | { contexts: unknown[]; nodes: unknown[] } {
    const contexts: unknown[] = [];
    const references = new Map<string, number>();
    const nodes = payload.nodes.map(({ context, ...node }) => {
        const { intent, ...shared } = context;
        const key = JSON.stringify(shared);
        let index = references.get(key);
        if (index === undefined) { index = contexts.length; references.set(key, index); contexts.push(shared); }
        return { ...node, contextRef: index, ...(intent === undefined ? {} : { intent }) };
    });
    const candidate = { ...payload, contexts, nodes };
    // Preserve inline facts if a partial batch cannot benefit from a reference table.
    return Buffer.byteLength(JSON.stringify(candidate)) < Buffer.byteLength(JSON.stringify(payload)) ? candidate : payload;
}
