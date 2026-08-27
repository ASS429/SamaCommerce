<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\CategoryController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\SaleController;
use App\Http\Controllers\StatsController;
use App\Http\Controllers\TontineController;
use App\Http\Controllers\ClientController;
use App\Http\Controllers\FournisseurController;
use App\Http\Controllers\CaisseController;
use App\Http\Controllers\ReturnController;
use App\Http\Controllers\CommandeController;
use App\Http\Controllers\LivraisonController;
use App\Http\Controllers\BoutiqueController;
use App\Http\Controllers\MemberController;
use App\Http\Controllers\Admin\AdminUserController;
use App\Http\Controllers\Admin\AdminStatsController;
use App\Http\Controllers\Admin\WithdrawalController;
use App\Http\Controllers\Admin\TransferController;
use App\Http\Controllers\Admin\SettingController;
use Illuminate\Support\Facades\Route;

/*
 * T8 — Versionnage de l'API. Toutes les routes sont déclarées dans une closure
 * enregistrée DEUX fois :
 *   - à la racine   → /api/...      (rétro-compatible : le web actuel ne change pas)
 *   - sous /v1      → /api/v1/...   (contrat figé pour l'app mobile à venir)
 * Le même code de contrôleur sert les deux ; la version fige surtout l'URL et,
 * via les API Resources, la FORME du JSON (montants entiers, dates ISO).
 */
$registerApiRoutes = function (): void {

// --- Healthcheck agrégé (public, pour le monitoring) — T14 ---
Route::get('/health', [\App\Http\Controllers\HealthController::class, 'index']);

// --- Authentification (publique) ---
Route::post('/auth/register', [AuthController::class, 'register'])->middleware('throttle:10,1');
Route::post('/auth/login', [AuthController::class, 'login'])->middleware('throttle:30,1');
Route::post('/auth/forgot-password', [AuthController::class, 'forgotPassword'])->middleware('throttle:5,1');
Route::post('/auth/reset-password', [AuthController::class, 'resetPassword'])->middleware('throttle:5,1');
Route::post('/auth/verify-2fa', [AuthController::class, 'verify2fa'])->middleware('throttle:10,1');

// Aperçu d'une invitation : forcément PUBLIC, l'invité n'a pas encore de
// compte. Le jeton (48 caractères aléatoires) est le seul secret ; le débit est
// bridé pour qu'on ne puisse pas en essayer au hasard.
Route::get('/members/invite/{token}', [MemberController::class, 'preview'])->middleware('throttle:20,1');

// --- Routes protégées (token Sanctum + résolution employé/propriétaire) ---
// S8 — limiteur global par utilisateur (60 req/min) en plus des throttles ciblés.
Route::middleware(['auth:sanctum', 'tenant', 'throttle:api'])->group(function () {
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::post('/auth/logout-all', [AuthController::class, 'logoutAll']);
    Route::put('/auth/profile', [AuthController::class, 'updateProfile']);
    // Réglages d'écran du compte connecté (sections masquées, impression auto).
    Route::put('/auth/preferences', [AuthController::class, 'updatePreferences']);
    Route::put('/auth/upgrade', [AuthController::class, 'upgrade']);
    Route::put('/auth/2fa', [AuthController::class, 'toggle2fa']);

    // Boutiques (multi-boutique)
    Route::get('/boutiques', [BoutiqueController::class, 'index']);
    // Vue consolidée de TOUTES les boutiques (déclarée avant /{id} pour ne pas
    // être capturée par le paramètre de route).
    Route::get('/boutiques/dashboard', [BoutiqueController::class, 'dashboard']);
    Route::post('/boutiques', [BoutiqueController::class, 'store']);
    Route::post('/boutiques/{id}/switch', [BoutiqueController::class, 'switch']);
    Route::get('/boutiques/{id}/stats', [BoutiqueController::class, 'stats']);
    Route::match(['put', 'patch'], '/boutiques/{id}', [BoutiqueController::class, 'update']);
    Route::delete('/boutiques/{id}', [BoutiqueController::class, 'destroy']);

    // Journal d'activité (audit du tenant)
    Route::get('/activity', [\App\Http\Controllers\ActivityController::class, 'index']);

    // IA — aide à la décision (Module A réappro, Module B scoring crédit)
    // S8 — throttle:ia plus strict (micro-service ML coûteux).
    Route::middleware('throttle:ia')->group(function () {
        Route::get('/ia/reappro', [\App\Http\Controllers\IaController::class, 'reappro']);
        Route::post('/ia/credit-score', [\App\Http\Controllers\IaController::class, 'creditScore']);
    });

    // Équipe / membres
    Route::get('/members', [MemberController::class, 'index']);
    Route::post('/members/invite', [MemberController::class, 'invite']);
    Route::post('/members/accept', [MemberController::class, 'accept']);
    Route::get('/members/my-boutique', [MemberController::class, 'myBoutique']);
    Route::match(['put', 'patch'], '/members/{id}', [MemberController::class, 'update']);
    Route::delete('/members/{id}', [MemberController::class, 'destroy']);

    // Produits — la LECTURE de la liste est aussi ouverte aux vendeurs (POS) :
    // un employé avec la seule permission « vente » doit voir les produits.
    Route::get('/products', [ProductController::class, 'index'])->middleware('perm:stock|vente');
    Route::middleware('perm:stock')->group(function () {
        Route::get('/products/trash', [ProductController::class, 'trash']); // T4 corbeille
        Route::get('/products/{id}', [ProductController::class, 'show']);
        Route::post('/products', [ProductController::class, 'store']);
        Route::post('/products/{id}/restore', [ProductController::class, 'restore']); // T4
        Route::match(['put', 'patch'], '/products/{id}', [ProductController::class, 'update']);
        Route::delete('/products/{id}', [ProductController::class, 'destroy']);
    });

    // Catégories — lecture ouverte aux vendeurs (filtres du POS).
    Route::get('/categories', [CategoryController::class, 'index'])->middleware('perm:categories|vente');
    Route::middleware('perm:categories')->group(function () {
        Route::post('/categories', [CategoryController::class, 'store']);
        Route::match(['put', 'patch'], '/categories/{id}', [CategoryController::class, 'update']);
        Route::delete('/categories/{id}', [CategoryController::class, 'destroy']);
    });

    // Ventes
    Route::middleware('perm:vente')->group(function () {
        Route::get('/sales', [SaleController::class, 'index']);
        Route::get('/sales/trash', [SaleController::class, 'trash']); // T4 corbeille
        Route::post('/sales', [SaleController::class, 'store']);
        Route::post('/sales/sync', [SaleController::class, 'sync']); // T11 offline-first
        Route::post('/sales/{id}/restore', [SaleController::class, 'restore']); // T4
        Route::match(['put', 'patch'], '/sales/{id}', [SaleController::class, 'update']);
        Route::delete('/sales/{id}', [SaleController::class, 'destroy']);
    });

    // Tontines
    Route::get('/tontines', [TontineController::class, 'index']);
    Route::post('/tontines', [TontineController::class, 'store']);

    // Clients
    Route::get('/clients/for-sale', [ClientController::class, 'forSale'])->middleware('perm:vente');
    Route::middleware('perm:clients')->group(function () {
        Route::get('/clients', [ClientController::class, 'index']);
        Route::get('/clients/{id}', [ClientController::class, 'show']);
        Route::get('/clients/{id}/stats', [ClientController::class, 'stats']);
        Route::post('/clients', [ClientController::class, 'store']);
        Route::match(['put', 'patch'], '/clients/{id}', [ClientController::class, 'update']);
        Route::delete('/clients/{id}', [ClientController::class, 'destroy']);
    });

    // Commandes (réappro fournisseurs)
    Route::middleware('perm:commandes')->group(function () {
        Route::get('/commandes', [CommandeController::class, 'index']);
        Route::get('/commandes/{id}', [CommandeController::class, 'show']);
        Route::post('/commandes', [CommandeController::class, 'store']);
        Route::patch('/commandes/{id}/recevoir', [CommandeController::class, 'recevoir']);
        Route::match(['put', 'patch'], '/commandes/{id}', [CommandeController::class, 'update']);
        Route::delete('/commandes/{id}', [CommandeController::class, 'destroy']);
    });

    // Livraisons (suivi des réappros)
    Route::middleware('perm:livraisons')->group(function () {
        Route::get('/livraisons', [LivraisonController::class, 'index']);
        Route::get('/livraisons/{id}', [LivraisonController::class, 'show']);
        Route::post('/livraisons', [LivraisonController::class, 'store']);
        Route::match(['put', 'patch'], '/livraisons/{id}', [LivraisonController::class, 'update']);
        Route::delete('/livraisons/{id}', [LivraisonController::class, 'destroy']);
    });

    // Retours
    Route::middleware('perm:credits')->group(function () {
        Route::get('/returns', [ReturnController::class, 'index']);
        Route::get('/returns/stats', [ReturnController::class, 'stats']);
        Route::post('/returns', [ReturnController::class, 'store']);
    });

    // Caisse
    Route::middleware('perm:caisse')->group(function () {
        Route::get('/caisse/today', [CaisseController::class, 'today']);
        Route::get('/caisse/history', [CaisseController::class, 'history']);
        Route::get('/caisse/weekly', [CaisseController::class, 'weekly']);
        Route::post('/caisse/close', [CaisseController::class, 'close']);
    });

    // Fournisseurs
    Route::middleware('perm:fournisseurs')->group(function () {
        Route::get('/fournisseurs', [FournisseurController::class, 'index']);
        Route::get('/fournisseurs/{id}/reappro-message', [FournisseurController::class, 'reapproMessage']);
        Route::post('/fournisseurs', [FournisseurController::class, 'store']);
        Route::match(['put', 'patch'], '/fournisseurs/{id}', [FournisseurController::class, 'update']);
        Route::delete('/fournisseurs/{id}', [FournisseurController::class, 'destroy']);
    });

    // Statistiques (mêmes endpoints que l'app d'origine)
    /* Chiffres de l'en-tête d'accueil, agrégés en base (voir StatsController).
       HORS du groupe « stats » : celui-ci exige perm:rapports, alors que ces
       trois chiffres s'affichent à tout vendeur. Le contrôleur masque de
       lui-même les champs auxquels l'employé n'a pas droit. */
    Route::get('/stats/resume-jour', [StatsController::class, 'resumeJour'])->middleware('perm:stock|vente');

    Route::prefix('stats')->middleware('perm:rapports')->group(function () {
        Route::get('/ventes-par-categorie', [StatsController::class, 'ventesParCategorie']);
        Route::get('/ventes-par-jour', [StatsController::class, 'ventesParJour']);
        Route::get('/paiements', [StatsController::class, 'paiements']);
        Route::get('/top-produits', [StatsController::class, 'topProduits']);
        Route::get('/stock-faible', [StatsController::class, 'stockFaible']);
        Route::get('/marge-categorie', [StatsController::class, 'margeParCategorie']);
        Route::get('/rotation-stock', [StatsController::class, 'rotationStock']);
        Route::get('/meilleurs-clients', [StatsController::class, 'meilleursClients']);
        Route::get('/marchandage', [StatsController::class, 'marchandage']);
    });
});

// --- Routes ADMIN (token Sanctum + rôle admin) ---
Route::middleware(['auth:sanctum', 'admin'])->group(function () {
    // Gestion des utilisateurs / abonnés
    Route::get('/auth/users', [AdminUserController::class, 'index']);
    Route::post('/auth/users', [AdminUserController::class, 'store']);
    Route::put('/auth/users/{id}/block', [AdminUserController::class, 'block']);
    Route::put('/auth/users/{id}/activate', [AdminUserController::class, 'activate']);
    Route::delete('/auth/users/{id}', [AdminUserController::class, 'destroy']);
    Route::post('/auth/users/{id}/reminder', [AdminUserController::class, 'reminder']);
    Route::put('/auth/upgrade/{id}/approve', [AdminUserController::class, 'approveUpgrade']);
    Route::put('/auth/upgrade/{id}/reject', [AdminUserController::class, 'rejectUpgrade']);

    // Statistiques admin
    Route::prefix('admin-stats')->group(function () {
        Route::get('/overview', [AdminStatsController::class, 'overview']);
        Route::get('/revenus/evolution', [AdminStatsController::class, 'evolution']);
        Route::get('/revenus', [AdminStatsController::class, 'revenus']);
        Route::get('/transactions', [AdminStatsController::class, 'transactions']);
        Route::get('/accounts/{method}', [AdminStatsController::class, 'accountDetails']);
        Route::get('/accounts', [AdminStatsController::class, 'accounts']);
    });

    // Retraits / transferts / paramètres
    Route::get('/admin-withdrawals', [WithdrawalController::class, 'index']);
    Route::post('/admin-withdrawals', [WithdrawalController::class, 'store']);
    Route::get('/admin-transfers', [TransferController::class, 'index']);
    Route::post('/admin-transfers', [TransferController::class, 'store']);
    Route::get('/admin-settings', [SettingController::class, 'show']);
    Route::put('/admin-settings', [SettingController::class, 'update']);
    Route::patch('/admin-settings/twofa', [SettingController::class, 'toggle2fa']);
});

}; // fin de $registerApiRoutes

// Racine (rétro-compat) + namespace versionné /v1.
$registerApiRoutes();
Route::prefix('v1')->group($registerApiRoutes);
