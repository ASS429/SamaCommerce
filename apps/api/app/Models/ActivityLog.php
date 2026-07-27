<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;

class ActivityLog extends Model
{
    protected $fillable = ['owner_id', 'actor_id', 'actor_name', 'boutique_id', 'action', 'detail'];

    /**
     * Enregistre une action dans le journal d'activité.
     * $request->user() = propriétaire (tenant). L'acteur réel (employé) est
     * dans l'attribut "real_user" posé par ResolveTenant ; sinon c'est le patron.
     */
    public static function record(Request $request, string $action, ?string $detail = null): void
    {
        $owner = $request->user();
        if (! $owner) {
            return;
        }
        $actor = $request->attributes->get('real_user') ?? $owner;

        static::create([
            'owner_id' => $owner->id,
            'actor_id' => $actor->id,
            'actor_name' => $actor->username ?? $actor->company_name ?? null,
            'boutique_id' => $owner->current_boutique_id,
            'action' => $action,
            'detail' => $detail,
        ]);
    }
}
