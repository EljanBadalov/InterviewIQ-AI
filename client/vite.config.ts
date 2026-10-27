import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({mode}) => {
  const values = loadEnv(mode, process.cwd(), 'VITE_');
  if (process.env.VERCEL === '1' || process.env.INTERVIEWIQ_CLOUD_BUILD === 'true') {
    const url = new URL(process.env.VITE_API_URL || values.VITE_API_URL || '');
    if (url.protocol !== 'https:' || ['localhost','127.0.0.1','[::1]'].includes(url.hostname) ||
        url.username || url.password || !url.pathname.replace(/\/$/,'').endsWith('/api/v1')) {
      throw new Error('Cloud frontend requires an HTTPS Render VITE_API_URL ending in /api/v1');
    }
  }
  return {plugins:[react()], base:'/'};
});
