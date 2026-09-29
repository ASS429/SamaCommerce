<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Produit extends Modele
{
    use SoftDeletes; // T4 — corbeille + restauration

    protected $table = 'produits';

    protected $fillable = [
        'utilisateur_id', 'boutique_id', 'categorie_id', 'nom', 'description', 'code_barres', 'prix_vente', 'prix_achat', 'stock',
        'unite_base', 'prix_min', 'negociable', 'photo',
    ];

    protected $casts = [
        // T1 — montants en entiers (FCFA sans centimes).
        'prix_vente' => 'integer',
        'prix_achat' => 'integer',
        'stock' => 'integer',
        'prix_min' => 'integer',
        'negociable' => 'boolean',
    ];

    /** Unité de base -> [libellé d'affichage du détail, facteur vers l'unité de base]. */
    public const AFFICHAGE = [
        'piece' => ['pièce', 1],
        'g' => ['kg', 1000],
        'ml' => ['L', 1000],
    ];

    public function libelleAffichage(): string
    {
        return (self::AFFICHAGE[$this->unite_base] ?? self::AFFICHAGE['piece'])[0];
    }

    public function facteurAffichage(): int
    {
        return (self::AFFICHAGE[$this->unite_base] ?? self::AFFICHAGE['piece'])[1];
    }

    /** Négociable effectif : valeur du produit, sinon héritée de la catégorie. */
    public function negociableEffectif(): bool
    {
        if ($this->negociable !== null) {
            return (bool) $this->negociable;
        }

        return (bool) optional($this->categorie)->negociable;
    }

    public function utilisateur(): BelongsTo
    {
        return $this->belongsTo(Utilisateur::class);
    }

    public function categorie(): BelongsTo
    {
        return $this->belongsTo(Categorie::class);
    }

    public function conditionnements(): HasMany
    {
        return $this->hasMany(Conditionnement::class);
    }

    public function ventes(): HasMany
    {
        return $this->hasMany(Vente::class);
    }
}
