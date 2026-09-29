<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class Vente extends Modele
{
    use SoftDeletes; // T4 — une vente annulée par erreur est récupérable

    protected $table = 'ventes';

    protected $fillable = [
        'utilisateur_id', 'boutique_id', 'client_id', 'produit_id', 'quantite', 'total', 'moyen_paiement',
        'nom_client', 'telephone_client', 'date_echeance', 'paye', 'moyen_reglement', 'uuid_appareil',
        'quantite_base', 'conditionnement_id', 'libelle_conditionnement', 'prix_reference', 'prix_reel', 'remise',
        'cout_marchandises', 'vendu_par', 'vendu_par_nom', 'reconstituee',
    ];

    protected $casts = [
        'quantite' => 'integer',
        'total' => 'integer', // T1 — montants en entiers (FCFA)
        'date_echeance' => 'date',
        'paye' => 'boolean',
        'reconstituee' => 'boolean',
        'quantite_base' => 'integer',
        'prix_reference' => 'integer',
        'prix_reel' => 'integer',
        'remise' => 'integer',
        'cout_marchandises' => 'integer',
    ];

    public function utilisateur(): BelongsTo
    {
        return $this->belongsTo(Utilisateur::class);
    }

    public function produit(): BelongsTo
    {
        return $this->belongsTo(Produit::class);
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }
}
