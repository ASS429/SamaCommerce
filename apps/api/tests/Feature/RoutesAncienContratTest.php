<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Artisan;
use Tests\TestCase;

/**
 * Les anciennes adresses de l'API existent TOUTES, avec les MÊMES contrôles.
 *
 * Elles sont calquées automatiquement sur les routes françaises
 * (routes/api_ancien_contrat.php). Ce test compare la table obtenue à celle
 * enregistrée avant la francisation (tests/Contrat/routes_avant_francisation.json) :
 * même verbe, même adresse, mêmes intergiciels dans le même ordre. Une
 * permission perdue en route serait une porte ouverte à un employé.
 */
class RoutesAncienContratTest extends TestCase
{
    /** Classes renommées par la francisation : ancien nom => nouveau nom. */
    private const INTERGICIELS = [
        'App\Http\Middleware\EnsurePermission' => 'App\Http\Middleware\VerifierPermission',
        'App\Http\Middleware\ResolveTenant' => 'App\Http\Middleware\ResoudreProprietaire',
        'App\Http\Middleware\EnsureAdmin' => 'App\Http\Middleware\VerifierAdmin',
    ];

    public function test_chaque_ancienne_route_existe_avec_les_memes_controles(): void
    {
        $avant = json_decode(file_get_contents(base_path('tests/Contrat/routes_avant_francisation.json')), true);

        Artisan::call('route:list', ['--json' => true]);
        $maintenant = collect(json_decode(Artisan::output(), true))
            ->keyBy(fn ($r) => $r['method'].' '.$r['uri']);

        $ecarts = [];
        foreach ($avant as $ancienne) {
            $cle = $ancienne['methodes'].' '.$ancienne['uri'];
            if (! $maintenant->has($cle)) {
                $ecarts[] = "absente : {$cle}";

                continue;
            }
            $attendus = array_map(fn ($m) => strtr($m, self::INTERGICIELS), $ancienne['intergiciels']);
            if ($maintenant[$cle]['middleware'] !== $attendus) {
                $ecarts[] = "{$cle} : ".json_encode($maintenant[$cle]['middleware']).' au lieu de '.json_encode($attendus);
            }
        }

        $this->assertSame([], $ecarts);
        $this->assertCount(224, $avant, 'La photographie de la table d\'origine a changé');
    }
}
