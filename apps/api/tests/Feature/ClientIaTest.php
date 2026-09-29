<?php

namespace Tests\Feature;

use App\Services\ClientIa;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * Client du micro-service IA.
 *
 * Le repli heuristique masque toute panne de l'IA : une adresse mal formée ne
 * provoquerait donc AUCUNE erreur visible, juste une IA silencieusement
 * désactivée. C'est exactement le genre de défaut qu'on ne découvre jamais —
 * d'où ces tests.
 */
class ClientIaTest extends TestCase
{
    public function test_ajoute_le_schema_absent_de_l_adresse_render(): void
    {
        // Render fournit l'hôte seul quand la variable vient d'un autre service.
        config(['services.ia.url' => 'samacommerce-ia.onrender.com']);
        Http::fake(['https://samacommerce-ia.onrender.com/prevision' => Http::response(['methode' => 'modele'])]);

        $reponse = (new ClientIa)->prevision(['produit_id' => 1]);

        $this->assertSame('modele', $reponse['methode']);
        Http::assertSent(fn ($r) => $r->url() === 'https://samacommerce-ia.onrender.com/prevision');
    }

    public function test_respecte_une_adresse_deja_complete(): void
    {
        config(['services.ia.url' => 'http://localhost:8001/']);
        Http::fake(['http://localhost:8001/score-credit' => Http::response(['score' => 80])]);

        $this->assertSame(80, (new ClientIa)->scoreCredit(['montant' => 1000])['score']);
        Http::assertSent(fn ($r) => $r->url() === 'http://localhost:8001/score-credit');
    }

    public function test_ne_tente_rien_quand_l_ia_n_est_pas_configuree(): void
    {
        config(['services.ia.url' => '']);
        Http::fake();

        $this->assertNull((new ClientIa)->prevision(['produit_id' => 1]));
        Http::assertNothingSent(); // pas d'appel vers une adresse vide
    }

    public function test_renvoie_null_quand_le_service_est_en_panne(): void
    {
        // C'est ce qui déclenche le repli heuristique côté contrôleur.
        config(['services.ia.url' => 'https://ia.test']);
        Http::fake(['https://ia.test/*' => Http::response('', 503)]);

        $this->assertNull((new ClientIa)->prevision(['produit_id' => 1]));
    }

    public function test_complete_un_nom_de_service_render_nu(): void
    {
        // Ce que Render met réellement dans la variable quand on la lie à un
        // autre service : le NOM, pas l'hôte. Sans ce rattrapage, la résolution
        // DNS échoue en 2 ms et l'IA reste éteinte sans erreur visible.
        config(['services.ia.url' => 'samacommerce-ia']);
        Http::fake(['https://samacommerce-ia.onrender.com/prevision' => Http::response(['methode' => 'modele'])]);

        $this->assertSame('modele', (new ClientIa)->prevision(['produit_id' => 1])['methode']);
    }

    public function test_laisse_intacte_une_adresse_de_developpement(): void
    {
        // La règle ne doit pas transformer un service local en adresse Render.
        config(['services.ia.url' => 'http://localhost:8001']);
        Http::fake(['http://localhost:8001/prevision' => Http::response(['methode' => 'modele'])]);

        (new ClientIa)->prevision(['produit_id' => 1]);
        Http::assertSent(fn ($r) => $r->url() === 'http://localhost:8001/prevision');
    }
}
