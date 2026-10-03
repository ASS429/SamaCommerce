<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * L'assistant vocal devient une fonctionnalité des plans PAYANTS (choix de
 * l'utilisateur, 02/10/2026 : « réserver le bouton à ceux qui ont un
 * abonnement »). Cochée ici pour Essentiel, Pro et Entreprise ; l'écran
 * Plans de l'administration permet ensuite de l'ôter d'un plan ou de l'ajouter.
 */
return new class extends Migration
{
    private const FONCTIONNALITE = 'assistant_vocal';

    public function up(): void
    {
        foreach (DB::table('plans')->where('code', '!=', 'gratuit')->get(['id', 'fonctionnalites']) as $plan) {
            $fonctionnalites = json_decode((string) $plan->fonctionnalites, true) ?: [];
            if (! in_array(self::FONCTIONNALITE, $fonctionnalites, true)) {
                $fonctionnalites[] = self::FONCTIONNALITE;
                $this->enregistrer($plan->id, $fonctionnalites);
            }
        }
    }

    public function down(): void
    {
        foreach (DB::table('plans')->get(['id', 'fonctionnalites']) as $plan) {
            $fonctionnalites = json_decode((string) $plan->fonctionnalites, true) ?: [];
            if (in_array(self::FONCTIONNALITE, $fonctionnalites, true)) {
                $this->enregistrer($plan->id, array_values(array_diff($fonctionnalites, [self::FONCTIONNALITE])));
            }
        }
    }

    private function enregistrer(int $id, array $fonctionnalites): void
    {
        DB::table('plans')->where('id', $id)->update([
            'fonctionnalites' => json_encode($fonctionnalites),
            'modifie_le' => Carbon::now(),
        ]);
    }
};
