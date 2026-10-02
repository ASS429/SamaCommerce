<?php

use App\Http\Controllers\Admin\ControleurParametres;
use App\Http\Controllers\Admin\ControleurRetraits;
use App\Http\Controllers\Admin\ControleurCommercants;
use App\Http\Controllers\Admin\ControleurFinances;
use App\Http\Controllers\Admin\ControleurPaiements;
use App\Http\Controllers\Admin\ControleurPlans;
use App\Http\Controllers\Admin\ControleurReglages;
use App\Http\Controllers\Admin\ControleurTableauDeBord;
use App\Http\Controllers\Admin\ControleurTransferts;
use App\Http\Controllers\Admin\ControleurUtilisateurs;
use App\Http\Controllers\ControleurAbonnement;
use App\Http\Controllers\ControleurActivite;
use App\Http\Controllers\ControleurAuthentification;
use App\Http\Controllers\ControleurBoutique;
use App\Http\Controllers\ControleurCaisse;
use App\Http\Controllers\ControleurCategorie;
use App\Http\Controllers\ControleurClient;
use App\Http\Controllers\ControleurCommande;
use App\Http\Controllers\ControleurErreurNavigateur;
use App\Http\Controllers\ControleurFournisseur;
use App\Http\Controllers\ControleurIa;
use App\Http\Controllers\ControleurLivraison;
use App\Http\Controllers\ControleurMembre;
use App\Http\Controllers\ControleurProduit;
use App\Http\Controllers\ControleurRetour;
use App\Http\Controllers\ControleurSante;
use App\Http\Controllers\ControleurStatistiques;
use App\Http\Controllers\ControleurTontine;
use App\Http\Controllers\ControleurVente;
use Illuminate\Support\Facades\Route;

/*
 * T8 — Versionnage de l'API. Toutes les routes sont déclarées dans une fonction
 * enregistrée DEUX fois :
 *   - à la racine   → /api/...      (adresse utilisée par l'application web)
 *   - sous /v1      → /api/v1/...   (contrat figé pour l'application mobile à venir)
 * Le même code de contrôleur sert les deux ; la version fige surtout l'adresse
 * et, via les ressources, la FORME du JSON (montants entiers, dates ISO).
 */
$enregistrerRoutes = function (): void {

// --- État de santé agrégé (public, pour la surveillance) — T14 ---
Route::get('/sante', [ControleurSante::class, 'afficher']);

// --- Authentification (publique) ---
Route::post('/auth/inscription', [ControleurAuthentification::class, 'inscrire'])->middleware('throttle:10,1');
Route::post('/auth/connexion', [ControleurAuthentification::class, 'connecter'])->middleware('throttle:30,1');
Route::post('/auth/mot-de-passe-oublie', [ControleurAuthentification::class, 'motDePasseOublie'])->middleware('throttle:5,1');
Route::post('/auth/reinitialiser-mot-de-passe', [ControleurAuthentification::class, 'reinitialiserMotDePasse'])->middleware('throttle:5,1');
Route::post('/auth/verifier-double-facteur', [ControleurAuthentification::class, 'verifierDoubleFacteur'])->middleware('throttle:10,1');

// Aperçu d'une invitation : forcément PUBLIC, l'invité n'a pas encore de
// compte. Le jeton (48 caractères aléatoires) est le seul secret ; le débit est
// bridé pour qu'on ne puisse pas en essayer au hasard.
Route::get('/membres/invitation/{jeton}', [ControleurMembre::class, 'apercu'])->middleware('throttle:20,1');

// Erreurs JavaScript remontées par les navigateurs des utilisateurs.
// PUBLIQUE à dessein : beaucoup de plantages arrivent avant la connexion.
// Débit bridé, charge plafonnée par la validation, aucune réponse renvoyée.
Route::post('/erreurs-navigateur', [ControleurErreurNavigateur::class, 'creer'])
    ->middleware('throttle:20,1');

// --- Routes protégées (jeton Sanctum + résolution employé/propriétaire) ---
// S8 — limiteur global par utilisateur en plus des limites ciblées.
Route::middleware(['auth:sanctum', 'proprietaire', 'throttle:api'])->group(function () {
    Route::get('/auth/moi', [ControleurAuthentification::class, 'moi']);
    Route::post('/auth/deconnexion', [ControleurAuthentification::class, 'deconnecter']);
    Route::post('/auth/deconnexion-partout', [ControleurAuthentification::class, 'deconnecterPartout']);
    // Appareils connectés (un par jeton) et déconnexion des autres seulement.
    Route::get('/auth/appareils', [ControleurAuthentification::class, 'appareils']);
    Route::post('/auth/deconnexion-autres', [ControleurAuthentification::class, 'deconnecterAutres']);
    Route::put('/auth/profil', [ControleurAuthentification::class, 'modifierProfil']);
    // Réglages d'écran du compte connecté (sections masquées, impression auto).
    Route::put('/auth/preferences', [ControleurAuthentification::class, 'modifierPreferences']);
    Route::put('/auth/double-facteur', [ControleurAuthentification::class, 'basculerDoubleFacteur']);
    // Second temps de l'activation (30/09/2026) : le code reçu par e-mail.
    // Limité : 6 chiffres ne doivent pas pouvoir se deviner par essais.
    Route::post('/auth/double-facteur/confirmer', [ControleurAuthentification::class, 'confirmerDoubleFacteur'])
        ->middleware('throttle:10,1');

    // Abonnement : état, plans, où payer ; déclaration d'un paiement (vérifié
    // ensuite par l'administrateur — rien ne s'active avant).
    Route::get('/abonnement', [ControleurAbonnement::class, 'etat']);
    Route::get('/abonnement/paiements', [ControleurAbonnement::class, 'historique']);
    Route::post('/abonnement/paiements', [ControleurAbonnement::class, 'declarer'])->middleware('throttle:10,1');

    /* Fonctionnalités réservées à certains plans : 'plan:x' (tout est réservé)
       ou 'plan:x,ecriture' (la LECTURE reste permise : un commerçant repassé au
       plan Gratuit retrouve toujours ses données). Cf. VerifierPlan. */

    // Boutiques (multi-boutique)
    Route::get('/boutiques', [ControleurBoutique::class, 'lister']);
    // Vue consolidée de TOUTES les boutiques (déclarée avant /{id} pour ne pas
    // être capturée par le paramètre de route).
    Route::get('/boutiques/tableau-de-bord', [ControleurBoutique::class, 'tableauDeBord'])->middleware('plan:tableau_boutiques');
    Route::post('/boutiques', [ControleurBoutique::class, 'creer']);
    Route::post('/boutiques/{id}/activer', [ControleurBoutique::class, 'activer']);
    Route::get('/boutiques/{id}/statistiques', [ControleurBoutique::class, 'statistiques']);
    Route::match(['put', 'patch'], '/boutiques/{id}', [ControleurBoutique::class, 'modifier']);
    Route::delete('/boutiques/{id}', [ControleurBoutique::class, 'supprimer']);

    // Journal d'activité du propriétaire
    Route::get('/activite', [ControleurActivite::class, 'lister'])->middleware('plan:journal_activite');

    // IA — aide à la décision (Module A réappro, Module B score de crédit)
    // S8 — limite plus stricte (micro-service ML coûteux).
    Route::middleware('throttle:ia')->group(function () {
        Route::get('/ia/reappro', [ControleurIa::class, 'reappro']);
        Route::post('/ia/score-credit', [ControleurIa::class, 'scoreCredit']);
    });

    // Équipe / membres
    Route::get('/membres', [ControleurMembre::class, 'lister']);
    Route::post('/membres/inviter', [ControleurMembre::class, 'inviter']);
    Route::post('/membres/accepter', [ControleurMembre::class, 'accepter']);
    Route::get('/membres/ma-boutique', [ControleurMembre::class, 'maBoutique']);
    Route::match(['put', 'patch'], '/membres/{id}', [ControleurMembre::class, 'modifier']);
    Route::delete('/membres/{id}', [ControleurMembre::class, 'supprimer']);

    // Produits — la LECTURE de la liste est aussi ouverte aux vendeurs :
    // un employé avec la seule permission « vente » doit voir les produits.
    Route::get('/produits', [ControleurProduit::class, 'lister'])->middleware('perm:stock|vente');
    Route::middleware('perm:stock')->group(function () {
        Route::get('/produits/corbeille', [ControleurProduit::class, 'corbeille']); // T4
        Route::get('/produits/{id}', [ControleurProduit::class, 'afficher']);
        Route::post('/produits', [ControleurProduit::class, 'creer']);
        Route::post('/produits/{id}/restaurer', [ControleurProduit::class, 'restaurer']); // T4
        Route::match(['put', 'patch'], '/produits/{id}', [ControleurProduit::class, 'modifier']);
        Route::delete('/produits/{id}', [ControleurProduit::class, 'supprimer']);
    });

    // Catégories — lecture ouverte aux vendeurs (filtres de la vente).
    Route::get('/categories', [ControleurCategorie::class, 'lister'])->middleware('perm:categories|vente');
    Route::middleware('perm:categories')->group(function () {
        Route::post('/categories', [ControleurCategorie::class, 'creer']);
        Route::match(['put', 'patch'], '/categories/{id}', [ControleurCategorie::class, 'modifier']);
        Route::delete('/categories/{id}', [ControleurCategorie::class, 'supprimer']);
    });

    // Ventes
    Route::middleware('perm:vente')->group(function () {
        Route::get('/ventes', [ControleurVente::class, 'lister']);
        Route::get('/ventes/corbeille', [ControleurVente::class, 'corbeille']); // T4
        Route::post('/ventes', [ControleurVente::class, 'creer']);
        Route::post('/ventes/synchroniser', [ControleurVente::class, 'synchroniser']); // T11 hors ligne d'abord
        Route::post('/ventes/{id}/restaurer', [ControleurVente::class, 'restaurer']); // T4
        Route::match(['put', 'patch'], '/ventes/{id}', [ControleurVente::class, 'modifier']);
        Route::delete('/ventes/{id}', [ControleurVente::class, 'supprimer']);
    });

    // Tontines
    Route::get('/tontines', [ControleurTontine::class, 'lister']);
    Route::post('/tontines', [ControleurTontine::class, 'creer']);

    // Clients
    Route::get('/clients/pour-vente', [ControleurClient::class, 'pourVente'])->middleware('perm:vente');
    Route::middleware('perm:clients')->group(function () {
        Route::get('/clients', [ControleurClient::class, 'lister']);
        Route::get('/clients/{id}', [ControleurClient::class, 'afficher']);
        Route::get('/clients/{id}/statistiques', [ControleurClient::class, 'statistiques']);
        Route::post('/clients', [ControleurClient::class, 'creer']);
        Route::match(['put', 'patch'], '/clients/{id}', [ControleurClient::class, 'modifier']);
        Route::delete('/clients/{id}', [ControleurClient::class, 'supprimer']);
    });

    // Commandes (réappro fournisseurs)
    Route::middleware(['perm:commandes', 'plan:fournisseurs_commandes,ecriture'])->group(function () {
        Route::get('/commandes', [ControleurCommande::class, 'lister']);
        Route::get('/commandes/{id}', [ControleurCommande::class, 'afficher']);
        Route::post('/commandes', [ControleurCommande::class, 'creer']);
        Route::patch('/commandes/{id}/recevoir', [ControleurCommande::class, 'recevoir']);
        Route::match(['put', 'patch'], '/commandes/{id}', [ControleurCommande::class, 'modifier']);
        Route::delete('/commandes/{id}', [ControleurCommande::class, 'supprimer']);
    });

    // Livraisons (suivi des réappros)
    Route::middleware(['perm:livraisons', 'plan:livraisons,ecriture'])->group(function () {
        Route::get('/livraisons', [ControleurLivraison::class, 'lister']);
        Route::get('/livraisons/{id}', [ControleurLivraison::class, 'afficher']);
        Route::post('/livraisons', [ControleurLivraison::class, 'creer']);
        Route::match(['put', 'patch'], '/livraisons/{id}', [ControleurLivraison::class, 'modifier']);
        Route::delete('/livraisons/{id}', [ControleurLivraison::class, 'supprimer']);
    });

    // Retours
    Route::middleware(['perm:credits', 'plan:inventaire_retours,ecriture'])->group(function () {
        Route::get('/retours', [ControleurRetour::class, 'lister']);
        Route::get('/retours/statistiques', [ControleurRetour::class, 'statistiques']);
        Route::get('/retours/ventes-retournables', [ControleurRetour::class, 'ventesRetournables']);
        Route::post('/retours', [ControleurRetour::class, 'creer']);
    });

    // Caisse
    Route::middleware('perm:caisse')->group(function () {
        Route::get('/caisse/aujourdhui', [ControleurCaisse::class, 'aujourdhui']);
        Route::get('/caisse/historique', [ControleurCaisse::class, 'historique']);
        Route::get('/caisse/semaine', [ControleurCaisse::class, 'semaine']);
        Route::post('/caisse/cloturer', [ControleurCaisse::class, 'cloturer']);
    });

    // Fournisseurs
    Route::middleware(['perm:fournisseurs', 'plan:fournisseurs_commandes,ecriture'])->group(function () {
        Route::get('/fournisseurs', [ControleurFournisseur::class, 'lister']);
        Route::get('/fournisseurs/{id}/message-reappro', [ControleurFournisseur::class, 'messageReappro']);
        Route::post('/fournisseurs', [ControleurFournisseur::class, 'creer']);
        Route::match(['put', 'patch'], '/fournisseurs/{id}', [ControleurFournisseur::class, 'modifier']);
        Route::delete('/fournisseurs/{id}', [ControleurFournisseur::class, 'supprimer']);
    });

    /* Chiffres de l'en-tête d'accueil, agrégés en base (voir ControleurStatistiques).
       HORS du groupe « statistiques » : celui-ci exige perm:rapports, alors que
       ces trois chiffres s'affichent à tout vendeur. Le contrôleur masque de
       lui-même les champs auxquels l'employé n'a pas droit. */
    Route::get('/statistiques/resume-jour', [ControleurStatistiques::class, 'resumeJour'])->middleware('perm:stock|vente');
    // Quantités vendues par produit, pour l'inventaire (écran du droit « stock »).
    Route::get('/ventes/quantites-par-produit', [ControleurVente::class, 'quantitesParProduit'])->middleware('perm:stock|vente');

    Route::prefix('statistiques')->middleware('perm:rapports')->group(function () {
        // Rapports du jour et de la semaine : inclus dans tous les plans.
        Route::get('/ventes-par-jour', [ControleurStatistiques::class, 'ventesParJour']);
        Route::get('/paiements', [ControleurStatistiques::class, 'paiements']);
        Route::get('/stock-faible', [ControleurStatistiques::class, 'stockFaible']);
        // Encaissé, en attente et crédits de l'écran Chiffres.
        Route::get('/indicateurs', [ControleurStatistiques::class, 'indicateurs']);
        // Rapports complets : à partir du plan Essentiel.
        Route::middleware('plan:rapports_complets')->group(function () {
            Route::get('/ventes-par-categorie', [ControleurStatistiques::class, 'ventesParCategorie']);
            Route::get('/meilleurs-produits', [ControleurStatistiques::class, 'meilleursProduits']);
            Route::get('/marge-categorie', [ControleurStatistiques::class, 'margeParCategorie']);
            Route::get('/rotation-stock', [ControleurStatistiques::class, 'rotationStock']);
            Route::get('/meilleurs-clients', [ControleurStatistiques::class, 'meilleursClients']);
            Route::get('/marchandage', [ControleurStatistiques::class, 'marchandage']);
        });
    });
});

// --- Administration (jeton Sanctum + rôle admin) ---
Route::middleware(['auth:sanctum', 'admin'])->prefix('admin')->group(function () {
    Route::get('/tableau-de-bord', [ControleurTableauDeBord::class, 'afficher']);

    // Comptes (création, blocage, relance)
    Route::get('/utilisateurs', [ControleurUtilisateurs::class, 'lister']);
    Route::post('/utilisateurs', [ControleurUtilisateurs::class, 'creer']);
    Route::put('/utilisateurs/{id}/bloquer', [ControleurUtilisateurs::class, 'bloquer']);
    Route::put('/utilisateurs/{id}/activer', [ControleurUtilisateurs::class, 'activer']);
    Route::delete('/utilisateurs/{id}', [ControleurUtilisateurs::class, 'supprimer']);
    Route::post('/utilisateurs/{id}/relancer', [ControleurUtilisateurs::class, 'relancer']);

    // Commerçants : plan qui s'applique, fiche, gestes (jours offerts, plan)
    Route::get('/commercants', [ControleurCommercants::class, 'lister']);
    Route::get('/commercants/{id}', [ControleurCommercants::class, 'afficher']);
    Route::post('/commercants/{id}/offrir', [ControleurCommercants::class, 'offrir']);
    Route::post('/commercants/{id}/plan', [ControleurCommercants::class, 'changerPlan']);

    // Paiements d'abonnement à vérifier (remplacent les « passages Premium »)
    Route::get('/paiements', [ControleurPaiements::class, 'lister']);
    Route::get('/paiements/{id}', [ControleurPaiements::class, 'afficher']);
    Route::post('/paiements/{id}/valider', [ControleurPaiements::class, 'valider']);
    Route::post('/paiements/{id}/refuser', [ControleurPaiements::class, 'refuser']);
    Route::post('/paiements/{id}/annuler', [ControleurPaiements::class, 'annuler']);

    // Catalogue des plans et règles d'abonnement
    Route::get('/plans', [ControleurPlans::class, 'lister']);
    Route::put('/plans/{code}', [ControleurPlans::class, 'modifier']);
    Route::get('/reglages', [ControleurReglages::class, 'afficher']);
    Route::put('/reglages', [ControleurReglages::class, 'modifier']);

    // Finances : soldes par compte, mouvements du mois
    Route::get('/finances', [ControleurFinances::class, 'afficher']);

    // Retraits / transferts / paramètres
    Route::get('/retraits', [ControleurRetraits::class, 'lister']);
    Route::post('/retraits', [ControleurRetraits::class, 'creer']);
    Route::get('/transferts', [ControleurTransferts::class, 'lister']);
    Route::post('/transferts', [ControleurTransferts::class, 'creer']);
    Route::get('/parametres', [ControleurParametres::class, 'afficher']);
    Route::put('/parametres', [ControleurParametres::class, 'modifier']);
});

}; // fin de $enregistrerRoutes

// Racine + espace versionné /v1.
$enregistrerRoutes();
Route::prefix('v1')->group($enregistrerRoutes);
