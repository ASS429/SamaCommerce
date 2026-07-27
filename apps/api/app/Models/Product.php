<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Product extends Model
{
    use SoftDeletes; // T4 — corbeille + restauration

    protected $fillable = [
        'user_id', 'boutique_id', 'category_id', 'name', 'scent', 'barcode', 'price', 'price_achat', 'stock',
        'unite_base', 'prix_min', 'negociable',
    ];

    protected $casts = [
        // T1 — montants en entiers (FCFA sans centimes).
        'price' => 'integer',
        'price_achat' => 'integer',
        'stock' => 'integer',
        'prix_min' => 'integer',
        'negociable' => 'boolean',
    ];

    /** Mapping unité de base -> [libellé d'affichage du détail, facteur vers l'unité de base]. */
    public const DISPLAY = [
        'piece' => ['pièce', 1],
        'g' => ['kg', 1000],
        'ml' => ['L', 1000],
    ];

    public function displayLabel(): string
    {
        return (self::DISPLAY[$this->unite_base] ?? self::DISPLAY['piece'])[0];
    }

    public function displayFactor(): int
    {
        return (self::DISPLAY[$this->unite_base] ?? self::DISPLAY['piece'])[1];
    }

    /** Négociable effectif : valeur du produit, sinon héritée de la catégorie. */
    public function negociableEffectif(): bool
    {
        if ($this->negociable !== null) {
            return (bool) $this->negociable;
        }

        return (bool) optional($this->category)->negociable;
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function units(): HasMany
    {
        return $this->hasMany(ProductUnit::class);
    }

    public function sales(): HasMany
    {
        return $this->hasMany(Sale::class);
    }
}
