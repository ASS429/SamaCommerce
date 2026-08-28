# SamaCommerce — API Laravel 13 (PHP 8.4 + Apache) pour Render (runtime: docker)
# Build context = apps/api (rootDir dans render.yaml).
# NB : composer.lock (Symfony 8.1 / Laravel 13.17) exige PHP >= 8.4.1.
# Apache/mod_php remplace `php artisan serve` (serveur de DEV, instable sous
# rafales de requêtes SPA → connexions coupées constatées en prod).
FROM php:8.4-apache

# Dépendances système + extensions PHP (pdo_pgsql pour Supabase).
# ca-certificates est EXPLICITE : l'envoi des e-mails passe par l'API HTTPS de
# Resend (Render bloque les ports SMTP sortants). Sans magasin de certificats,
# chaque envoi echouerait sur « unable to get local issuer certificate ».
RUN apt-get update && apt-get install -y --no-install-recommends \
        git unzip libpq-dev libzip-dev libicu-dev ca-certificates \
    && docker-php-ext-install pdo pdo_pgsql zip intl bcmath opcache \
    && a2enmod rewrite \
    && rm -rf /var/lib/apt/lists/*

# Apache : servir Laravel depuis /public + limites adaptées au free tier (512 Mo).
ENV APACHE_DOCUMENT_ROOT=/var/www/html/public
# Recette officielle docker-php pour déplacer le DocumentRoot.
RUN sed -ri -e 's!/var/www/html!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/sites-available/*.conf \
    && sed -ri -e 's!/var/www/!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/apache2.conf /etc/apache2/conf-available/*.conf \
    && printf '<IfModule mpm_prefork_module>\n  StartServers 2\n  MinSpareServers 1\n  MaxSpareServers 3\n  MaxRequestWorkers 4\n  MaxConnectionsPerChild 300\n</IfModule>\n' > /etc/apache2/conf-available/lowmem.conf \
    && a2enconf lowmem

# Opcache + limite mémoire PHP. DIMENSIONNEMENT CRITIQUE (free tier = 512 Mo) :
# 4 workers x 128 Mo = 512 Mo au pire cas (usage réel ~50 Mo/requête). Des
# valeurs plus larges (10 x 192 Mo) faisaient tuer le conteneur pour OOM sous
# rafale → l'API devenait injoignable en pleine session (ERR_FAILED).
RUN printf 'opcache.enable=1\nopcache.memory_consumption=48\nmemory_limit=128M\n' > /usr/local/etc/php/conf.d/samacommerce.ini

# Composer (copié depuis l'image officielle).
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html
COPY . .

RUN composer install --no-dev --optimize-autoloader --no-interaction --no-progress \
    && chown -R www-data:www-data storage bootstrap/cache

ENV APP_ENV=production

# Migrations/seed puis Apache sur le port fourni par Render ($PORT).
CMD ["sh", "start.sh"]
