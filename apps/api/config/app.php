<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Application Name
    |--------------------------------------------------------------------------
    |
    | This value is the name of your application, which will be used when the
    | framework needs to place the application's name in a notification or
    | other UI elements where an application name needs to be displayed.
    |
    */

    'name' => env('APP_NAME', 'Laravel'),

    /*
    |--------------------------------------------------------------------------
    | Cache des statistiques (T13)
    |--------------------------------------------------------------------------
    |
    | Désactivé par défaut : à l'échelle d'une boutique les statistiques se
    | calculent en quelques millisecondes, alors qu'un store de cache en défaut
    | provoquait des erreurs 500 en production. Activer avec STATS_CACHE=true
    | seulement si le volume de données le justifie.
    |
    */

    'stats_cache' => env('STATS_CACHE', false),

    /*
    |--------------------------------------------------------------------------
    | Version applicative
    |--------------------------------------------------------------------------
    |
    | Exposée par /api/health : permet de vérifier quel build est réellement en
    | ligne (indispensable pour diagnostiquer après un déploiement).
    |
    */

    'version' => env('APP_VERSION', '3.1.0'),

    /*
    |--------------------------------------------------------------------------
    | Application Environment
    |--------------------------------------------------------------------------
    |
    | This value determines the "environment" your application is currently
    | running in. This may determine how you prefer to configure various
    | services the application utilizes. Set this in your ".env" file.
    |
    */

    'env' => env('APP_ENV', 'production'),

    /*
    |--------------------------------------------------------------------------
    | Application Debug Mode
    |--------------------------------------------------------------------------
    |
    | When your application is in debug mode, detailed error messages with
    | stack traces will be shown on every error that occurs within your
    | application. If disabled, a simple generic error page is shown.
    |
    */

    'debug' => (bool) env('APP_DEBUG', false),

    /*
    |--------------------------------------------------------------------------
    | Application URL
    |--------------------------------------------------------------------------
    |
    | This URL is used by the console to properly generate URLs when using
    | the Artisan command line tool. You should set this to the root of
    | the application so that it's available within Artisan commands.
    |
    */

    'url' => env('APP_URL', 'http://localhost'),

    /*
    | Adresse publique de l'application web. Elle sert à fabriquer les liens
    | qu'on envoie aux gens (invitation d'un employé, par exemple) : ces liens
    | doivent être absolus et cliquables depuis WhatsApp, y compris quand la
    | requête ne porte pas d'en-tête `Origin` (client mobile, script, webhook).
    */
    'frontend_url' => env('FRONTEND_URL'),

    /*
    |--------------------------------------------------------------------------
    | Application Timezone
    |--------------------------------------------------------------------------
    |
    | Here you may specify the default timezone for your application, which
    | will be used by the PHP date and date-time functions. The timezone
    | is set to "UTC" by default as it is suitable for most use cases.
    |
    */

    'timezone' => 'UTC',

    /*
    |--------------------------------------------------------------------------
    | Application Locale Configuration
    |--------------------------------------------------------------------------
    |
    | The application locale determines the default locale that will be used
    | by Laravel's translation / localization methods. This option can be
    | set to any locale for which you plan to have translation strings.
    |
    */

    /*
    | L'application s'adresse à des commerçants sénégalais : sa langue par
    | défaut est le français. Les messages de validation traduits vivaient déjà
    | dans lang/fr/, mais cette clé valait 'en' et n'était surchargée nulle part
    | — un commerçant qui choisissait un mot de passe trop faible lisait donc
    | « The given password has appeared in a data leak ».
    */
    'locale' => env('APP_LOCALE', 'fr'),

    'fallback_locale' => env('APP_FALLBACK_LOCALE', 'en'),

    'faker_locale' => env('APP_FAKER_LOCALE', 'en_US'),

    /*
    |--------------------------------------------------------------------------
    | Encryption Key
    |--------------------------------------------------------------------------
    |
    | This key is utilized by Laravel's encryption services and should be set
    | to a random, 32 character string to ensure that all encrypted values
    | are secure. You should do this prior to deploying the application.
    |
    */

    'cipher' => 'AES-256-CBC',

    'key' => env('APP_KEY'),

    'previous_keys' => [
        ...array_filter(
            explode(',', (string) env('APP_PREVIOUS_KEYS', ''))
        ),
    ],

    /*
    |--------------------------------------------------------------------------
    | Maintenance Mode Driver
    |--------------------------------------------------------------------------
    |
    | These configuration options determine the driver used to determine and
    | manage Laravel's "maintenance mode" status. The "cache" driver will
    | allow maintenance mode to be controlled across multiple machines.
    |
    | Supported drivers: "file", "cache"
    |
    */

    'maintenance' => [
        'driver' => env('APP_MAINTENANCE_DRIVER', 'file'),
        'store' => env('APP_MAINTENANCE_STORE', 'database'),
    ],

];
