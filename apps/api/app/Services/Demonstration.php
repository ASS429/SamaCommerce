<?php

namespace App\Services;

use App\Models\Scopes\CloisonnementBoutique;
use App\Models\Utilisateur;
use Database\Seeders\AmorceurDemo;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Remise à zéro quotidienne du compte de démonstration.
 *
 * Ce compte est public (« Essayer sans compte ») : chaque visiteur y ajoute,
 * modifie ou supprime des produits et des ventes, et tous voient ce qu'ont fait
 * les autres. Chaque matin, ses données repartent de l'état d'origine, et les
 * sessions ouvertes sont fermées (elles s'accumulaient : 40 le 02/10/2026).
 *
 * Seul ce compte est touché : chaque suppression est filtrée sur son identifiant,
 * le tout dans une transaction (une remise à zéro ratée ne laisse rien à moitié
 * vidé), et l'administrateur n'est jamais rejoué.
 */
class Demonstration
{
    /** Tables des données d'un commerçant (colonne `utilisateur_id`), enfants avant parents. */
    private const TABLES = [
        'retours', 'livraisons', 'commandes', 'ventes', 'clotures_caisse', 'alertes',
        'produits', 'categories', 'clients', 'fournisseurs',
        'paiements_abonnement', 'consommations_ia', 'rappels_abonnement', 'codes_double_facteur',
    ];

    /** Remet le compte de démonstration à neuf ; faux s'il n'existe pas. */
    public static function reinitialiser(): bool
    {
        $commercant = Utilisateur::where('identifiant', config('app.compte_demo'))->where('role', 'commercant')->first();
        if (! $commercant) {
            return false;
        }

        // Aucune boutique héritée d'une requête précédente : on travaille sans filtre.
        CloisonnementBoutique::activer(null);

        DB::transaction(function () use ($commercant) {
            $id = $commercant->id;
            foreach (self::TABLES as $table) {
                if (Schema::hasColumn($table, 'utilisateur_id')) {
                    DB::table($table)->where('utilisateur_id', $id)->delete();
                }
            }
            DB::table('journal_activite')->where('proprietaire_id', $id)->delete();
            DB::table('membres_boutique')->where('proprietaire_id', $id)->delete();

            $boutiques = DB::table('boutiques')->where('proprietaire_id', $id)->pluck('id');
            DB::table('utilisateurs')->whereIn('boutique_active_id', $boutiques)->update(['boutique_active_id' => null]);
            DB::table('boutiques')->whereIn('id', $boutiques)->delete();

            $employe = Utilisateur::where('identifiant', 'employe@samacommerce.sn')->value('id');
            DB::table('personal_access_tokens')->where('tokenable_type', Utilisateur::class)
                ->whereIn('tokenable_id', array_filter([$id, $employe]))->delete();

            $amorceur = new AmorceurDemo;
            $amorceur->remplir($amorceur->commercant());
        });

        return true;
    }
}
