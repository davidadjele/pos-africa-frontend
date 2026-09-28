# 0001 — SPA React + Vite plutôt que Next.js

**Statut** : accepté (2026-09-27)

## Contexte
L'application est entièrement derrière une authentification, son API est en Spring Boot, et elle doit pouvoir fonctionner hors ligne plus tard.

## Décision
SPA React + Vite + TypeScript en PWA, déployée sur Vercel (preset Vite, avec un `vercel.json` qui renvoie les routes vers `index.html`).

## Pourquoi
- Le SSR et le SEO n'apportent rien derrière une connexion, et les routes API de Next seraient redondantes avec Spring.
- Le mode hors ligne (service worker, IndexedDB) est plus simple dans une SPA.
- Un éventuel site vitrine pourra être fait à part en Next.js.
