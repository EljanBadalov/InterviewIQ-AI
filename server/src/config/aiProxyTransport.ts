/** Server-only credentials. Never forward them through redirects or plain remote HTTP. */
export function aiProxyRequestOptions(baseUrl: string, source: NodeJS.ProcessEnv = process.env) {
  const url = new URL(baseUrl);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  const id = source.CF_ACCESS_CLIENT_ID?.trim();
  const secret = source.CF_ACCESS_CLIENT_SECRET?.trim();
  const key = source.QWEN_PROXY_API_KEY?.trim();
  const secure = source.QWEN_REQUIRE_SECURE_PROXY === 'true';
  if (url.username || url.password || !['http:', 'https:'].includes(url.protocol) ||
      Boolean(id) !== Boolean(secret) || ((id || secret || secure || (key && !local)) && url.protocol !== 'https:') ||
      (secure && (!id || !secret || !key || local || url.hostname.endsWith('.trycloudflare.com')))) {
    throw new Error('Invalid AI proxy security configuration');
  }
  const headers: Record<string, string> = {'Content-Type': 'application/json'};
  if (id && secret) { headers['CF-Access-Client-Id'] = id; headers['CF-Access-Client-Secret'] = secret; }
  if (key) headers.Authorization = `Bearer ${key}`;
  return {headers, redirect: 'error' as const};
}
