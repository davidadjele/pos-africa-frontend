#!/usr/bin/env bash
# Parcours Playwright contre le vrai backend, sur une base neuve :
#   PostgreSQL (projet compose dédié, volume supprimé à la fin), backend en profil dev, puis Vite.
# Usage : npm run test:e2e:reel   (DOSSIER_BACKEND, DOSSIER_CAPTURES facultatifs)
set -euo pipefail

FRONTEND="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND="${DOSSIER_BACKEND:-$FRONTEND/../pos-africa-backend}"
PROJET_COMPOSE="pos-africa-e2e"
JOURNAL="$FRONTEND/test-results/backend-e2e.log"

# Administrateur de test, créé par le backend au premier démarrage sur la base neuve.
export APP_ADMIN_EMAIL="${APP_ADMIN_EMAIL:-admin.e2e@tonti.africa}"
export APP_ADMIN_MOT_DE_PASSE="${APP_ADMIN_MOT_DE_PASSE:-Admin-e2e-2026}"

for port in 5432 8080; do
  if lsof -ti "tcp:$port" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "Le port $port est déjà occupé : arrêtez le PostgreSQL ou le backend de développement." >&2
    exit 1
  fi
done

arreter() {
  echo "Arrêt du backend et de la base de test…"
  if [[ -n "${PID_BACKEND:-}" ]]; then kill "$PID_BACKEND" 2>/dev/null || true; fi
  # bootRun lance l'application dans une JVM à part : on libère le port qu'elle occupe.
  lsof -ti tcp:8080 -sTCP:LISTEN 2>/dev/null | xargs kill 2>/dev/null || true
  (cd "$BACKEND" && docker compose -p "$PROJET_COMPOSE" down -v >/dev/null 2>&1) || true
}
trap arreter EXIT

mkdir -p "$FRONTEND/test-results"
(cd "$BACKEND" && docker compose -p "$PROJET_COMPOSE" up -d --wait)

(cd "$BACKEND" && ./gradlew bootRun --console=plain >"$JOURNAL" 2>&1) &
PID_BACKEND=$!

echo "Démarrage du backend (journal : $JOURNAL)…"
for _ in $(seq 1 180); do
  if curl -fs http://localhost:8080/actuator/health >/dev/null 2>&1; then break; fi
  if ! kill -0 "$PID_BACKEND" 2>/dev/null; then
    echo "Le backend s'est arrêté au démarrage :" >&2
    tail -40 "$JOURNAL" >&2
    exit 1
  fi
  sleep 1
done
curl -fs http://localhost:8080/actuator/health >/dev/null

cd "$FRONTEND"
npx playwright test -c playwright.reel.config.ts "$@"
