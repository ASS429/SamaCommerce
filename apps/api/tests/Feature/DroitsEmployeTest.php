<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Outils\CreationComptes;
use Tests\TestCase;

class DroitsEmployeTest extends TestCase
{
    use CreationComptes;
    use RefreshDatabase;

    /** S9 — un employé « vente uniquement » vend (et LIT le catalogue pour
     *  vendre) mais ne peut ni modifier le stock ni gérer les catégories. */
    public function test_les_permissions_de_l_employe_sont_appliquees(): void
    {
        [$patron] = $this->inscrireCommercant('patron@test.sn');
        [, $jetonEmploye] = $this->creerEmploye($patron, ['vente' => true]);

        // Autorisé : ventes + LECTURE produits/catégories (nécessaire à la vente).
        $this->getJson('/api/ventes', $this->entetes($jetonEmploye))->assertOk();
        $this->getJson('/api/produits', $this->entetes($jetonEmploye))->assertOk();
        $this->getJson('/api/categories', $this->entetes($jetonEmploye))->assertOk();
        // Refusé : ÉCRITURE stock/catégories et corbeille (gestion du stock).
        $this->postJson('/api/produits', ['nom' => 'X'], $this->entetes($jetonEmploye))->assertStatus(403);
        $this->getJson('/api/produits/corbeille', $this->entetes($jetonEmploye))->assertStatus(403);
        $this->postJson('/api/categories', ['nom' => 'X'], $this->entetes($jetonEmploye))->assertStatus(403);
        // Refusé : sections sans permission (fournisseurs).
        $this->getJson('/api/fournisseurs', $this->entetes($jetonEmploye))->assertStatus(403);
    }

    /** La connexion renvoie est_employe + permissions (filtrage immédiat de l'interface). */
    public function test_la_connexion_renvoie_les_permissions_de_l_employe(): void
    {
        [$patron] = $this->inscrireCommercant('patron@test.sn');
        $this->creerEmploye($patron, ['vente' => true, 'caisse' => true]);

        $reponse = $this->postJson('/api/auth/connexion', ['identifiant' => 'employe@test.sn', 'mot_de_passe' => 'Password123'])
            ->assertOk()->json();

        $this->assertTrue($reponse['utilisateur']['est_employe']);
        $this->assertTrue($reponse['utilisateur']['permissions']['vente']);
        $this->assertArrayNotHasKey('stock', array_filter($reponse['utilisateur']['permissions'] ?? []));

        // Un propriétaire, lui, n'est pas employé.
        $reponse2 = $this->postJson('/api/auth/connexion', ['identifiant' => 'patron@test.sn', 'mot_de_passe' => 'Password123'])
            ->assertOk()->json();
        $this->assertFalse($reponse2['utilisateur']['est_employe']);
    }

    /** L'employé travaille sur les données du PROPRIÉTAIRE. */
    public function test_l_employe_voit_les_donnees_du_patron(): void
    {
        [$patron, $jetonPatron] = $this->inscrireCommercant('patron@test.sn');
        $this->postJson('/api/produits', ['nom' => 'Riz patron'], $this->entetes($jetonPatron))->assertCreated();

        [, $jetonEmploye] = $this->creerEmploye($patron, ['vente' => true, 'stock' => true]);
        $liste = $this->getJson('/api/produits', $this->entetes($jetonEmploye))->assertOk()->json();

        $this->assertCount(1, $liste);
        $this->assertSame('Riz patron', $liste[0]['nom']);
    }
}
