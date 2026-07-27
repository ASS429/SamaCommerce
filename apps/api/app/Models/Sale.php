<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class Sale extends Model
{
    use SoftDeletes; // T4 — une vente annulée par erreur est récupérable

    protected $fillable = [
        'user_id', 'boutique_id', 'client_id', 'product_id', 'quantity', 'total', 'payment_method',
        'client_name', 'client_phone', 'due_date', 'paid', 'repayment_method', 'client_uuid',
        'quantite_base', 'unit_id', 'unit_libelle', 'prix_reference', 'prix_reel', 'remise', 'cogs', 'vendu_par', 'vendu_par_nom', 'backfilled',
    ];

    protected $casts = [
        'quantity' => 'integer',
        'total' => 'integer', // T1 — montants en entiers (FCFA)
        'due_date' => 'date',
        'paid' => 'boolean',
        'backfilled' => 'boolean',
        'quantite_base' => 'integer',
        'prix_reference' => 'integer',
        'prix_reel' => 'integer',
        'remise' => 'integer',
        'cogs' => 'integer',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }
}
