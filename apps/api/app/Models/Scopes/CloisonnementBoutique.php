<?php

namespace App\Models\Scopes;

use App\Models\Client;
use App\Models\ClotureCaisse;
use App\Models\Commande;
use App\Models\Fournisseur;
use App\Models\JournalActivite;
use App\Models\Livraison;
use App\Models\Produit;
use App\Models\Retour;
use App\Models\Vente;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Scope;

/**
 * Cloisonnement par BOUTIQUE ACTIVE.
 *
 * LE PROBLÈME. Chaque contrôleur devait penser à filtrer sur `boutique_id`.
 * Certains le faisaient (produits, clients, commandes), la plupart non :
 * ventes, caisse, retours, réappro IA et 8 des 9 statistiques renvoyaient les
 * données de TOUTES les boutiques. Changer de boutique ne changeait donc rien
 * à l'accueil, et le chiffre d'affaires affiché pour « Boutique Marché »
 * incluait celui de « Ma Boutique ».
 *
 * LE CHOIX. Un filtre oublié dans un contrôleur est invisible jusqu'à ce qu'un
 * commerçant lise un chiffre faux. On applique donc le cloisonnement UNE fois,
 * au niveau du modèle, pour toute la durée de la requête : tout ce qui interroge
 * ces tables est cloisonné par construction, y compris le code écrit demain.
 *
 * POUR LIRE À TRAVERS LES BOUTIQUES (tableau de bord multi-boutique), il faut
 * le demander explicitement : `Vente::withoutGlobalScope(CloisonnementBoutique::class)`.
 * L'exception est ainsi visible à la lecture, à l'inverse de l'oubli.
 *
 * LA BOUTIQUE ACTIVE VIT DANS LE CONTENEUR DE LA REQUÊTE, pas dans le filtre.
 * Le filtre est enregistré une fois par modèle (état statique d'Eloquent) mais
 * ne retient rien : il lit la boutique à chaque requête SQL. Jusqu'au
 * 02/10/2026, chaque requête enregistrait un filtre portant SA boutique ; sous
 * Apache/mod_php (un processus neuf par requête) c'était sans danger, mais un
 * serveur persistant (Octane, Swoole, FrankenPHP) aurait gardé la boutique du
 * commerçant précédent — et l'administrateur, qui n'activait rien, aurait hérité
 * du filtre du dernier commerçant servi.
 */
class CloisonnementBoutique implements Scope
{
    /** Clé de la boutique active dans le conteneur (null : aucun cloisonnement). */
    public const CLE = 'cloisonnement.boutique';

    /** Modèles portant une colonne `boutique_id`. */
    public const MODELES = [
        Produit::class,
        Vente::class,
        Client::class,
        Fournisseur::class,
        Commande::class,
        Livraison::class,
        Retour::class,
        ClotureCaisse::class,
        JournalActivite::class,
    ];

    public function apply(Builder $constructeur, Model $modele): void
    {
        $boutiqueId = self::boutiqueActive();
        if (! $boutiqueId) {
            return;
        }
        // Table qualifiée : plusieurs requêtes joignent `produits` ou
        // `fournisseurs`, où une colonne `boutique_id` nue serait ambiguë.
        $constructeur->where($modele->getTable().'.boutique_id', $boutiqueId);
    }

    /**
     * Fixe la boutique de la requête en cours. À appeler pour CHAQUE requête
     * authentifiée, y compris avec null : c'est ce qui efface la boutique d'une
     * requête précédente servie par le même processus.
     *
     * Sans boutique active (compte sans boutique principale, administrateur),
     * on n'applique rien : mieux vaut tout montrer que faire disparaître les
     * données d'un commerçant.
     */
    public static function activer(?int $boutiqueId): void
    {
        app()->instance(self::CLE, $boutiqueId ?: null);

        foreach (self::MODELES as $modele) {
            if (! $modele::hasGlobalScope(self::class)) {
                $modele::addGlobalScope(new self);
            }
        }
    }

    public static function boutiqueActive(): ?int
    {
        return app()->bound(self::CLE) ? app(self::CLE) : null;
    }
}
