<?php

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;

class ExempleTest extends TestCase
{
    /**
     * Garde la suite « Unit » non vide : PHPUnit la déclare dans phpunit.xml.
     */
    public function test_vrai_est_vrai(): void
    {
        $this->assertTrue(true);
    }
}
