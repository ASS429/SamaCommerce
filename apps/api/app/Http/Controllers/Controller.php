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

        // TOLÉRANCE AUX PANNES : le cache est une optimisation, jamais une
        // dépendance. Sous requêtes concurrentes, un store peut échouer
        // (collision d'écriture fichier/DB) — on renvoie alors la valeur
        // calculée directement plutôt que de casser la page de statistiques.
        try {
            $ver = static::statsVersion($uid);

            return Cache::remember("stats:{$uid}:{$bid}:{$ver}:{$key}", $ttl, $callback);
        } catch (\Throwable $e) {
            report($e);

            return $callback();
        }
    }

    protected static function statsVersion(int $uid): int
    {
        try {
            $v = Cache::get("stats_ver:{$uid}");
            if ($v === null) {
                Cache::forever("stats_ver:{$uid}", 1);

                return 1;
            }

            return (int) $v;
        } catch (\Throwable $e) {
            report($e);

            return 1; // version neutre : on recalcule au lieu d'échouer
        }
    }

    /** Périme le cache stats d'un tenant (à appeler après une écriture de vente). */
    public static function invalidateStats(int $uid): void
    {
        try {
            Cache::forever("stats_ver:{$uid}", static::statsVersion($uid) + 1);
        } catch (\Throwable $e) {
            report($e); // au pire, les stats restent en cache jusqu'au TTL
        }
    }
}
