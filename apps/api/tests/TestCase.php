<?php

namespace Tests;

use App\Models\Plan;
use App\Models\ReglagesAbonnement;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    /**
     * Le catalogue des plans et les réglages d'abonnement sont lus une fois par
     * requête (mémoire statique). En production chaque requête est un processus
     * neuf ; en test, tout tourne dans le même processus : on repart à vide.
     */
    protected function setUp(): void
    {
        parent::setUp();
        Plan::oublierCatalogue();
        ReglagesAbonnement::oublier();
    }
}
