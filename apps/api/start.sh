#!/usr/bin/env sh
# Démarrage de l'API sur Render : prépare l'app puis sert via Apache sur $PORT.
set -e

# APP_KEY : idéalement défini en variable d'env Render (php artisan key:generate --show
# en local pour l'obtenir). Sinon, on en génère une éphémère (déconnecte les sessions
# à chaque redémarrage — acceptable pour une démo, à fixer pour la prod).
if [ -z "$APP_KEY" ]; then
  APP_KEY="$(php artisan key:generate --show)"
  export APP_KEY
  echo "APP_KEY généré à la volée (pense à le fixer dans Render pour la persistance)."
fi

php artisan config:clear

# Schéma sur Supabase (idempotent).
php artisan migrate --force

# Peuple la démo au TOUT PREMIER démarrage (base vide) — Render free n'a pas de
# Shell. Ignoré ensuite (ne duplique jamais). Non bloquant.
php artisan db:seed-if-empty || true

# Cache config pour la performance (non bloquant : un échec ne doit jamais
# empêcher le démarrage). On N'utilise PAS route:cache (incompatible closures).
php artisan config:cache || true

# Apache doit écouter le port fourni par Render.
PORT="${PORT:-80}"
sed -ri "s/^Listen 80$/Listen ${PORT}/" /etc/apache2/ports.conf
sed -ri "s/:80>/:${PORT}>/" /etc/apache2/sites-available/000-default.conf

exec apache2-foreground
