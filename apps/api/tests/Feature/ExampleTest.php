<?php

namespace Tests\Feature;

use Tests\TestCase;

class ExampleTest extends TestCase
{
    /**
     * L'application est une API : la racine redirige vers le healthcheck
     * (route « cacheable », sans closure — cf. contrainte route:cache).
     */
    public function test_root_redirects_to_health(): void
    {
        $this->get('/')->assertRedirect('/api/health');
    }
}
