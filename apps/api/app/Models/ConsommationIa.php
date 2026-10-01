<?php

namespace App\Models;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/** Conseils IA consommés par un commerçant, mois par mois (quota du plan). */
class ConsommationIa extends Modele
{
    protected $table = 'consommations_ia';

    protected $fillable = ['utilisateur_id', 'mois', 'nombre'];

    protected $casts = ['nombre' => 'integer'];

    public static function duMois(int $utilisateurId, ?Carbon $jour = null): int
    {
        return (int) static::query()
            ->where('utilisateur_id', $utilisateurId)
            ->where('mois', ($jour ?? Carbon::now())->format('Y-m'))
            ->value('nombre');
    }

    /** +1, sans course entre deux requêtes simultanées (incrément en base). */
    public static function compter(int $utilisateurId): void
    {
        $mois = Carbon::now()->format('Y-m');
        $ligne = static::query()->firstOrCreate(['utilisateur_id' => $utilisateurId, 'mois' => $mois], ['nombre' => 0]);
        static::query()->whereKey($ligne->id)->update(['nombre' => DB::raw('nombre + 1')]);
    }
}
