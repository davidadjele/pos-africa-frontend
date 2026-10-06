import { readFileSync } from 'node:fs'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type ProxyOptions } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Les couleurs du manifeste sont des littéraux : le manifeste ne lit pas les variables CSS.
// Elles doivent suivre --barre-fond et --fond de src/partage/theme/jetons.css.
const NAVY = '#00102b'
const PIERRE = '#f5f4f0'

interface ConfigurationVercel {
  headers: { source: string; headers: { key: string; value: string }[] }[]
}

// vite preview sert les mêmes en-têtes de sécurité que Vercel : les tests e2e échouent
// si une ressource viole la CSP de production.
function enTetesProduction(): Record<string, string> {
  const vercel = JSON.parse(readFileSync('vercel.json', 'utf8')) as ConfigurationVercel
  const communs = vercel.headers.find((regle) => regle.source === '/(.*)')?.headers ?? []
  return Object.fromEntries(communs.map(({ key, value }) => [key, value]))
}

// L'application appelle toujours /api sur sa propre origine : la CSP reste « connect-src 'self' »
// et le cookie de rafraîchissement (SameSite=Strict) est envoyé. En production, c'est la réécriture
// de vercel.json qui relaie /api vers le backend.
function relaisApi(urlBackend: string): Record<string, ProxyOptions> {
  return {
    '/api': {
      target: urlBackend,
      changeOrigin: true,
      rewrite: (chemin) => chemin.replace(/^\/api/, ''),
      // Le backend pose le cookie sur Path=/auth ; vu du navigateur, ces routes sont sous /api/auth.
      cookiePathRewrite: { '/auth': '/api/auth' },
    },
  }
}

export default defineConfig(({ mode }) => {
  const urlBackend = loadEnv(mode, process.cwd(), '').URL_BACKEND ?? 'http://localhost:8080'
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'prompt',
        // Enregistrement fait par BandeauMiseAJour : un script inline violerait la CSP.
        injectRegister: false,
        includeAssets: ['favicon.svg', 'polices/*.otf'],
        manifest: {
          name: 'Tonti',
          short_name: 'Tonti',
          description: 'Caisse et gestion pour restaurants, maquis et bars.',
          lang: 'fr',
          start_url: '/',
          display: 'standalone',
          theme_color: NAVY,
          background_color: PIERRE,
          icons: [
            { src: 'icones/icone-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icones/icone-512.png', sizes: '512x512', type: 'image/png' },
            {
              src: 'icones/icone-masquable-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          // Seule la coquille de l'application est mise en cache. Le hors ligne des données
          // (commandes, catalogue) fera l'objet d'un chantier dédié : aucun appel API n'est intercepté.
          globPatterns: ['**/*.{js,css,html,svg,png,otf,woff2}'],
          // Les captures du manuel se chargent à la lecture d'un guide : l'installation n'a pas à les télécharger.
          globIgnores: ['manuel/**'],
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api\//],
          runtimeCaching: [],
        },
      }),
    ],
    server: { port: 5173, strictPort: true, proxy: relaisApi(urlBackend) },
    preview: {
      port: 4173,
      strictPort: true,
      headers: enTetesProduction(),
      proxy: relaisApi(urlBackend),
    },
  }
})
