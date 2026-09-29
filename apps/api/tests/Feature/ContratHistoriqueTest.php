<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Outils\RejeuScenario;
use Tests\TestCase;

/**
 * Le contrat d'API tel qu'il était AVANT la francisation.
 *
 * POURQUOI. Pendant la transition, des téléphones continueront d'appeler les
 * anciennes routes avec les anciens noms de champs — dont la file des ventes
 * faites hors ligne. Ce test rejoue un scénario qui touche chaque route et
 * compare chaque réponse, statut compris, aux empreintes enregistrées sur le
 * code d'origine. Un seul écart, et un téléphone resté sur l'ancienne version
 * risquerait de mal afficher ou de perdre une vente.
 *
 * Les empreintes ont été enregistrées sur le code d'origine (tag
 * `avant-francisation`) ; elles ne se réenregistrent plus.
 */
class ContratHistoriqueTest extends TestCase
{
    use RefreshDatabase;
    use RejeuScenario;

    public function test_chaque_ancienne_route_repond_comme_avant_la_francisation(): void
    {
        $this->preparerLeMonde();

        [$traces, $routesJouees] = $this->rejouer();

        // Toute route de l'ANCIEN contrat (ancienne adresse, ou adresse
        // partagée entre les deux langues) doit être jouée.
        $this->verifierCouverture($routesJouees, fn ($r) => in_array($r->getAction('contrat'), ['ancien', 'partage'], true));
        $this->comparerAuxEmpreintes($traces);
    }
}
