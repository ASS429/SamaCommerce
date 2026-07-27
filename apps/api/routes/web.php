<?php

use Illuminate\Support\Facades\Route;

// API-only : la racine renvoie vers le healthcheck. `Route::redirect` est
// « cacheable » (pas de closure) → compatible avec `php artisan route:cache`.
Route::redirect('/', '/api/health');
