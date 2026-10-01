<?php

namespace App\Services;

use App\Models\Plan;
use Illuminate\Support\Carbon;

/**
 * Ce qui s'applique à un commerçant un jour donné : quel plan, pourquoi
 * (payé, délai de grâce, essai, gratuit) et jusqu'à quand. Calculé par
 * Abonnements::etat() à partir des paiements VALIDÉS — jamais à partir de ce
 * que le navigateur affirme.
 */
final class EtatAbonnement
{
    public function __construct(
        /** Plan qui s'applique aujourd'hui (limites, fonctionnalités). */
        public readonly Plan $plan,
        /** paye | grace | essai | gratuit | admin */
        public readonly string $source,
        /** Plan payé en cours, ou en délai de grâce. */
        public readonly ?Plan $planPaye = null,
        /** Dernier jour de la période payée (périodes consécutives comprises). */
        public readonly ?Carbon $finLe = null,
        public readonly ?Carbon $graceJusquAu = null,
        public readonly ?Carbon $essaiJusquAu = null,
        public readonly ?Plan $planEssai = null,
        /** Dernier plan payé, une fois expiré (délai de grâce écoulé). */
        public readonly ?Plan $planExpire = null,
        public readonly ?Carbon $expireLe = null,
    ) {}

    public function limite(string $cle): ?int
    {
        return $this->plan->limite($cle);
    }

    public function inclut(string $fonctionnalite): bool
    {
        return $this->plan->inclut($fonctionnalite);
    }

    /** Jours restants avant la fin de ce qui s'applique (essai ou période payée). */
    public function joursRestants(?Carbon $jour = null): ?int
    {
        $fin = match ($this->source) {
            'essai' => $this->essaiJusquAu,
            'paye' => $this->finLe,
            'grace' => $this->graceJusquAu,
            default => null,
        };

        return $fin ? (int) ($jour ?? Carbon::today())->diffInDays($fin, false) : null;
    }
}
