<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

/**
 * Le catalogue des plans, les réglages d'abonnement et la boutique active
 * vivent dans le conteneur de l'application : chaque test, qui reçoit une
 * application neuve, repart donc à vide sans rien avoir à oublier.
 */
abstract class TestCase extends BaseTestCase
{
    //
}
