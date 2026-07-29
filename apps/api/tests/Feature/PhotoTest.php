<?php

namespace Tests\Feature;

use App\Models\BoutiqueMember;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\CreatesTenants;
use Tests\TestCase;

/**
 * Photos des fiches (produit, client, fournisseur, boutique, employé).
 *
 * La colonne est un TEXT libre : sans validation stricte, elle deviendrait un
 * champ de stockage de texte arbitraire — donc un vecteur d'injection le jour
 * où on l'affiche ailleurs que dans un `src`, et une base qui gonfle sans
 * qu'on comprenne pourquoi. Ces tests verrouillent les trois garde-fous :
 * format data-URL d'image, taille plafonnée, et champ facultatif.
 */
class PhotoTest extends TestCase
{
    use CreatesTenants;
    use RefreshDatabase;

    /** 1×1 px PNG transparent, valide et minuscule. */
    private const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

    public function test_product_accepts_and_returns_photo(): void
    {
        [, $token] = $this->registerOwner();

        $created = $this->postJson('/api/products', [
            'name' => 'Riz parfumé', 'price' => 600, 'price_achat' => 450, 'stock' => 10,
            'photo' => self::PNG,
        ], $this->auth($token))->assertCreated()->json();

        $this->assertSame(self::PNG, $created['photo']);

        // La photo doit remonter DANS LA LISTE : c'est là que le vendeur
        // reconnaît la marchandise, pas dans un appel séparé par produit.
        $list = $this->getJson('/api/products', $this->auth($token))->assertOk()->json();
        $this->assertSame(self::PNG, $list[0]['photo']);
    }

    public function test_photo_is_optional_and_nullable(): void
    {
        [, $token] = $this->registerOwner();

        $created = $this->postJson('/api/products', [
            'name' => 'Sucre', 'price' => 500, 'price_achat' => 400, 'stock' => 5,
        ], $this->auth($token))->assertCreated()->json();

        $this->assertNull($created['photo']);

        // On peut retirer une photo en envoyant null.
        $this->patchJson("/api/products/{$created['id']}", ['photo' => self::PNG], $this->auth($token))->assertOk();
        $cleared = $this->patchJson("/api/products/{$created['id']}", ['photo' => null], $this->auth($token))->assertOk()->json();
        $this->assertNull($cleared['photo']);
    }

    public function test_photo_rejects_non_image_payloads(): void
    {
        [, $token] = $this->registerOwner();

        foreach ([
            'texte arbitraire',
            'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==', // HTML déguisé
            'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',                  // SVG = script exécutable
            'javascript:alert(1)',
            'https://exemple.sn/photo.png',                                // URL distante non gérée
        ] as $payload) {
            $this->postJson('/api/products', [
                'name' => 'Test '.substr(md5($payload), 0, 6), 'price' => 100, 'price_achat' => 50, 'stock' => 1,
                'photo' => $payload,
            ], $this->auth($token))->assertStatus(422);
        }
    }

    public function test_photo_rejects_oversized_payload(): void
    {
        [, $token] = $this->registerOwner();

        // 60 Ko est le plafond (≈ 2,5× le budget appliqué côté téléphone).
        $trop = 'data:image/png;base64,'.str_repeat('A', 62 * 1024);

        $this->postJson('/api/products', [
            'name' => 'Photo géante', 'price' => 100, 'price_achat' => 50, 'stock' => 1,
            'photo' => $trop,
        ], $this->auth($token))->assertStatus(422);
    }

    public function test_client_fournisseur_and_boutique_accept_photo(): void
    {
        [, $token] = $this->registerOwner();

        $client = $this->postJson('/api/clients', ['name' => 'Awa Ndiaye', 'photo' => self::PNG], $this->auth($token))->assertCreated()->json();
        $this->assertSame(self::PNG, $client['photo']);

        $fournisseur = $this->postJson('/api/fournisseurs', ['name' => 'Grossiste Sandaga', 'photo' => self::PNG], $this->auth($token))->assertCreated()->json();
        $this->assertSame(self::PNG, $fournisseur['photo']);

        // Le plan Free plafonne à 1 boutique : on modifie donc la principale.
        $principale = $this->getJson('/api/boutiques', $this->auth($token))->assertOk()->json()[0];
        $boutique = $this->patchJson("/api/boutiques/{$principale['id']}", ['photo' => self::PNG], $this->auth($token))->assertOk()->json();
        $this->assertSame(self::PNG, $boutique['photo']);

        // Et le format reste contrôlé sur chacune de ces ressources.
        $this->postJson('/api/clients', ['name' => 'X', 'photo' => 'nope'], $this->auth($token))->assertStatus(422);
        $this->postJson('/api/fournisseurs', ['name' => 'Y', 'photo' => 'nope'], $this->auth($token))->assertStatus(422);
        $this->postJson('/api/boutiques', ['name' => 'Z', 'photo' => 'nope'], $this->auth($token))->assertStatus(422);
    }

    public function test_member_fiche_carries_name_phone_and_photo(): void
    {
        [$owner, $token] = $this->registerOwner();

        $invite = $this->postJson('/api/members/invite', [
            'email' => 'awa@boutique.sn', 'role' => 'employe',
            'name' => 'Awa Ndiaye', 'phone' => '77 123 45 67', 'photo' => self::PNG,
        ], $this->auth($token))->assertCreated()->json();

        $this->assertSame('Awa Ndiaye', $invite['member']['name']);
        $this->assertSame('77 123 45 67', $invite['member']['phone']);
        $this->assertSame(self::PNG, $invite['member']['photo']);

        // La liste expose la fiche du membre, sans que la jointure sur `users`
        // n'écrase son nom ni son téléphone.
        $list = $this->getJson('/api/members', $this->auth($token))->assertOk()->json();
        $this->assertSame('Awa Ndiaye', $list[0]['name']);
        $this->assertSame('77 123 45 67', $list[0]['phone']);
        $this->assertArrayHasKey('user_company_name', $list[0]);

        // Mise à jour de la fiche
        $memberId = BoutiqueMember::where('owner_id', $owner->id)->firstOrFail()->id;
        $updated = $this->patchJson("/api/members/{$memberId}", ['name' => 'Awa N.', 'phone' => '78 000 00 00'], $this->auth($token))->assertOk()->json();
        $this->assertSame('Awa N.', $updated['name']);

        $this->patchJson("/api/members/{$memberId}", ['photo' => 'pas-une-image'], $this->auth($token))->assertStatus(422);
    }

    public function test_reappro_message_is_whatsapp_ready(): void
    {
        [, $token] = $this->registerOwner();

        $this->postJson('/api/products', ['name' => 'Riz', 'price' => 600, 'price_achat' => 450, 'stock' => 2], $this->auth($token))->assertCreated();
        $f = $this->postJson('/api/fournisseurs', ['name' => 'Grossiste', 'phone' => '77 123 45 67'], $this->auth($token))->assertCreated()->json();

        $res = $this->getJson("/api/fournisseurs/{$f['id']}/reappro-message", $this->auth($token))->assertOk()->json();

        $this->assertStringContainsString('RÉAPPROVISIONNEMENT', $res['message']);
        $this->assertStringContainsString('Riz', $res['message']);
        $this->assertStringContainsString('Boutique Test', $res['message']); // signature de la boutique
        // Numéro normalisé au format international attendu par wa.me.
        $this->assertStringStartsWith('https://wa.me/221771234567?text=', $res['whatsapp_url']);
    }
}
