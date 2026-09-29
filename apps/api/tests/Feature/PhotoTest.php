<?php

namespace Tests\Feature;

use App\Models\MembreBoutique;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Outils\CreationComptes;
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
    use CreationComptes;
    use RefreshDatabase;

    /** PNG transparent de 1×1 pixel, valide et minuscule. */
    private const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

    public function test_le_produit_accepte_et_renvoie_sa_photo(): void
    {
        [, $jeton] = $this->inscrireCommercant();

        $cree = $this->postJson('/api/produits', [
            'nom' => 'Riz parfumé', 'prix_vente' => 600, 'prix_achat' => 450, 'stock' => 10,
            'photo' => self::PNG,
        ], $this->entetes($jeton))->assertCreated()->json();

        $this->assertSame(self::PNG, $cree['photo']);

        // La photo doit remonter DANS LA LISTE : c'est là que le vendeur
        // reconnaît la marchandise, pas dans un appel séparé par produit.
        $liste = $this->getJson('/api/produits', $this->entetes($jeton))->assertOk()->json();
        $this->assertSame(self::PNG, $liste[0]['photo']);
    }

    public function test_la_photo_est_facultative_et_peut_etre_retiree(): void
    {
        [, $jeton] = $this->inscrireCommercant();

        $cree = $this->postJson('/api/produits', [
            'nom' => 'Sucre', 'prix_vente' => 500, 'prix_achat' => 400, 'stock' => 5,
        ], $this->entetes($jeton))->assertCreated()->json();

        $this->assertNull($cree['photo']);

        // On peut retirer une photo en envoyant null.
        $this->patchJson("/api/produits/{$cree['id']}", ['photo' => self::PNG], $this->entetes($jeton))->assertOk();
        $videe = $this->patchJson("/api/produits/{$cree['id']}", ['photo' => null], $this->entetes($jeton))->assertOk()->json();
        $this->assertNull($videe['photo']);
    }

    public function test_une_charge_qui_n_est_pas_une_image_est_refusee(): void
    {
        [, $jeton] = $this->inscrireCommercant();

        foreach ([
            'texte arbitraire',
            'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==', // HTML déguisé
            'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',                  // SVG = script exécutable
            'javascript:alert(1)',
            'https://exemple.sn/photo.png',                                // adresse distante non gérée
        ] as $charge) {
            $this->postJson('/api/produits', [
                'nom' => 'Test '.substr(md5($charge), 0, 6), 'prix_vente' => 100, 'prix_achat' => 50, 'stock' => 1,
                'photo' => $charge,
            ], $this->entetes($jeton))->assertStatus(422);
        }
    }

    public function test_une_photo_trop_lourde_est_refusee(): void
    {
        [, $jeton] = $this->inscrireCommercant();

        // 60 Ko est le plafond (≈ 2,5× le budget appliqué côté téléphone).
        $tropLourde = 'data:image/png;base64,'.str_repeat('A', 62 * 1024);

        $this->postJson('/api/produits', [
            'nom' => 'Photo géante', 'prix_vente' => 100, 'prix_achat' => 50, 'stock' => 1,
            'photo' => $tropLourde,
        ], $this->entetes($jeton))->assertStatus(422);
    }

    public function test_client_fournisseur_et_boutique_acceptent_une_photo(): void
    {
        [, $jeton] = $this->inscrireCommercant();

        $client = $this->postJson('/api/clients', ['nom' => 'Awa Ndiaye', 'photo' => self::PNG], $this->entetes($jeton))->assertCreated()->json();
        $this->assertSame(self::PNG, $client['photo']);

        $fournisseur = $this->postJson('/api/fournisseurs', ['nom' => 'Grossiste Sandaga', 'photo' => self::PNG], $this->entetes($jeton))->assertCreated()->json();
        $this->assertSame(self::PNG, $fournisseur['photo']);

        // Le plan Gratuit plafonne à 1 boutique : on modifie donc la principale.
        $principale = $this->getJson('/api/boutiques', $this->entetes($jeton))->assertOk()->json()[0];
        $boutique = $this->patchJson("/api/boutiques/{$principale['id']}", ['photo' => self::PNG], $this->entetes($jeton))->assertOk()->json();
        $this->assertSame(self::PNG, $boutique['photo']);

        // Et le format reste contrôlé sur chacune de ces fiches.
        $this->postJson('/api/clients', ['nom' => 'X', 'photo' => 'non'], $this->entetes($jeton))->assertStatus(422);
        $this->postJson('/api/fournisseurs', ['nom' => 'Y', 'photo' => 'non'], $this->entetes($jeton))->assertStatus(422);
        $this->postJson('/api/boutiques', ['nom' => 'Z', 'photo' => 'non'], $this->entetes($jeton))->assertStatus(422);
    }

    public function test_la_fiche_employe_porte_nom_telephone_et_photo(): void
    {
        [$proprietaire, $jeton] = $this->inscrireCommercant();

        $invitation = $this->postJson('/api/membres/inviter', [
            'email' => 'awa@boutique.sn', 'role' => 'employe',
            'nom' => 'Awa Ndiaye', 'telephone' => '77 123 45 67', 'photo' => self::PNG,
        ], $this->entetes($jeton))->assertCreated()->json();

        $this->assertSame('Awa Ndiaye', $invitation['membre']['nom']);
        $this->assertSame('77 123 45 67', $invitation['membre']['telephone']);
        $this->assertSame(self::PNG, $invitation['membre']['photo']);

        // La liste expose la fiche du membre, sans que la jointure sur
        // `utilisateurs` n'écrase son nom ni son téléphone.
        $liste = $this->getJson('/api/membres', $this->entetes($jeton))->assertOk()->json();
        $this->assertSame('Awa Ndiaye', $liste[0]['nom']);
        $this->assertSame('77 123 45 67', $liste[0]['telephone']);
        $this->assertArrayHasKey('nom_commerce_utilisateur', $liste[0]);

        // Mise à jour de la fiche
        $membreId = MembreBoutique::where('proprietaire_id', $proprietaire->id)->firstOrFail()->id;
        $modifie = $this->patchJson("/api/membres/{$membreId}", ['nom' => 'Awa N.', 'telephone' => '78 000 00 00'], $this->entetes($jeton))->assertOk()->json();
        $this->assertSame('Awa N.', $modifie['nom']);

        $this->patchJson("/api/membres/{$membreId}", ['photo' => 'pas-une-image'], $this->entetes($jeton))->assertStatus(422);
    }

    public function test_le_message_de_reappro_est_pret_pour_whatsapp(): void
    {
        [, $jeton] = $this->inscrireCommercant();

        $this->postJson('/api/produits', ['nom' => 'Riz', 'prix_vente' => 600, 'prix_achat' => 450, 'stock' => 2], $this->entetes($jeton))->assertCreated();
        $f = $this->postJson('/api/fournisseurs', ['nom' => 'Grossiste', 'telephone' => '77 123 45 67'], $this->entetes($jeton))->assertCreated()->json();

        $reponse = $this->getJson("/api/fournisseurs/{$f['id']}/message-reappro", $this->entetes($jeton))->assertOk()->json();

        $this->assertStringContainsString('RÉAPPROVISIONNEMENT', $reponse['message']);
        $this->assertStringContainsString('Riz', $reponse['message']);
        $this->assertStringContainsString('Boutique Test', $reponse['message']); // signature de la boutique
        // Numéro normalisé au format international attendu par wa.me.
        $this->assertStringStartsWith('https://wa.me/221771234567?text=', $reponse['url_whatsapp']);
    }
}
