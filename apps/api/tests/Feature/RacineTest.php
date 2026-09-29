<?php

namespace Tests\Feature;

use Tests\TestCase;

class RacineTest extends TestCase
{
    /**
     * L'application est une API : la racine renvoie vers l'état de santé
     * (route « cachable », sans fonction anonyme — cf. contrainte route:cache).
     */
    public function test_la_racine_renvoie_vers_l_etat_de_sante(): void
    {
        $this->get('/')->assertRedirect('/api/sante');
    }
}
