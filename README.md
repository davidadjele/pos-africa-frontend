# POS Africa — Frontend

Application web responsive (desktop, tablette, mobile) de la plateforme POS pour restaurants, maquis et bars.
SPA React + Vite + TypeScript, déployée sur Vercel.

Trois espaces :

- `/caisse` : prise de commande et encaissement, plein écran, optimisé tablette ;
- `/gestion` : back-office multi-établissement ;
- `/r/:jeton` : reçu public partagé par WhatsApp.

- Décisions d'architecture : [docs/decisions/](docs/decisions/)
- Conventions : [CLAUDE.md](CLAUDE.md)

## Démarrage

Prérequis : Node 24 (`nvm use`).

```sh
npm ci
cp .env.example .env.local   # VITE_URL_API=http://localhost:8080
npm run dev                  # http://localhost:5173
```

| Commande              | Rôle                                                                 |
| --------------------- | -------------------------------------------------------------------- |
| `npm run lint`        | ESLint et Prettier                                                   |
| `npm run typecheck`   | TypeScript strict                                                    |
| `npm run test`        | Vitest avec couverture (seuil 80 % sur `src/partage`)                |
| `npm run build`       | Build de production dans `dist/`                                     |
| `npm run test:e2e`    | Playwright (desktop, tablette paysage, mobile) contre `vite preview` |
| `npm run api:generer` | Types de l'API depuis l'OpenAPI du backend lancé en local            |

Premier lancement des tests e2e : `npx playwright install chromium`.

## Déploiement

`vercel.json` renvoie les routes vers `index.html` et pose les en-têtes de sécurité (CSP stricte).
`vite preview` sert les mêmes en-têtes, donc les tests e2e échouent si une ressource viole la CSP.

Avant la mise en production, ajouter l'origine de l'API à `connect-src` dans `vercel.json`,
par exemple `connect-src 'self' https://api.exemple.com`.
