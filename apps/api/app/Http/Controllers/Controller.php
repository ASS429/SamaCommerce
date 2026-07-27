<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Exists;

abstract class Controller
{
    /**
     * S4 — Règle "exists" limitée aux ressources du TENANT (colonne user_id du
     * propriétaire résolu). Empêche un commerçant de référencer la catégorie /
     * le fournisseur / etc. d'un autre commerçant (IDOR / fuite d'ID).
     */
    protected function tenantExists(Request $request, string $table, string $column = 'user_id'): Exists
    {
        return Rule::exists($table, 'id')->where($column, $request->user()->id);
    }

    /**
     * T13 — Cache des statistiques par tenant (5 min). Clé versionnée : à chaque
     * vente/retour on incrémente la version du tenant (invalidateStats), ce qui
     * périme toutes ses stats sans avoir besoin des tags de cache (indispo en
     * driver database/file).
     */
    protected function tenantCachedStats(Request $request, string $key, \Closure $callback, int $ttl = 300)
    {
        $uid = $request->user()->id;
        $bid = $request->user()->current_boutique_id ?? 0;
        $ver = static::statsVersion($uid);

        return Cache::remember("stats:{$uid}:{$bid}:{$ver}:{$key}", $ttl, $callback);
    }

    protected static function statsVersion(int $uid): int
    {
        $v = Cache::get("stats_ver:{$uid}");
        if ($v === null) {
            Cache::forever("stats_ver:{$uid}", 1);

            return 1;
        }

        return (int) $v;
    }

    /** Périme le cache stats d'un tenant (à appeler après une écriture de vente). */
    public static function invalidateStats(int $uid): void
    {
        Cache::forever("stats_ver:{$uid}", static::statsVersion($uid) + 1);
    }
}
