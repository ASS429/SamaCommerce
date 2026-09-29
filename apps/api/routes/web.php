<?php

use Illuminate\Support\Facades\Route;

// API seule : la racine renvoie vers l'état de santé. `Route::redirect` est
// « cachable » (pas de fonction anonyme) → compatible avec `php artisan route:cache`.
Route::redirect('/', '/api/sante');
