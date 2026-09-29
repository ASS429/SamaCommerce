#!/usr/bin/env sh
# Démarrage de l'API sur Render : prépare l'application puis sert via Apache sur $PORT.
set -e

# APP_KEY : idéalement défini en variable d'environnement Render
# (php artisan key:generate --show en local pour l'obtenir). Sinon, on en
# génère une éphémère (déconnecte les sessions à chaque redémarrage —
# acceptable pour une démo, à fixer pour la production).
if [ -z "$APP_KEY" ]; then
  APP_KEY="$(php artisan key:generate --show)"
  export APP_KEY
  echo "APP_KEY générée à la volée (pensez à la fixer dans Render pour la persistance)."
fi

php artisan config:clear

# Schéma sur Supabase (idempotent). Avant de migrer, Laravel reconnaît sous leur
# nom français les migrations déjà jouées (base:harmoniser-migrations, lancée
# automatiquement) : sans cela, il recréerait des tables vides. La traduction
# du schéma s'exécute dans UNE transaction : si elle échoue, rien n'est
# modifié et ce conteneur ne démarre pas — Render garde alors l'ancien.
php artisan migrate --force

# Peuple la démonstration au TOUT PREMIER démarrage (base vide) — l'offre
# gratuite de Render n'a pas d'accès en ligne de commande. Ignoré ensuite (ne
# duplique jamais). Non bloquant.
php artisan base:amorcer-si-vide || true

# Verrouille le compte administrateur : applique ADMIN_PASSWORD, ou NEUTRALISE
# le compte si la variable est absente. Les identifiants de démonstration
# figurent dans un dépôt public — laisser « password » ouvrirait l'administration à tous.
php artisan admin:securiser || true

# Configuration mise en cache pour la performance (non bloquant : un échec ne
# doit jamais empêcher le démarrage). On N'utilise PAS route:cache
# (incompatible avec les fonctions anonymes).
php artisan config:cache || true

# Apache doit écouter le port fourni par Render.
PORT="${PORT:-80}"
sed -ri "s/^Listen 80$/Listen ${PORT}/" /etc/apache2/ports.conf
sed -ri "s/:80>/:${PORT}>/" /etc/apache2/sites-available/000-default.conf

exec apache2-foreground
