<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Exists;

abstract class Controleur
{
    /**
     * Photo de fiche : data-URL d'image produite par le téléphone (cf.
     * apps/web/src/outils/photo.ts, qui réduit à 256 px et vise ≤ 24 Ko).
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
    public const REGLES_PHOTO = [
        'nullable', 'string', 'max:61440',
        'regex:/^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+\/]+={0,2}$/',
    ];

    /**
     * S4 — Règle « exists » limitée aux données du PROPRIÉTAIRE (colonne
     * utilisateur_id du propriétaire résolu). Empêche un commerçant de désigner
     * la catégorie / le fournisseur / etc. d'un autre commerçant (IDOR / fuite
     * d'identifiant).
     */
    protected function existeChezProprietaire(Request $requete, string $table, string $colonne = 'utilisateur_id'): Exists
    {
        return Rule::exists($table, 'id')->where($colonne, $requete->user()->id);
    }

    /**
     * T13 — Cache des statistiques par propriétaire (5 min). Clé versionnée : à
     * chaque vente/retour on incrémente la version du propriétaire
     * (perimerStatistiques), ce qui périme toutes ses statistiques sans avoir
     * besoin des étiquettes de cache (indisponibles en pilote database/file).
     */
    protected function statistiquesEnCache(Request $requete, string $cle, \Closure $calcul, int $duree = 300)
    {
        // Le cache est DÉSACTIVÉ par défaut en production.
        //
        // Historique : mises en cache (T13), ces 4 statistiques renvoyaient des
        // 500 en production dès que le magasin de cache était en défaut (course
        // du pilote fichier, table absente en base). À l'échelle d'une boutique,
        // les requêtes s'exécutent en quelques millisecondes : le cache apportait
        // un gain négligeable pour un mode de panne bien réel. On calcule donc
        // directement, et le cache ne peut être réactivé qu'explicitement
        // (CACHE_STATISTIQUES=true).
        if (! config('app.cache_statistiques', false)) {
            return $calcul();
        }

        $uid = $requete->user()->id;
        $bid = $requete->user()->boutique_active_id ?? 0;

        // Même activé, le cache reste une optimisation et jamais une dépendance.
        try {
            $version = static::versionStatistiques($uid);

            return Cache::remember("statistiques:{$uid}:{$bid}:{$version}:{$cle}", $duree, $calcul);
        } catch (\Throwable $e) {
            report($e);

            return $calcul();
        }
    }

    protected static function versionStatistiques(int $uid): int
    {
        try {
            $v = Cache::get("version_statistiques:{$uid}");
            if ($v === null) {
                Cache::forever("version_statistiques:{$uid}", 1);

                return 1;
            }

            return (int) $v;
        } catch (\Throwable $e) {
            report($e);

            return 1; // version neutre : on recalcule au lieu d'échouer
        }
    }

    /** Périme le cache des statistiques d'un propriétaire (après l'écriture d'une vente). */
    public static function perimerStatistiques(int $uid): void
    {
        if (! config('app.cache_statistiques', false)) {
            return; // cache désactivé : rien à périmer
        }

        try {
            Cache::forever("version_statistiques:{$uid}", static::versionStatistiques($uid) + 1);
        } catch (\Throwable $e) {
            report($e); // au pire, les statistiques restent en cache jusqu'à expiration
        }
    }
}
