#!/usr/bin/env sh
# Démarrage de l'API sur Render : prépare l'app puis sert sur $PORT.
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

# Schéma sur Supabase (idempotent). Ne SEED pas ici : lancer une fois à la main
# via le Shell Render :  php artisan db:seed --force
php artisan migrate --force

# Cache config pour la performance (non bloquant : un échec ne doit jamais
# empêcher le démarrage). On N'utilise PAS route:cache (incompatible closures).
php artisan config:cache || true

exec php artisan serve --host 0.0.0.0 --port "${PORT:-8000}"
