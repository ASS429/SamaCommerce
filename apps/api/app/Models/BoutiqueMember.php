<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BoutiqueMember extends Model
{
    protected $fillable = [
        'owner_id', 'ref_boutique_id', 'member_id', 'email', 'role',
        'status', 'permissions', 'invite_token', 'invite_expires_at', 'accepted_at',
    ];

    protected $casts = [
        'permissions' => 'array',
        'invite_expires_at' => 'datetime',
        'accepted_at' => 'datetime',
    ];

    public const ALL_PERMS = ['vente', 'stock', 'categories', 'rapports', 'caisse', 'credits', 'clients', 'fournisseurs', 'commandes', 'livraisons'];

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    public function member(): BelongsTo
    {
        return $this->belongsTo(User::class, 'member_id');
    }

    public static function defaultPermissions(string $role): array
    {
        $full = $role === 'gerant';

        return collect(self::ALL_PERMS)->mapWithKeys(fn ($p) => [$p => $full || $p === 'vente'])->all();
    }
}
