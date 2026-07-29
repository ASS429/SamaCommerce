<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Exists;

abstract class Controller
{
    /**
     * Photo de fiche : data-URL d'image produite par le téléphone (cf.
     * apps/web/src/lib/photo.ts, qui réduit à 256 px et vise ≤ 24 Ko).
     *
     * Trois garde-fous, car ce champ finit dans une colonne texte de la base :
     *  - `regex`  : SEULES des images en base64 passent. Sans ça, le champ
     *               deviendrait un stockage de texte arbitraire (et un vecteur
     *               XSS le jour où on l'injecterait ailleurs qu'en `src`).
     *  - `max`    : 60 Ko, soit ~2,5× le budget client. Une photo non compressée
     *               par un client bricolé est refusée, pas stockée.
     *  - `string` : jamais de tableau/objet.
     *
     * Les règles sont volontairement passées EN TABLEAU : la regex contient un
     * « | » que Laravel découperait dans une chaîne de règles.
     */
    public const PHOTO_RULES = [
        'nullable', 'string', 'max:61440',
        'regex:/^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+\/]+={0,2}$/',
    ];

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
