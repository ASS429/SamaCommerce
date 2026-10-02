<?php

namespace Tests\Feature;

use App\Mail\RappelAbonnement;
use App\Models\PaiementAbonnement;
use App\Models\ReglagesAbonnement;
use App\Models\Retrait;
use App\Models\TransfertAdmin;
use App\Models\Utilisateur;
use App\Services\RappelsAbonnement;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Mail;
use Tests\Feature\Outils\CreationComptes;
use Tests\TestCase;

/**
 * Abonnement vu de l'administrateur : file de vérification, périodes sans
 * jour perdu, reçus numérotés, refus motivé, annulation, gestes (jours
 * offerts, espèces), catalogue, réglages, finances, rappels.
 */
class AbonnementAdminTest extends TestCase
{
    use CreationComptes;
    use RefreshDatabase;

    private string $jetonAdmin;

    private int $idAdmin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo(Carbon::parse('2026-10-20 10:00:00'));
        ReglagesAbonnement::courants()->update(['numero_wave' => '77 000 00 01', 'numero_orange' => '78 000 00 02']);
        ReglagesAbonnement::oublier();
        $admin = Utilisateur::create([
            'identifiant' => 'admin@test.sn', 'mot_de_passe' => bcrypt('Password123'), 'role' => 'admin', 'nom_commerce' => 'Admin',
        ]);
        $this->jetonAdmin = $admin->createToken('admin')->plainTextToken;
        $this->idAdmin = $admin->id;
    }

    /** Commerçant + paiement déclaré ; renvoie [commerçant, jeton, id du paiement]. */
    private function commercantQuiDeclare(string $identifiant = 'awa@test.sn', array $champs = []): array
    {
        [$commercant, $jeton] = $this->inscrireCommercant($identifiant, 'Boutique '.$identifiant);
        $commercant->update(['telephone' => '77 123 45 67']);
        $id = $this->postJson('/api/abonnement/paiements', $champs + [
            'plan' => 'pro', 'periode' => 'mois', 'moyen' => 'wave', 'numero_payeur' => '+221 77 123 45 67',
            'reference' => 'TX-'.strtoupper(substr(md5($identifiant), 0, 8)), 'montant' => 5000,
        ], $this->entetes($jeton))->assertCreated()->json('paiement.id');

        return [$commercant, $jeton, $id];
    }

    private function admin(string $methode, string $adresse, array $corps = []): \Illuminate\Testing\TestResponse
    {
        return $this->json($methode, $adresse, $corps, $this->entetes($this->jetonAdmin));
    }

    public function test_un_commercant_n_accede_pas_a_l_administration(): void
    {
        [, $jeton] = $this->inscrireCommercant();
        $this->getJson('/api/admin/paiements', $this->entetes($jeton))->assertForbidden();
        $this->getJson('/api/admin/tableau-de-bord', $this->entetes($jeton))->assertForbidden();
    }

    public function test_la_file_montre_les_controles_et_l_effet_d_une_validation(): void
    {
        [, , $id] = $this->commercantQuiDeclare('awa@test.sn', ['montant' => 4500]);

        $file = $this->admin('GET', '/api/admin/paiements')->assertOk()->json();
        $this->assertSame(1, $file['compteurs']['en_attente']);
        $paiement = $file['paiements'][0];
        $this->assertSame($id, $paiement['id']);
        $this->assertSame(['montant_conforme' => false, 'ecart' => -500, 'reference_reutilisee' => false, 'numero_du_compte' => true], $paiement['controles']);
        // Pendant l'essai (jusqu'au 19/11), un mois Pro commence après l'essai.
        $this->assertSame(['2026-11-20', '2026-12-19'], [$paiement['effet']['debut_le'], $paiement['effet']['fin_le']]);
        $this->assertSame('Pro actif jusqu’au 19 décembre 2026', $paiement['effet']['texte']);
        $this->assertStringStartsWith('https://wa.me/221771234567?text=', $paiement['commercant']['lien_whatsapp']);
        $this->assertFalse($paiement['a_capture']);
    }

    public function test_valider_exige_la_verification_puis_ouvre_la_periode_et_numerote_le_recu(): void
    {
        [$commercant, $jeton, $id] = $this->commercantQuiDeclare();

        $this->admin('POST', "/api/admin/paiements/{$id}/valider")->assertStatus(422)->assertJsonValidationErrors('verifie');

        $valide = $this->admin('POST', "/api/admin/paiements/{$id}/valider", ['verifie' => true])->assertOk()->json('paiement');
        $this->assertSame(['valide', 'SC-0001', '2026-11-20', '2026-12-19'], [$valide['statut'], $valide['numero_recu'], $valide['debut_le'], $valide['fin_le']]);
        $this->assertSame(['Pro', '2026-12-19'], [$commercant->fresh()->plan, $commercant->fresh()->expiration->toDateString()]);

        // Deux clics : pas deux périodes.
        $this->admin('POST', "/api/admin/paiements/{$id}/valider", ['verifie' => true])->assertStatus(409);

        // Pendant l'essai, l'essai s'applique ; à sa fin, la période payée.
        $this->assertSame('essai', $this->getJson('/api/abonnement', $this->entetes($jeton))->json('etat.source'));
        $this->travelTo(Carbon::parse('2026-11-25'));
        $jeton = $commercant->createToken('t')->plainTextToken;
        $etat = $this->getJson('/api/abonnement', $this->entetes($jeton))->json('etat');
        $this->assertSame(['pro', 'paye', '2026-12-19'], [$etat['plan']['code'], $etat['source'], $etat['fin_le']]);
    }

    public function test_un_renouvellement_prolonge_et_un_plan_superieur_commence_tout_de_suite(): void
    {
        [$commercant, $jeton, $id] = $this->commercantQuiDeclare('awa@test.sn', ['plan' => 'essentiel', 'montant' => 2500]);
        $commercant->update(['essai_jusqu_au' => null]);
        $this->admin('POST', "/api/admin/paiements/{$id}/valider", ['verifie' => true])->assertOk();
        $premier = PaiementAbonnement::find($id);
        $this->assertSame(['2026-10-20', '2026-11-19'], [$premier->debut_le->toDateString(), $premier->fin_le->toDateString()]);

        // Renouvellement anticipé : à la suite, aucun jour perdu.
        $renouvellement = $this->postJson('/api/abonnement/paiements', [
            'plan' => 'essentiel', 'periode' => 'mois', 'moyen' => 'orange', 'numero_payeur' => '78 555 44 33', 'reference' => 'OM-1', 'montant' => 2500,
        ], $this->entetes($jeton))->assertCreated()->json('paiement.id');
        $p = $this->admin('POST', "/api/admin/paiements/{$renouvellement}/valider", ['verifie' => true])->json('paiement');
        $this->assertSame(['2026-11-20', '2026-12-19', 'SC-0002'], [$p['debut_le'], $p['fin_le'], $p['numero_recu']]);
        $this->assertSame('2026-12-19', $this->getJson('/api/abonnement', $this->entetes($jeton))->json('etat.fin_le'));

        // Passage au Pro : tout de suite.
        $superieur = $this->postJson('/api/abonnement/paiements', [
            'plan' => 'pro', 'periode' => 'mois', 'moyen' => 'wave', 'numero_payeur' => '77 123 45 67', 'reference' => 'TX-PRO', 'montant' => 5000,
        ], $this->entetes($jeton))->assertCreated()->json('paiement.id');
        $p = $this->admin('POST', "/api/admin/paiements/{$superieur}/valider", ['verifie' => true])->json('paiement');
        $this->assertSame('2026-10-20', $p['debut_le']);
        $this->assertSame('pro', $this->getJson('/api/abonnement', $this->entetes($jeton))->json('etat.plan.code'));
    }

    public function test_refuser_avec_un_motif_puis_annuler_une_decision(): void
    {
        [$commercant, $jeton, $id] = $this->commercantQuiDeclare();

        $this->admin('POST', "/api/admin/paiements/{$id}/refuser")->assertStatus(422);
        $refuse = $this->admin('POST', "/api/admin/paiements/{$id}/refuser", ['motif' => 'Paiement introuvable'])->assertOk()->json('paiement');
        $this->assertSame(['refuse', 'Paiement introuvable'], [$refuse['statut'], $refuse['motif_refus']]);
        $this->assertSame('Paiement introuvable', $this->getJson('/api/abonnement', $this->entetes($jeton))->json('dernier_refus.motif_refus'));

        // Erreur de clic : la décision s'annule, le paiement redevient à vérifier.
        $this->admin('POST', "/api/admin/paiements/{$id}/annuler")->assertOk()->assertJsonPath('paiement.statut', 'en_attente');
        $this->admin('POST', "/api/admin/paiements/{$id}/valider", ['verifie' => true])->assertOk();
        $this->admin('POST', "/api/admin/paiements/{$id}/annuler")->assertOk();
        $this->assertSame(['Gratuit', null], [$commercant->fresh()->plan, $commercant->fresh()->expiration]);
        $this->assertNull(PaiementAbonnement::find($id)->numero_recu);

        $this->admin('GET', '/api/admin/paiements?statut=refuse')->assertOk()->assertJsonCount(0, 'paiements');
    }

    public function test_la_photo_du_recu_ne_voyage_qu_avec_la_fiche_du_paiement(): void
    {
        $photo = 'data:image/jpeg;base64,'.base64_encode(str_repeat('x', 300));
        [, , $id] = $this->commercantQuiDeclare('awa@test.sn', ['capture' => $photo]);

        $liste = $this->admin('GET', '/api/admin/paiements')->json('paiements.0');
        $this->assertTrue($liste['a_capture']);
        $this->assertArrayNotHasKey('capture', $liste);
        $this->assertSame($photo, $this->admin('GET', "/api/admin/paiements/{$id}")->assertOk()->json('capture'));
    }

    public function test_les_commercants_leurs_filtres_et_leur_fiche(): void
    {
        [$awa, , $id] = $this->commercantQuiDeclare();
        [$moussa] = $this->inscrireCommercant('moussa@test.sn', 'Moussa');
        $moussa->update(['statut' => 'Bloqué']);
        [$proprietaire] = $this->inscrireCommercant('patron@test.sn', 'Patron');
        $this->creerEmploye($proprietaire, ['vente' => true], 'vendeur@test.sn');

        $liste = $this->admin('GET', '/api/admin/commercants')->assertOk()->json();
        // L'employé n'est pas un commerçant.
        $this->assertSame(['patron@test.sn', 'moussa@test.sn', 'awa@test.sn'], array_column($liste['commercants'], 'identifiant'));
        $this->assertSame(1, $liste['compteurs']['bloques']);
        $this->assertSame(1, $liste['compteurs']['attente']);
        $this->assertSame(['awa@test.sn'], array_column($this->admin('GET', '/api/admin/commercants?filtre=attente')->json('commercants'), 'identifiant'));
        $this->assertSame(['moussa@test.sn'], array_column($this->admin('GET', '/api/admin/commercants?recherche=mous')->json('commercants'), 'identifiant'));
        // La référence de transaction se retrouve aussi, tapée autrement.
        $reference = 'tx '.strtolower(substr(md5('awa@test.sn'), 0, 8));
        $this->assertSame(['awa@test.sn'], array_column($this->admin('GET', '/api/admin/commercants?recherche='.urlencode($reference))->json('commercants'), 'identifiant'));

        $fiche = $this->admin('GET', "/api/admin/commercants/{$awa->id}")->assertOk()->json();
        $this->assertSame('attente', $fiche['statut']);
        $this->assertSame(1, $fiche['utilisation']['boutiques']);
        $this->assertSame($id, $fiche['paiements'][0]['id']);
        $this->assertStringContainsString('Bonjour Boutique awa@test.sn', $fiche['relance']['texte']);
        $this->assertStringStartsWith('https://wa.me/221771234567', $fiche['relance']['lien_whatsapp']);
    }

    public function test_offrir_des_jours_et_enregistrer_un_paiement_en_especes(): void
    {
        [$commercant, $jeton] = $this->inscrireCommercant();
        $commercant->update(['essai_jusqu_au' => null]);

        $this->admin('POST', "/api/admin/commercants/{$commercant->id}/offrir", ['jours' => 10, 'plan' => 'pro'])
            ->assertCreated()->assertJsonPath('paiement.fin_le', '2026-10-29')->assertJsonPath('paiement.numero_recu', null);
        $especes = $this->admin('POST', "/api/admin/commercants/{$commercant->id}/plan", ['plan' => 'pro', 'periode' => 'mois', 'moyen' => 'especes'])
            ->assertCreated()->json('paiement');
        // À la suite des jours offerts, au prix du plan.
        $this->assertSame(['2026-10-30', '2026-11-29', 5000, 'SC-0001'], [$especes['debut_le'], $especes['fin_le'], $especes['montant_declare'], $especes['numero_recu']]);
        $this->assertSame('2026-11-29', $this->getJson('/api/abonnement', $this->entetes($jeton))->json('etat.fin_le'));
    }

    public function test_le_catalogue_et_les_reglages_se_modifient_sans_redeployer(): void
    {
        $this->admin('PUT', '/api/admin/plans/essentiel', ['prix_mensuel' => 3000, 'limites' => ['produits' => 500], 'fonctionnalites' => ['exports']])->assertOk();
        $this->admin('PUT', '/api/admin/plans/gratuit', ['prix_mensuel' => 100])->assertStatus(422);
        $this->admin('PUT', '/api/admin/plans/pro', ['fonctionnalites' => ['inconnue']])->assertStatus(422);
        $this->admin('PUT', '/api/admin/reglages', ['mois_offerts_annuel' => 1, 'numero_wave' => 'pas un numéro'])->assertStatus(422)->assertJsonValidationErrors('numero_wave');
        $this->admin('PUT', '/api/admin/reglages', ['mois_offerts_annuel' => 1, 'delai_grace_jours' => 3])->assertOk()->assertJsonPath('reglages.delai_grace_jours', 3);

        $plans = collect($this->admin('GET', '/api/admin/plans')->json('plans'))->keyBy('code');
        $this->assertSame([3000, 33000, 500, ['exports']], [
            $plans['essentiel']['prix_mensuel'], $plans['essentiel']['prix_annuel'], $plans['essentiel']['limites']['produits'], $plans['essentiel']['fonctionnalites'],
        ]);

        // Le montant attendu suit le nouveau prix.
        [, $jeton] = $this->inscrireCommercant();
        $this->postJson('/api/abonnement/paiements', [
            'plan' => 'essentiel', 'periode' => 'an', 'moyen' => 'wave', 'numero_payeur' => '77 123 45 67', 'reference' => 'TX-1', 'montant' => 33000,
        ], $this->entetes($jeton))->assertCreated()->assertJsonPath('paiement.montant_attendu', 33000);
    }

    public function test_la_creation_d_un_compte_par_l_administrateur(): void
    {
        $cree = $this->admin('POST', '/api/admin/utilisateurs', ['identifiant' => 'fatou@test.sn', 'nom_commerce' => 'Chez Fatou', 'telephone' => '70 111 22 33'])
            ->assertCreated()->json();
        $this->assertMatchesRegularExpression('/^[a-z0-9]{4}-\d{4}-[a-z0-9]{4}$/', $cree['mot_de_passe_provisoire']);
        $this->assertNotNull($cree['boutique_active_id']);
        $this->assertArrayNotHasKey('mot_de_passe', $cree);

        // Le mot de passe provisoire ouvre bien le compte, en essai Pro.
        $jeton = $this->postJson('/api/auth/connexion', ['identifiant' => 'fatou@test.sn', 'mot_de_passe' => $cree['mot_de_passe_provisoire']])
            ->assertOk()->json('jeton');
        $this->assertSame('essai', $this->getJson('/api/abonnement', $this->entetes($jeton))->json('etat.source'));
    }

    public function test_les_finances_et_le_tableau_de_bord(): void
    {
        [, , $p1] = $this->commercantQuiDeclare('awa@test.sn');
        [, , $p2] = $this->commercantQuiDeclare('moussa@test.sn', ['plan' => 'essentiel', 'periode' => 'an', 'moyen' => 'orange', 'montant' => 25000]);
        $this->commercantQuiDeclare('kane@test.sn');
        $this->admin('POST', "/api/admin/paiements/{$p1}/valider", ['verifie' => true]);
        $this->admin('POST', "/api/admin/paiements/{$p2}/valider", ['verifie' => true]);
        $this->travel(1)->minutes();
        Retrait::create(['admin_id' => $this->idAdmin, 'montant' => 2000, 'moyen' => 'wave', 'statut' => 'validé']);
        $this->travel(1)->minutes();
        TransfertAdmin::create(['admin_id' => $this->idAdmin, 'compte_source' => 'orange', 'compte_destination' => 'especes', 'montant' => 5000]);

        $finances = $this->admin('GET', '/api/admin/finances')->assertOk()->json();
        $comptes = collect($finances['comptes'])->keyBy('moyen');
        $this->assertSame([3000, 20000, 5000], [$comptes['wave']['solde'], $comptes['orange']['solde'], $comptes['especes']['solde']]);
        $this->assertSame(28000, $finances['total']);
        $this->assertSame(30000, $finances['encaisse_mois']);
        $this->assertSame(['transfert', 'retrait'], array_slice(array_column($finances['mouvements'], 'type'), 0, 2));

        $tableau = $this->admin('GET', '/api/admin/tableau-de-bord')->assertOk()->json();
        $this->assertSame(30000, $tableau['chiffres']['encaisse_mois']);
        $this->assertSame(2, $tableau['chiffres']['paiements_valides_mois']);
        $this->assertSame(1, $tableau['chiffres']['a_verifier']);
        $this->assertSame(3, $tableau['chiffres']['commercants']);
        $this->assertSame(3, $tableau['repartition']['essai']); // périodes payées : après l'essai
        $this->assertSame(['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'], array_column($tableau['revenus'], 'mois'));
        $this->assertSame(30000, $tableau['revenus'][5]['total']);
    }

    /** Bloquer un compte ferme ses sessions ; le réactiver lui rend la connexion. */
    public function test_bloquer_ferme_les_sessions_ouvertes(): void
    {
        [$commercant, $jeton] = $this->inscrireCommercant('bloque@test.sn');
        $this->getJson('/api/auth/moi', $this->entetes($jeton))->assertOk();

        $this->admin('PUT', "/api/admin/utilisateurs/{$commercant->id}/bloquer")->assertOk();
        $this->getJson('/api/auth/moi', $this->entetes($jeton))->assertUnauthorized();
        $this->postJson('/api/auth/connexion', ['identifiant' => 'bloque@test.sn', 'mot_de_passe' => 'Password123'])->assertStatus(403);

        $this->admin('PUT', "/api/admin/utilisateurs/{$commercant->id}/activer")->assertOk();
        $this->postJson('/api/auth/connexion', ['identifiant' => 'bloque@test.sn', 'mot_de_passe' => 'Password123'])->assertOk();
    }

    /** Un retrait ou un transfert ne vide pas un compte au-delà de son solde. */
    public function test_retraits_et_transferts_restent_dans_le_solde(): void
    {
        [, , $p1] = $this->commercantQuiDeclare('awa@test.sn');
        $this->admin('POST', "/api/admin/paiements/{$p1}/valider", ['verifie' => true]); // Wave : 5 000 F

        $this->admin('POST', '/api/admin/retraits', ['montant' => 6000, 'moyen' => 'wave'])
            ->assertStatus(422)->assertJsonPath('erreur', 'Le compte Wave n’a que 5 000 F.');
        $this->admin('POST', '/api/admin/retraits', ['montant' => 100, 'moyen' => 'banque'])->assertStatus(422);
        $this->admin('POST', '/api/admin/transferts', ['source' => 'wave', 'destination' => 'wave', 'montant' => 100])->assertStatus(422);

        $this->admin('POST', '/api/admin/transferts', ['source' => 'wave', 'destination' => 'especes', 'montant' => 1500])->assertCreated();
        $this->admin('POST', '/api/admin/retraits', ['montant' => 3500, 'moyen' => 'wave'])->assertCreated();
        $this->admin('POST', '/api/admin/retraits', ['montant' => 1, 'moyen' => 'wave'])->assertStatus(422);

        $comptes = collect($this->admin('GET', '/api/admin/finances')->json('comptes'))->keyBy('moyen');
        $this->assertSame([0, 1500], [$comptes['wave']['solde'], $comptes['especes']['solde']]);
    }

    public function test_les_rappels_d_echeance_partent_une_seule_fois(): void
    {
        Mail::fake();
        [$commercant] = $this->inscrireCommercant('awa@test.sn');
        $commercant->update(['essai_jusqu_au' => null]);
        PaiementAbonnement::create([
            'utilisateur_id' => $commercant->id, 'plan_code' => 'pro', 'periode' => 'mois', 'montant_attendu' => 5000,
            'montant_declare' => 5000, 'moyen' => 'wave', 'statut' => 'valide', 'debut_le' => '2026-09-28', 'fin_le' => '2026-10-27',
        ]);
        \App\Services\Abonnements::synchroniserCompte($commercant);

        $this->assertSame(1, RappelsAbonnement::envoyerCeuxDuJour());   // J-7
        $this->assertSame(0, RappelsAbonnement::envoyerCeuxDuJour());   // déjà envoyé
        Mail::assertSent(RappelAbonnement::class, fn ($m) => $m->hasTo('awa@test.sn') && str_contains($m->texte, '27 octobre 2026'));

        $this->travelTo(Carbon::parse('2026-10-23'));
        $this->assertSame(0, RappelsAbonnement::envoyerCeuxDuJour());   // J-4 : rien
        $this->travelTo(Carbon::parse('2026-10-29'));
        $this->assertSame(1, RappelsAbonnement::envoyerCeuxDuJour());   // délai de grâce
    }
}
