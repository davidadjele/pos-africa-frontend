import { readFileSync } from 'node:fs'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
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

export default defineConfig({
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
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [],
      },
    }),
  ],
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true, headers: enTetesProduction() },
})
