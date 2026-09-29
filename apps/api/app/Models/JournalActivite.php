<?php

namespace App\Models;

use Illuminate\Http\Request;

class JournalActivite extends Modele
{
    protected $table = 'journal_activite';

    protected $fillable = ['proprietaire_id', 'acteur_id', 'nom_acteur', 'boutique_id', 'action', 'detail'];

    /**
     * Inscrit une action dans le journal d'activité.
     * $requete->user() = propriétaire des données. L'acteur réel (employé) est
     * dans l'attribut « utilisateur_reel » posé par ResoudreProprietaire ;
     * sinon c'est le patron.
     */
    public static function consigner(Request $requete, string $action, ?string $detail = null): void
    {
        $proprietaire = $requete->user();
        if (! $proprietaire) {
            return;
        }
        $acteur = $requete->attributes->get('utilisateur_reel') ?? $proprietaire;

        static::create([
            'proprietaire_id' => $proprietaire->id,
            'acteur_id' => $acteur->id,
            'nom_acteur' => $acteur->identifiant ?? $acteur->nom_commerce ?? null,
            'boutique_id' => $proprietaire->boutique_active_id,
            'action' => $action,
            'detail' => $detail,
        ]);
    }
}
