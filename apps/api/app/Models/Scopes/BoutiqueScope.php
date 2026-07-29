<?php

namespace App\Models\Scopes;

use App\Models\ActivityLog;
use App\Models\CaisseClosing;
use App\Models\Client;
use App\Models\Fournisseur;
use App\Models\Product;
use App\Models\RestockDelivery;
use App\Models\RestockOrder;
use App\Models\Retour;
use App\Models\Sale;
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
 * le demander explicitement : `Sale::withoutGlobalScope(BoutiqueScope::class)`.
 * L'exception est ainsi visible à la lecture, à l'inverse de l'oubli.
 *
 * NB : l'enregistrement se fait par requête HTTP (middleware ResolveTenant),
 * dans un processus PHP qui meurt avec la réponse. Un serveur applicatif
 * persistant (Octane, Swoole) exigerait de désactiver le scope en fin de
 * requête — ce n'est pas le mode de déploiement ici (Apache/mod_php).
 */
class BoutiqueScope implements Scope
{
    /** Modèles portant une colonne `boutique_id`. */
    public const MODELS = [
        Product::class,
        Sale::class,
        Client::class,
        Fournisseur::class,
        RestockOrder::class,
        RestockDelivery::class,
        Retour::class,
        CaisseClosing::class,
        ActivityLog::class,
    ];

    public function __construct(private int $boutiqueId) {}

    public function apply(Builder $builder, Model $model): void
    {
        // Table qualifiée : plusieurs requêtes joignent `products` ou
        // `fournisseurs`, où une colonne `boutique_id` nue serait ambiguë.
        $builder->where($model->getTable().'.boutique_id', $this->boutiqueId);
    }

    /**
     * Active le cloisonnement pour la requête en cours.
     *
     * Sans boutique active (compte sans boutique principale, administrateur),
     * on n'applique rien : mieux vaut tout montrer que faire disparaître les
     * données d'un commerçant.
     */
    public static function activate(?int $boutiqueId): void
    {
        if (! $boutiqueId) {
            return;
        }

        foreach (self::MODELS as $model) {
            $model::addGlobalScope(new self($boutiqueId));
        }
    }
}
