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
        // Le cache est DÉSACTIVÉ par défaut en production.
        //
        // Historique : mis en cache (T13), ces 4 statistiques renvoyaient des 500
        // en production dès que le store de cache était en défaut (race du driver
        // fichier, table absente en base). À l'échelle d'une boutique, les requêtes
        // s'exécutent en quelques millisecondes : le cache apportait un gain
        // négligeable pour un mode de panne bien réel. On calcule donc directement,
        // et le cache ne peut être réactivé qu'explicitement (STATS_CACHE=true).
        if (! config('app.stats_cache', false)) {
            return $callback();
        }

        $uid = $request->user()->id;
        $bid = $request->user()->current_boutique_id ?? 0;

        // Même activé, le cache reste une optimisation et jamais une dépendance.
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
        if (! config('app.stats_cache', false)) {
            return; // cache désactivé : rien à invalider
        }

        try {
            Cache::forever("stats_ver:{$uid}", static::statsVersion($uid) + 1);
        } catch (\Throwable $e) {
            report($e); // au pire, les stats restent en cache jusqu'au TTL
        }
    }
}
