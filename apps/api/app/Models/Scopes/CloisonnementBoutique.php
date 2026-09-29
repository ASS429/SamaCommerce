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
 * NB : l'enregistrement se fait par requête HTTP (intergiciel
 * ResoudreProprietaire), dans un processus PHP qui meurt avec la réponse. Un
 * serveur applicatif persistant (Octane, Swoole) exigerait de désactiver le
 * cloisonnement en fin de requête — ce n'est pas le mode de déploiement ici
 * (Apache/mod_php).
 */
class CloisonnementBoutique implements Scope
{
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

    public function __construct(private int $boutiqueId) {}

    public function apply(Builder $constructeur, Model $modele): void
    {
        // Table qualifiée : plusieurs requêtes joignent `produits` ou
        // `fournisseurs`, où une colonne `boutique_id` nue serait ambiguë.
        $constructeur->where($modele->getTable().'.boutique_id', $this->boutiqueId);
    }

    /**
     * Active le cloisonnement pour la requête en cours.
     *
     * Sans boutique active (compte sans boutique principale, administrateur),
     * on n'applique rien : mieux vaut tout montrer que faire disparaître les
     * données d'un commerçant.
     */
    public static function activer(?int $boutiqueId): void
    {
        if (! $boutiqueId) {
            return;
        }

        foreach (self::MODELES as $modele) {
            $modele::addGlobalScope(new self($boutiqueId));
        }
    }
}
