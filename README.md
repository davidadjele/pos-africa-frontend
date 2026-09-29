# POS Africa — Frontend

Application web responsive (desktop, tablette, mobile) de la plateforme POS pour restaurants, maquis et bars.
SPA React + Vite + TypeScript, déployée sur Vercel.

Espaces :

- `/connexion`, `/choix-entreprise`, `/inscription` (seulement si le backend l'ouvre) : entrée ;
- `/caisse` : prise de commande et encaissement, plein écran, optimisé tablette (session d'entreprise) ;
- `/gestion` : back-office multi-établissement (session d'entreprise) ;
- `/plateforme` : administration des entreprises clientes (session plateforme) ;
- `/r/:jeton` : reçu public partagé par WhatsApp.

- Décisions d'architecture : [docs/decisions/](docs/decisions/)
- Conventions : [CLAUDE.md](CLAUDE.md)

## Démarrage

Prérequis : Node 24 (`nvm use`).

```sh
npm ci
cp .env.example .env.local   # URL_BACKEND=http://localhost:8080 (facultatif, c'est la valeur par défaut)
npm run dev                  # http://localhost:5173, backend lancé à part (voir son README)
```

L'application appelle toujours `/api/…` sur sa propre origine. Vite (`dev` et `preview`) relaie `/api` vers
`URL_BACKEND` en retirant le préfixe, et réécrit le chemin du cookie de rafraîchissement (`/auth` →
`/api/auth`). Ainsi la CSP reste `connect-src 'self'` et le cookie `SameSite=Strict` est envoyé.
Le jeton d'accès reste en mémoire : un rechargement de page rouvre la session par `POST /auth/rafraichir`.

| Commande                | Rôle                                                                                                                                                                                            |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run lint`          | ESLint et Prettier                                                                                                                                                                              |
| `npm run typecheck`     | TypeScript strict                                                                                                                                                                               |
| `npm run test`          | Vitest avec couverture (seuil 80 % sur `src/partage`)                                                                                                                                           |
| `npm run build`         | Build de production dans `dist/`                                                                                                                                                                |
| `npm run test:e2e`      | Playwright (desktop, tablette paysage, mobile) contre `vite preview`, API simulée                                                                                                               |
| `npm run test:e2e:reel` | Parcours Playwright contre le vrai backend (voir ci-dessous)                                                                                                                                    |
| `npm run api:generer`   | Types de l'API (`src/partage/api/schema.d.ts`) depuis `../pos-africa-backend/docs/api/openapi.json` ; `URL_OPENAPI=http://localhost:8080/v3/api-docs npm run api:generer` pour le backend lancé |

Premier lancement des tests e2e : `npx playwright install chromium`.

### Parcours contre le vrai backend

`npm run test:e2e:reel` lance `scripts/e2e-reel.sh` : PostgreSQL dans un projet compose dédié
(`pos-africa-e2e`, base neuve), le backend (`./gradlew bootRun`, profil dev, administrateur de test
`APP_ADMIN_EMAIL` / `APP_ADMIN_MOT_DE_PASSE`), puis Vite et Playwright (`playwright.reel.config.ts`,
dossier `e2e-reel/`). Tout est arrêté et le volume supprimé à la fin. Prérequis : Docker, Java 21, la
paire de clés JWT de dev du backend, et les ports 5432 et 8080 libres. Captures d'écran dans
`test-results/captures-1a/` (ou `DOSSIER_CAPTURES`). Ce parcours n'est pas lancé en CI, faute de backend.

## Déploiement

`vercel.json` relaie `/api/:chemin*` vers le backend (réécriture externe), renvoie les autres routes vers
`index.html` et pose les en-têtes de sécurité (CSP stricte). `vite preview` sert les mêmes en-têtes, donc
les tests e2e échouent si une ressource viole la CSP.

L'URL du backend de production est à un seul endroit : la destination de la première réécriture de
`vercel.json` (`https://api.tonti.africa/:chemin*`, à ajuster). Côté backend, il faut en production :

- l'origine du frontend dans `APP_CORS_ORIGINESAUTORISEES` (contrôle d'origine de `/auth/rafraichir`) ;
- un cookie de rafraîchissement posé sur `Path=/api/auth` : Vercel ne réécrit pas le chemin des cookies
  comme le fait Vite en développement ;
- la prise en compte de `X-Forwarded-For` (adresse réelle du client pour la limitation des tentatives).
