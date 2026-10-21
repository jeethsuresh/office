import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { createHash } from "node:crypto";
export default defineConfig({
  plugins: [
    react(),
    {
      name: "office-offline",
      apply: "build",
      enforce: "post",
      generateBundle(_options, bundle) {
        const assets = [
          ...new Set([
            "/",
            "/index.html",
            "/favicon.svg",
            ...Object.keys(bundle).map((file) => `/${file}`),
          ]),
        ];
        const version = createHash("sha256")
          .update(assets.join("\n"))
          .digest("hex")
          .slice(0, 12);
        this.emitFile({
          type: "asset",
          fileName: "sw.js",
          source: `const CACHE='office-static-${version}';const LOCAL=['localhost','127.0.0.1','[::1]'].includes(location.hostname);const ASSETS=${JSON.stringify(assets)};
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('office-static-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{const request=event.request,url=new URL(request.url);if(request.method!=='GET'||url.origin!==location.origin||(url.pathname.startsWith('/api/')&&(!LOCAL||url.pathname!=='/api/workspace'))||url.pathname.startsWith('/auth/'))return;
event.respondWith(fetch(request).then(response=>{if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(request,copy)));}return response;}).catch(async()=>{const saved=await caches.match(request);if(saved)return saved;if(request.mode==='navigate')return caches.match('/index.html');throw new Error('Unavailable offline');}));});`,
        });
      },
    },
  ],
  server: {
    host: "127.0.0.1",
    port: 5174,
    strictPort: true,
    proxy: { "/api": { target: "http://127.0.0.1:4317", ws: true }, "/auth": { target: "http://127.0.0.1:4317" } },
  },
  build: { outDir: "dist", emptyOutDir: true },
});
