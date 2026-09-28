# Conventions — pos-africa-frontend

Arbitrages : `docs/decisions/` et `../pos-africa-backend/docs/decisions/` (notamment 0002 sur les jetons). `../pos-africa-backend/docs/cadrage.md` est un historique non maintenu.

## Méthode
- **TDD** : un test rouge avant chaque code de production.
- Pyramide : ~70 % Vitest (logique pure : panier, totaux, montants, partage d'addition), ~20 % composants (Testing Library + MSW), ~10 % Playwright (parcours critiques, desktop, tablette et mobile).
- Chaque étape est validée avec le porteur du projet avant la suivante.

## Langue et nommage
- Code et documentation **en français**, sans accents dans les identifiants : `EcranCaisse`, `useCommande`, `calculerRenduMonnaie()`.
- Commentaire = un **pourquoi** non évident. Pas de documentation pour la documentation.

## Stack
React + Vite + TypeScript, TanStack Router, TanStack Query (état serveur), Zustand (panier de caisse uniquement), Tailwind + shadcn/ui (entièrement re-thémé), react-hook-form + zod, i18next (fr/en), vite-plugin-pwa, client API généré depuis l'OpenAPI du backend (openapi-typescript).

## Structure
`src/app/` (routes, providers), `src/fonctionnalites/<module>/` (pages, composants, hooks), `src/partage/` (ui, api générée, i18n, montants, auth).

## Règles
- **Montants** : entiers en unités mineures + devise, formatés par un seul utilitaire (`12 500 F CFA`) avec des chiffres tabulaires. Jamais d'arithmétique en `number` flottant sur des montants.
- **Access token en mémoire uniquement**, jamais dans localStorage ou sessionStorage. Refresh silencieux au démarrage, et un seul refresh à la fois.
- Interdit : `dangerouslySetInnerHTML` (vérifié par lint). CSP stricte dans `vercel.json`.
- Les règles métier et permissions sont appliquées côté backend. L'interface les reflète (boutons masqués ou désactivés), elle ne les remplace pas.
- Erreurs : afficher le message traduit à partir du code métier Problem Details, et montrer le `traceId` pour le support.
- En cas de conflit 409 : recharger la commande et informer l'utilisateur, sans écraser.

## Design : pro, pas « site IA »
- Références : logiciels de caisse professionnels (Toast, Square, Lightspeed, Loyverse). Des outils denses et efficaces, pas des landing pages.
- **Interdits** :
  - dégradés violet ou indigo, texte en dégradé ;
  - glassmorphism, halos, emojis ou étincelles comme icônes ;
  - cartes très arrondies avec ombres partout ;
  - animations décoratives ;
  - thème shadcn par défaut ;
  - slogans marketing creux.
- **Principes** :
  - bordures fines plutôt qu'ombres, rayon de bordure 4–6 px ;
  - **une seule** couleur d'accent, pour l'action principale ; couleurs sémantiques réservées aux statuts ;
  - cibles tactiles ≥ 48 px en caisse ; contraste fort (plein soleil, tablettes bas de gamme) ;
  - états vides, d'erreur et de chargement réellement conçus.
- Données réalistes dans les maquettes et fixtures : « Poulet braisé », « Flag 65 cl », « 12 500 F CFA », « T4 – Terrasse ».
