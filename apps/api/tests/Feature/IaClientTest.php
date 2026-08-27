<?php

namespace Tests\Feature;

use App\Services\IaClient;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * Client du micro-service IA.
 *
 * Le repli heuristique masque toute panne de l'IA : une URL mal formee ne
 * provoquerait donc AUCUNE erreur visible, juste une IA silencieusement
 * desactivee. C'est exactement le genre de defaut qu'on ne decouvre jamais —
 * d'ou ces tests.
 */
class IaClientTest extends TestCase
{
    public function test_ajoute_le_schema_absent_de_l_adresse_render(): void
    {
        // Render fournit l'hote seul quand la variable vient d'un autre service.
        config(['services.ia.url' => 'samacommerce-ia.onrender.com']);
        Http::fake(['https://samacommerce-ia.onrender.com/forecast' => Http::response(['method' => 'model'])]);

        $res = (new IaClient)->forecast(['product_id' => 1]);

        $this->assertSame('model', $res['method']);
        Http::assertSent(fn ($r) => $r->url() === 'https://samacommerce-ia.onrender.com/forecast');
    }

    public function test_respecte_une_adresse_deja_complete(): void
    {
        config(['services.ia.url' => 'http://localhost:8001/']);
        Http::fake(['http://localhost:8001/credit-score' => Http::response(['score' => 80])]);

        $this->assertSame(80, (new IaClient)->creditScore(['amount' => 1000])['score']);
        Http::assertSent(fn ($r) => $r->url() === 'http://localhost:8001/credit-score');
    }

    public function test_ne_tente_rien_quand_l_ia_n_est_pas_configuree(): void
    {
        config(['services.ia.url' => '']);
        Http::fake();

        $this->assertNull((new IaClient)->forecast(['product_id' => 1]));
        Http::assertNothingSent(); // pas d'appel vers une URL vide
    }

    public function test_renvoie_null_quand_le_service_est_en_panne(): void
    {
        // C'est ce qui declenche le repli heuristique cote controleur.
        config(['services.ia.url' => 'https://ia.test']);
        Http::fake(['https://ia.test/*' => Http::response('', 503)]);

        $this->assertNull((new IaClient)->forecast(['product_id' => 1]));
    }
}
