# SamaCommerce — API Laravel 13 (PHP 8.3) pour Render (runtime: docker)
# Build context = apps/api (rootDir dans render.yaml).
FROM php:8.3-cli

# Dépendances système + extensions PHP (pdo_pgsql pour Supabase).
RUN apt-get update && apt-get install -y --no-install-recommends \
        git unzip libpq-dev libzip-dev libicu-dev \
    && docker-php-ext-install pdo pdo_pgsql zip intl bcmath \
    && rm -rf /var/lib/apt/lists/*

# Composer (copié depuis l'image officielle).
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /app
COPY . .

RUN composer install --no-dev --optimize-autoloader --no-interaction --no-progress

ENV APP_ENV=production
EXPOSE 8000

# Migrations + serveur sur le port fourni par Render ($PORT).
CMD ["sh", "start.sh"]
