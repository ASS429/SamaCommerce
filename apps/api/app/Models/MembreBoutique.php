<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MembreBoutique extends Modele
{
    protected $table = 'membres_boutique';

    protected $fillable = [
        'proprietaire_id', 'boutique_rattachement_id', 'membre_id', 'email', 'role',
        'statut', 'permissions', 'jeton_invitation', 'invitation_expire_le', 'acceptee_le',
        'nom', 'telephone', 'photo',
    ];

    protected $casts = [
        'permissions' => 'array',
        'invitation_expire_le' => 'datetime',
        'acceptee_le' => 'datetime',
    ];

    public const TOUTES_PERMISSIONS = ['vente', 'stock', 'categories', 'rapports', 'caisse', 'credits', 'clients', 'fournisseurs', 'commandes', 'livraisons'];

    public function proprietaire(): BelongsTo
    {
        return $this->belongsTo(Utilisateur::class, 'proprietaire_id');
    }

    public function membre(): BelongsTo
    {
        return $this->belongsTo(Utilisateur::class, 'membre_id');
    }

    public static function permissionsParDefaut(string $role): array
    {
        $toutes = $role === 'gerant';

        return collect(self::TOUTES_PERMISSIONS)->mapWithKeys(fn ($p) => [$p => $toutes || $p === 'vente'])->all();
    }
}
