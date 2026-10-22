import { SERVED_MINISTRIES, SITE_URL, WHATSAPP } from './src/config/site.js';
import { execFileSync } from "node:child_process";
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  let buildId = process.env.CF_PAGES_COMMIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA;
  if (!buildId) { try { buildId = execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(); } catch { buildId = 'build-'+Date.now(); } }
  const builtAt = new Date().toISOString();
  return {
    define: { 'import.meta.env.VITE_BUILD_ID': JSON.stringify(buildId) },
    plugins: [
      { name: 'service-share-metadata', transformIndexHtml: { order: 'pre', handler(html) {
        const description = `فطار وغداء وسوبر ماركت باسم طلبات العاصمة. بنخدم حاليًا ${SERVED_MINISTRIES.join('، ')}، والاستلام عند بوابة الوزارة.`;
        const schema = { '@context':'https://schema.org', '@graph':[
          { '@type':'Organization', '@id':SITE_URL+'/#organization', name:'طلبات العاصمة', alternateName:'Capital Talabat', url:SITE_URL+'/', logo:SITE_URL+'/icons/icon-512.png', telephone:'+'+WHATSAPP },
          { '@type':'LocalBusiness', '@id':SITE_URL+'/#service', name:'طلبات العاصمة', url:SITE_URL+'/', image:SITE_URL+'/social/cover.png', telephone:'+'+WHATSAPP, areaServed:SERVED_MINISTRIES.map(name=>({'@type':'Place',name:name+' — الحي الحكومي بالعاصمة الإدارية، مصر'})), description, currenciesAccepted:'EGP', paymentAccepted:'InstaPay, Vodafone Cash', parentOrganization:{'@id':SITE_URL+'/#organization'} }
        ] };
        return html.replaceAll('__SERVICE_DESCRIPTION__',description.replaceAll('&','&amp;').replaceAll('"','&quot;')).replace('__SERVICE_SCHEMA__',JSON.stringify(schema).replaceAll('<','\\u003c'));
      } } },
      { name: 'preview-noindex' , transformIndexHtml: { order: 'pre', handler(html) { return process.env.VERCEL_ENV === 'preview' ? html.replace('</head>', '<meta name="robots" content="noindex, nofollow"></head>') : html; } } },
      { name: 'capital-build-info', generateBundle() { this.emitFile({type:'asset',fileName:'build-info.json',source:JSON.stringify({id:buildId,builtAt})}); } },
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        // The Workbox glob below already includes public icons. Adding them
        // through the manifest as well produces conflicting cache revisions.
        includeManifestIcons: false,
        manifest: {
          id: '/',
          name: 'طلبات العاصمة',
          short_name: 'طلبات العاصمة',
          description:
            'فطارك وغداءك لبوابة وزارتك مع طلبات العاصمة.',
          theme_color: '#10213f',
          background_color: '#f8fafc',
          display: 'standalone',
          orientation: 'any',
          dir: 'rtl',
          lang: 'ar',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/icons/icon-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/icons/icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
          ],
        },
        workbox: {
          // Only Vite's hashed chunks are immutable; public/assets images are not.
          dontCacheBustURLsMatching: /^assets\/[^/]+-[A-Za-z0-9_-]{8,}\.(?:js|css)$/,
          globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg,webp,woff2}'],
          // Fetch current HTML on navigation instead of pinning visitors to precached releases.
          globIgnores: ['**/index.html', 'assets/aistudio/1__*.png', 'assets/aistudio/image_*.png', 'assets/aistudio/edc*.jpg', 'images/breakfast.jpg', 'images/coffee.jpg', 'images/cafe.jpg', 'images/office.jpg'],
          navigateFallback: null,
          runtimeCaching: [
            {
              urlPattern: ({ request, url }) => request.mode === 'navigate' && url.origin === self.location.origin,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'capital-page-navigation',
                networkTimeoutSeconds: 4,
                cacheableResponse: { statuses: [200] },
                expiration: { maxEntries: 12, maxAgeSeconds: 24 * 60 * 60 },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: false,
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio to prevent WebSocket connection errors and flickering.
      hmr: false,
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
