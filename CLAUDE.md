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

## Outillage
- Node 24 (`.nvmrc`). TypeScript bloqué en 6.0 et ESLint en 9 tant que typescript-eslint, eslint-plugin-react et jsx-a11y ne suivent pas.
- Scripts : `lint`, `typecheck`, `test` (couverture ≥ 80 % sur `src/partage`), `build`, `test:e2e` (Playwright sous la CSP de production), `api:generer` (client OpenAPI depuis le backend local).

## Structure
`src/app/` (routes, providers), `src/fonctionnalites/<module>/` (pages, composants, hooks), `src/partage/` (ui, api générée, i18n, montants, auth).

## Règles
- **Tailwind limité aux jetons** : les classes par défaut (palette, tailles, ombres) n'existent pas, seules les classes Tonti (`bg-accent`, `text-badge`, `rounded-petit`…). `src/partage/theme/jetons.css` est la seule source des couleurs et se régénère depuis `tokens.json` du design system.
- Tout montant s'affiche via `formaterMontant` (formes `longue` « 13 500 FCFA », `courte` « 13 500 F », `nombre`), les chiffres avec la classe `chiffres`.
- Tout appel réseau passe par `appelerApi` ; toute erreur est une `ErreurApi`. Un nouveau `CodeErreur` backend s'ajoute à `CODES_ERREUR` et à `fr.json`/`en.json` (un test le vérifie). `RESEAU_INDISPONIBLE` est le seul code propre au client.
- `localStorage` et `sessionStorage` interdits dans le code applicatif (règle ESLint).
- PWA : mise à jour sur demande (bandeau « Recharger »), jamais de rechargement d'office pendant un encaissement. Aucune mise en cache des appels API.
- Avant la production : ajouter l'origine de l'API à `connect-src` dans `vercel.json`.
- **Montants** : entiers en unités mineures + devise, formatés par un seul utilitaire (`12 500 F CFA`) avec des chiffres tabulaires. Jamais d'arithmétique en `number` flottant sur des montants.
- **Access token en mémoire uniquement**, jamais dans localStorage ou sessionStorage. Refresh silencieux au démarrage, et un seul refresh à la fois.
- Interdit : `dangerouslySetInnerHTML` (vérifié par lint). CSP stricte dans `vercel.json`.
- Les règles métier et permissions sont appliquées côté backend. L'interface les reflète (boutons masqués ou désactivés), elle ne les remplace pas.
- Erreurs : l'API renvoie toujours `ReponseErreur` (`statut`, `code`, `message`, `traceId`, `champs`). Afficher le message traduit à partir de `code` (ou `message` à défaut), placer `champs` sous les champs du formulaire, et montrer le `traceId` pour le support.
- En cas de conflit 409 : recharger la commande et informer l'utilisateur, sans écraser.

## Design : pro, pas « site IA »
- Direction retenue : **Tonti**, avec la **palette de Gestion RH Africa** : navy `#00102B` pour la structure **et l'action principale** (une seule par écran, texte blanc), orange `#ED4F28` réservé au focus et aux compteurs, fond pierre `#F5F4F0`, surfaces blanches, statuts « readable » de Gestion RH Africa. Police **Neulis** (celle de Gestion RH Africa, fichiers OTF à copier depuis `../gestionrhafrica-v2-ui/public/fonts/`, auto-hébergés) pour tout le texte ; **Barlow Semi Condensed** pour les montants, prix, quantités et heures, car Neulis n'a pas de chiffres tabulaires. Rayon de 6 px.
- **Un rebranding viendra** : couleurs et polices ne passent que par des jetons (`--font-texte`, `--font-chiffres`, `--accent`…), jamais en dur, pour être changées en un seul endroit. Référence : design system Tonti (claude.ai).
- **Les couleurs de marque seront configurables par établissement** : le code ne référence que des jetons sémantiques (`--accent`, `--barre-fond`…), jamais une couleur en dur. Les couleurs de statut (succès, alerte, danger) restent fixes. La couleur du texte posé sur l'accent est calculée pour garder le contraste.
- Références : logiciels de caisse professionnels (Toast, Square, Lightspeed, Loyverse). Des outils denses et efficaces, pas des landing pages.
- **Interdits** :
  - dégradés violet ou indigo, texte en dégradé ;
  - glassmorphism, halos, emojis ou étincelles comme icônes ;
  - cartes très arrondies avec ombres partout ;
  - animations décoratives ;
  - thème shadcn par défaut ;
  - slogans marketing creux ;
  - les pastilles rondes avec point et les « chips » arrondies : un statut est un badge **rectangulaire** teinté (rayon 4 px, 11–12 px, semi-gras), comme dans la référence visuelle ;
  - le point médian « · » comme séparateur (« Lomé · Bè Kpota ») : utiliser une virgule, un retour à la ligne ou la mise en page.
- **Principes** :
  - bordures fines plutôt qu'ombres, rayon de bordure 4–6 px ;
  - **une seule** couleur d'accent, pour l'action principale ; couleurs sémantiques réservées aux statuts ;
  - cibles tactiles ≥ 48 px en caisse ; contraste fort (plein soleil, tablettes bas de gamme) ;
  - états vides, d'erreur et de chargement réellement conçus.
- Données réalistes dans les maquettes et fixtures : « Poulet braisé », « Flag 65 cl », « 12 500 F CFA », « T4 – Terrasse ».
