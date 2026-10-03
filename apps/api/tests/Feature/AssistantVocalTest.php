<?php

namespace Tests\Feature;

use App\Models\PaiementAbonnement;
use App\Models\Plan;
use App\Models\QuestionAssistant;
use App\Models\Utilisateur;
use App\Services\AssistantVocal\AssistantVocal;
use App\Services\AssistantVocal\OutilsAssistant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Tests\Feature\Outils\CreationComptes;
use Tests\TestCase;

/**
 * Assistant vocal (bêta). Google (Gemini) et Soynade sont simulés : aucun
 * appel payant pendant les tests. On vérifie ce que l'application leur ENVOIE
 * (langue, outils, réponses des outils) et ce qu'elle renvoie au commerçant.
 */
class AssistantVocalTest extends TestCase
{
    use CreationComptes;
    use RefreshDatabase;

    private const GEMINI = 'https://generativelanguage.googleapis.com/v1beta/models/';

    private const TRANSCRIPTION = 'https://api.soynade.ai/v1/audio/transcriptions';

    private const VOIX = 'https://api.soynade.ai/v1/text-to-speech';

    private Utilisateur $proprietaire;

    private string $jeton;

    protected function setUp(): void
    {
        parent::setUp();
        Cache::flush();
        $this->travelTo(Carbon::parse('2026-10-15 12:00:00'));
        config([
            'assistant_vocal.comptes' => ['proprietaire@test.sn'],
            'assistant_vocal.questions_par_jour' => 40,
            'assistant_vocal.soynade.url' => 'https://api.soynade.ai',
            'assistant_vocal.soynade.cle' => 'cle-de-test',
            'assistant_vocal.gemini.url' => 'https://generativelanguage.googleapis.com/v1beta',
            'assistant_vocal.gemini.cle' => 'cle-de-test',
            'assistant_vocal.gemini.modeles' => ['modele-a', 'modele-b'],
        ]);
        [$this->proprietaire, $this->jeton] = $this->inscrireCommercant();
    }

    // ── Ouverture de la bêta ─────────────────────────────────────────────────

    public function test_l_assistant_reste_ferme_aux_comptes_hors_de_la_beta(): void
    {
        config(['assistant_vocal.comptes' => ['autre@test.sn']]);
        Http::fake();

        $this->getJson('/api/assistant-vocal/etat', $this->entetes($this->jeton))
            ->assertOk()->assertJson(['disponible' => false, 'questions_restantes' => 0]);
        $this->postJson('/api/assistant-vocal/questions', ['langue' => 'fr', 'texte' => 'Bonjour'], $this->entetes($this->jeton))
            ->assertForbidden();
        Http::assertNothingSent();
    }

    public function test_l_identifiant_recopie_dans_render_tolere_majuscules_et_espaces(): void
    {
        config(['assistant_vocal.comptes' => ['autre@test.sn', ' Proprietaire@TEST.sn ']]);

        $this->getJson('/api/assistant-vocal/etat', $this->entetes($this->jeton))
            ->assertOk()->assertJson(['disponible' => true]);
    }

    public function test_sans_cles_d_api_l_assistant_reste_ferme(): void
    {
        config(['assistant_vocal.comptes' => ['*'], 'assistant_vocal.soynade.cle' => null]);

        $this->getJson('/api/assistant-vocal/etat', $this->entetes($this->jeton))
            ->assertOk()->assertJson(['disponible' => false]);
    }

    public function test_le_compte_de_demonstration_n_a_jamais_l_assistant(): void
    {
        config(['assistant_vocal.comptes' => ['*'], 'app.compte_demo' => 'proprietaire@test.sn']);

        $this->getJson('/api/assistant-vocal/etat', $this->entetes($this->jeton))
            ->assertOk()->assertJson(['disponible' => false]);
    }

    public function test_l_etat_annonce_le_micro_et_les_questions_restantes(): void
    {
        $this->getJson('/api/assistant-vocal/etat', $this->entetes($this->jeton))
            ->assertOk()
            ->assertExactJson(['disponible' => true, 'questions_restantes' => 40, 'duree_max_secondes' => 30]);
    }

    // ── Réservé aux abonnés ──────────────────────────────────────────────────

    public function test_un_abonne_dont_le_plan_inclut_l_assistant_a_le_micro(): void
    {
        config(['assistant_vocal.comptes' => []]);
        foreach (['essentiel', 'pro', 'entreprise'] as $code) {
            $this->assertTrue(Plan::parCode($code)->inclut('assistant_vocal'), "plan {$code}");
        }
        $this->abonner('essentiel');

        $this->getJson('/api/assistant-vocal/etat', $this->entetes($this->jeton))
            ->assertOk()->assertJson(['disponible' => true, 'questions_restantes' => 40]);
    }

    public function test_ni_l_essai_gratuit_ni_le_plan_gratuit_n_ont_l_assistant(): void
    {
        config(['assistant_vocal.comptes' => []]);
        Http::fake();

        // Juste inscrit : essai du plan Pro, mais aucun abonnement payé.
        $this->assertNotNull($this->proprietaire->essai_jusqu_au);
        $this->getJson('/api/assistant-vocal/etat', $this->entetes($this->jeton))->assertJson(['disponible' => false]);
        $this->postJson('/api/assistant-vocal/questions', ['langue' => 'fr', 'texte' => 'Bonjour'], $this->entetes($this->jeton))
            ->assertForbidden();

        // Essai terminé : plan Gratuit.
        $this->proprietaire->update(['essai_jusqu_au' => null]);
        $this->getJson('/api/assistant-vocal/etat', $this->entetes($this->jeton))->assertJson(['disponible' => false]);
        Http::assertNothingSent();
    }

    public function test_l_administrateur_peut_retirer_l_assistant_d_un_plan(): void
    {
        config(['assistant_vocal.comptes' => []]);
        $this->abonner('pro');
        $pro = Plan::parCode('pro');
        $pro->update(['fonctionnalites' => array_values(array_diff($pro->fonctionnalites, ['assistant_vocal']))]);
        Plan::oublierCatalogue();

        $this->getJson('/api/assistant-vocal/etat', $this->entetes($this->jeton))->assertJson(['disponible' => false]);
    }

    public function test_l_employe_d_un_abonne_a_le_micro_de_la_boutique(): void
    {
        config(['assistant_vocal.comptes' => []]);
        $this->abonner('pro');
        [, $jetonEmploye] = $this->creerEmploye($this->proprietaire, ['vente' => true]);

        // C'est le plan du PROPRIÉTAIRE qui compte (l'employé, lui, est en essai).
        $this->getJson('/api/assistant-vocal/etat', $this->entetes($jetonEmploye))->assertJson(['disponible' => true]);
    }

    // ── Les trois étapes : oreille, cerveau, voix ────────────────────────────

    public function test_les_ventes_du_jour_donnent_le_meme_chiffre_que_l_accueil(): void
    {
        $riz = $this->creerProduit('Riz brisé', 1000);
        $this->vendre($riz, 2, 'especes');
        $this->vendre($riz, 1, 'wave');
        $this->vendre($riz, 1, 'credit', 'Moussa Diop');
        $caAccueil = $this->getJson('/api/statistiques/resume-jour', $this->entetes($this->jeton))->json('ca');

        Http::fake([
            self::GEMINI.'*' => Http::sequence()
                ->push($this->appelOutil('consulter_ventes_du_jour'))
                ->push($this->texteGemini('Vous avez encaissé 3 000 F aujourd’hui.')),
            self::VOIX => Http::response('MP3', 200, ['Content-Type' => 'audio/mpeg']),
        ]);

        $id = $this->postJson('/api/assistant-vocal/questions', ['langue' => 'fr', 'texte' => 'Combien j’ai vendu aujourd’hui ?'], $this->entetes($this->jeton))
            ->assertOk()
            ->assertExactJson([
                'id' => QuestionAssistant::sole()->id,
                'transcription' => 'Combien j’ai vendu aujourd’hui ?',
                'reponse' => 'Vous avez encaissé 3 000 F aujourd’hui.',
                'langue' => 'fr',
                'carte' => ['valeur' => '3 000 F', 'libelle' => '3 ventes aujourd\'hui'],
                'action' => null,
                'questions_restantes' => 39,
            ])
            ->json('id');

        $this->assertSame(3000, $caAccueil);
        $this->assertSame(
            ['nombre_de_ventes' => 3, 'encaisse_fcfa' => 3000, 'vendu_a_credit_fcfa' => 1000],
            $this->reponsesDesOutils()[0],
        );
        // La réponse écrite n'attend pas la voix : elle se demande juste après.
        Http::assertNotSent(fn (Request $r) => $r->url() === self::VOIX);

        $voix = $this->post("/api/assistant-vocal/questions/{$id}/voix", [], $this->entetes($this->jeton))->assertOk();
        $this->assertSame('MP3', $voix->getContent());
        $this->assertStringStartsWith('audio/mpeg', $voix->headers->get('Content-Type'));
        // La voix lit les nombres en lettres : « 3 000 » était lu « trois zéro ».
        Http::assertSent(fn (Request $r) => $r->url() === self::VOIX
            && $r['text'] === 'Vous avez encaissé trois mille francs aujourd’hui.'
            && $r['language'] === 'fr');

        $journal = QuestionAssistant::sole();
        $this->assertNotNull($journal->duree_voix_ms);
        $this->assertSame('texte', $journal->mode);
        $this->assertSame('consulter_ventes_du_jour', $journal->outils);
        $this->assertSame('modele-a', $journal->modele);
        $this->assertNull($journal->erreur);
    }

    public function test_un_message_vocal_en_wolof_est_transcrit_par_soynade_et_lu_directement_par_gemini(): void
    {
        Http::fake([
            self::TRANSCRIPTION => Http::response(['text' => 'Tey niata laa jaay ?']),
            self::GEMINI.'*' => Http::response($this->texteGemini('Tey, jaay nga 3 000 F.')),
            self::VOIX => Http::response('MP3', 200, ['Content-Type' => 'audio/mpeg']),
        ]);

        $id = $this->post('/api/assistant-vocal/questions', ['langue' => 'wo', 'audio' => $this->wav(2)], $this->entetes($this->jeton))
            ->assertOk()
            ->assertJson(['transcription' => 'Tey niata laa jaay ?', 'reponse' => 'Tey, jaay nga 3 000 F.', 'langue' => 'wo'])
            ->json('id');
        $this->post("/api/assistant-vocal/questions/{$id}/voix", [], $this->entetes($this->jeton))->assertOk();

        Http::assertSent(fn (Request $r) => $r->url() === self::TRANSCRIPTION
            && $r->hasFile('file')
            && collect($r->data())->firstWhere('name', 'language')['contents'] === 'wo');
        // Le cerveau reçoit le wolof tel quel (pas de traduction, pas de son) et répond en wolof.
        Http::assertSent(fn (Request $r) => str_starts_with($r->url(), self::GEMINI)
            && str_starts_with($r['contents'][0]['parts'][0]['text'], 'Tey niata laa jaay ?')
            && str_contains($r['system_instruction']['parts'][0]['text'], 'Réponds uniquement en wolof'));
        Http::assertSent(fn (Request $r) => $r->url() === self::VOIX && $r['language'] === 'wo');
        $this->assertSame('voix', QuestionAssistant::sole()->mode);
    }

    public function test_un_message_vocal_en_francais_est_transcrit_par_gemini_qui_sait_qu_il_est_en_francais(): void
    {
        Http::fake([
            self::GEMINI.'*' => Http::sequence()
                ->push($this->texteGemini('Combien de sacs de riz me reste-t-il ?'))
                ->push($this->texteGemini('Il vous reste 6 sacs.')),
            self::VOIX => Http::response('MP3', 200, ['Content-Type' => 'audio/mpeg']),
        ]);

        $this->post('/api/assistant-vocal/questions', ['langue' => 'fr', 'audio' => $this->wav(3)], $this->entetes($this->jeton))
            ->assertOk()
            ->assertJson(['transcription' => 'Combien de sacs de riz me reste-t-il ?']);

        $premier = Http::recorded()->first()[0];
        $this->assertSame('audio/wav', $premier['contents'][0]['parts'][0]['inline_data']['mime_type']);
        // Sans cette précision, certaines phrases revenaient transcrites en anglais.
        $this->assertStringContainsString('FRANÇAIS, parlé avec un accent sénégalais', $premier['contents'][0]['parts'][1]['text']);
        Http::assertNotSent(fn (Request $r) => $r->url() === self::TRANSCRIPTION);
    }

    public function test_un_silence_repond_sans_deranger_le_cerveau(): void
    {
        Http::fake([
            self::TRANSCRIPTION => Http::response(['text' => ' [bruit] ']),
            self::VOIX => Http::response('MP3', 200, ['Content-Type' => 'audio/mpeg']),
            self::GEMINI.'*' => Http::response($this->texteGemini('ne doit pas servir')),
        ]);

        $this->post('/api/assistant-vocal/questions', ['langue' => 'wo', 'audio' => $this->wav(1)], $this->entetes($this->jeton))
            ->assertOk()
            ->assertJson(['reponse' => AssistantVocal::PAS_ENTENDU['wo']]);
        Http::assertNotSent(fn (Request $r) => str_starts_with($r->url(), self::GEMINI));
    }

    public function test_une_voix_en_panne_n_empeche_pas_la_reponse_ecrite(): void
    {
        Http::fake([
            self::GEMINI.'*' => Http::response($this->texteGemini('Bonjour !')),
            self::VOIX => Http::response('', 500),
        ]);

        $id = $this->postJson('/api/assistant-vocal/questions', ['langue' => 'fr', 'texte' => 'Bonjour'], $this->entetes($this->jeton))
            ->assertOk()
            ->assertJson(['reponse' => 'Bonjour !'])
            ->json('id');

        $this->postJson("/api/assistant-vocal/questions/{$id}/voix", [], $this->entetes($this->jeton))
            ->assertStatus(503)
            ->assertJson(['erreur' => 'Indisponible', 'etape' => 'voix']);
        // Rien n'a été facturé : la voix pourra être redemandée.
        $this->assertNull(QuestionAssistant::sole()->duree_voix_ms);
    }

    public function test_une_reponse_n_est_lue_qu_une_fois_et_seulement_par_sa_boutique(): void
    {
        Http::fake([
            self::GEMINI.'*' => Http::response($this->texteGemini('Bonjour !')),
            self::VOIX => Http::response('MP3', 200, ['Content-Type' => 'audio/mpeg']),
        ]);
        $id = $this->postJson('/api/assistant-vocal/questions', ['langue' => 'fr', 'texte' => 'Bonjour'], $this->entetes($this->jeton))->json('id');

        config(['assistant_vocal.comptes' => ['proprietaire@test.sn', 'voisin@test.sn']]);
        [, $jetonVoisin] = $this->inscrireCommercant('voisin@test.sn', 'Boutique voisine');
        $this->postJson("/api/assistant-vocal/questions/{$id}/voix", [], $this->entetes($jetonVoisin))->assertNotFound();

        $this->postJson("/api/assistant-vocal/questions/{$id}/voix", [], $this->entetes($this->jeton))->assertOk();
        // Une seconde lecture serait facturée une seconde fois.
        $this->postJson("/api/assistant-vocal/questions/{$id}/voix", [], $this->entetes($this->jeton))->assertStatus(409);
        Http::assertSentCount(2); // le cerveau, puis UNE voix
    }

    public function test_une_reponse_trop_ancienne_n_est_plus_lue(): void
    {
        Http::fake([
            self::GEMINI.'*' => Http::response($this->texteGemini('Bonjour !')),
            self::VOIX => Http::response('MP3', 200, ['Content-Type' => 'audio/mpeg']),
        ]);
        $id = $this->postJson('/api/assistant-vocal/questions', ['langue' => 'fr', 'texte' => 'Bonjour'], $this->entetes($this->jeton))->json('id');

        $this->travel(11)->minutes();
        $this->postJson("/api/assistant-vocal/questions/{$id}/voix", [], $this->entetes($this->jeton))->assertStatus(410);
        Http::assertNotSent(fn (Request $r) => $r->url() === self::VOIX);
    }

    // ── Guider, ne jamais inventer ───────────────────────────────────────────

    public function test_le_guidage_ouvre_la_page_et_fait_clignoter_le_bouton(): void
    {
        Http::fake([
            self::GEMINI.'*' => Http::sequence()
                ->push($this->appelOutil('guider', ['cible' => 'stock-ajouter']))
                ->push($this->texteGemini('J’ai ouvert le Stock : appuyez sur « + Ajouter ».')),
            self::VOIX => Http::response('MP3', 200, ['Content-Type' => 'audio/mpeg']),
        ]);

        $this->postJson('/api/assistant-vocal/questions', ['langue' => 'fr', 'texte' => 'Je veux ajouter un produit'], $this->entetes($this->jeton))
            ->assertOk()
            ->assertJson(['action' => ['type' => 'guider', 'ecran' => 'stock', 'bouton' => 'stock-ajouter']]);

        $this->assertSame([
            'statut' => 'page ouverte', 'page' => 'Stock', 'page_en_wolof' => 'Marsandiis',
            'a_faire' => 'appuyer sur « + Ajouter », puis remplir la fiche du nouveau produit',
            'bouton_entoure' => '+ Ajouter',
        ], $this->reponsesDesOutils()[0]);
        $this->assertSame('stock', QuestionAssistant::sole()->action);
    }

    public function test_une_page_sans_bouton_entoure_ne_fait_rien_annoncer_de_tel(): void
    {
        Http::fake([
            self::GEMINI.'*' => Http::sequence()
                ->push($this->appelOutil('guider', ['cible' => 'vente']))
                ->push($this->texteGemini('Touchez les produits vendus, puis « 💰 ENCAISSER ».')),
            self::VOIX => Http::response('MP3', 200, ['Content-Type' => 'audio/mpeg']),
        ]);

        $this->postJson('/api/assistant-vocal/questions', ['langue' => 'wo', 'texte' => 'Jaay naa benn peeru daal'], $this->entetes($this->jeton))
            ->assertOk()
            ->assertJson(['action' => ['type' => 'guider', 'ecran' => 'vente', 'bouton' => null]]);

        // Défaut vu en production le 03/10 : « appuyez sur le bouton qui clignote » sur une page où rien ne clignote.
        $retour = $this->reponsesDesOutils()[0];
        $this->assertArrayNotHasKey('bouton_entoure', $retour);
        $this->assertStringContainsString('ENCAISSER', $retour['a_faire']);
        $this->assertStringContainsString('Aucun bouton', $retour['remarque']);
    }

    public function test_les_commandes_et_la_caisse_ont_leur_bouton_entoure(): void
    {
        $this->assertSame('commandes-nouvelle', OutilsAssistant::CIBLES['commandes-nouvelle']['bouton']);
        $this->assertSame('+ Nouvelle', OutilsAssistant::CIBLES['commandes-nouvelle']['appuyer']);
        $this->assertSame('caisse-cloturer', OutilsAssistant::CIBLES['caisse']['bouton']);
        foreach (OutilsAssistant::CIBLES as $cible => $page) {
            $this->assertNotEmpty($page['a_faire'], "a_faire de {$cible}");
            $this->assertSame(isset($page['appuyer']), $page['bouton'] !== null, "bouton et libellé de {$cible}");
        }
    }

    public function test_la_langue_de_la_reponse_est_rappelee_au_cerveau(): void
    {
        Http::fake([
            self::GEMINI.'*' => Http::response($this->texteGemini('Bësal ci « + Ajouter ».')),
            self::VOIX => Http::response('MP3', 200, ['Content-Type' => 'audio/mpeg']),
        ]);

        // Défaut vu en production le 03/10 : ce message écrit avait reçu une réponse en français.
        $this->postJson('/api/assistant-vocal/questions', ['langue' => 'wo', 'texte' => 'Dama beug dougueul produit bou bess'], $this->entetes($this->jeton))
            ->assertOk();

        Http::assertSent(function (Request $r) {
            if (! str_starts_with($r->url(), self::GEMINI)) {
                return false;
            }
            $consignes = $r['system_instruction']['parts'][0]['text'];
            $question = $r['contents'][0]['parts'][0]['text'];

            return str_starts_with($question, 'Dama beug dougueul produit bou bess')
                && str_contains($question, 'Réponds en WOLOF')
                && str_contains($consignes, 'RAPPEL : Réponds en WOLOF')
                && str_contains($consignes, 'ne décris jamais leur couleur');
        });
    }

    public function test_un_client_inconnu_n_est_jamais_invente(): void
    {
        $savon = $this->creerProduit('Savon', 250);
        $this->vendre($savon, 2, 'credit', 'Awa Sarr');

        Http::fake([
            self::GEMINI.'*' => Http::sequence()
                ->push($this->appelOutil('consulter_dette', ['client' => 'Ousmane']))
                ->push($this->appelOutil('consulter_dette', ['client' => 'Awa Sall']))
                ->push($this->appelOutil('consulter_dette', ['client' => 'awa sarr']))
                ->push($this->texteGemini('Awa Sarr vous doit 500 F.')),
            self::VOIX => Http::response('MP3', 200, ['Content-Type' => 'audio/mpeg']),
        ]);

        $this->postJson('/api/assistant-vocal/questions', ['langue' => 'fr', 'texte' => 'Combien me doit Ousmane ?'], $this->entetes($this->jeton))
            ->assertOk()
            ->assertJson(['carte' => ['valeur' => '500 F', 'libelle' => 'Awa Sarr vous doit']]);

        [$inconnu, $malEntendu, $trouve] = $this->reponsesDesOutils();
        $this->assertSame(['erreur' => 'Aucun client « Ousmane » dans cette boutique.', 'noms_proches' => []], $inconnu);
        $this->assertSame(['Awa Sarr'], $malEntendu['noms_proches']);
        $this->assertSame(['client' => 'Awa Sarr', 'dette_fcfa' => 500, 'autres_clients_semblables' => []], $trouve);
    }

    public function test_le_stock_se_lit_dans_l_unite_affichee_et_sans_accents(): void
    {
        $this->postJson('/api/produits', ['nom' => 'Sucre en poudre', 'prix_vente' => 650, 'prix_achat' => 500, 'stock' => 40000, 'unite_base' => 'g'], $this->entetes($this->jeton))
            ->assertCreated();

        Http::fake([
            self::GEMINI.'*' => Http::sequence()
                ->push($this->appelOutil('consulter_stock', ['produit' => 'SUCRE']))
                ->push($this->texteGemini('Il reste 40 kg de sucre.')),
            self::VOIX => Http::response('MP3', 200, ['Content-Type' => 'audio/mpeg']),
        ]);

        $this->postJson('/api/assistant-vocal/questions', ['langue' => 'wo', 'texte' => 'Suukar bi, ñaata moo des ?'], $this->entetes($this->jeton))
            ->assertOk()
            ->assertJson(['carte' => ['valeur' => '40 kg', 'libelle' => 'Sucre en poudre en stock']]);

        $this->assertSame(
            ['produits' => [['produit' => 'Sucre en poudre', 'stock' => '40 kg', 'prix' => '650 F le kg']]],
            $this->reponsesDesOutils()[0],
        );
        // Le catalogue de la boutique est donné au cerveau pour relier « suukar » au bon produit.
        Http::assertSent(fn (Request $r) => str_starts_with($r->url(), self::GEMINI)
            && str_contains($r['system_instruction']['parts'][0]['text'], 'Sucre en poudre (kg)'));
    }

    public function test_un_employe_ne_lit_que_ce_que_ses_permissions_lui_ouvrent(): void
    {
        [$employe, $jetonEmploye] = $this->creerEmploye($this->proprietaire, ['stock' => true]);

        Http::fake([
            self::GEMINI.'*' => Http::sequence()
                ->push($this->appelOutil('consulter_ventes_du_jour'))
                ->push($this->appelOutil('guider', ['cible' => 'caisse']))
                ->push($this->texteGemini('Je ne peux pas vous donner cette information.')),
            self::VOIX => Http::response('MP3', 200, ['Content-Type' => 'audio/mpeg']),
        ]);

        $this->postJson('/api/assistant-vocal/questions', ['langue' => 'fr', 'texte' => 'Combien on a vendu ?'], $this->entetes($jetonEmploye))
            ->assertOk()
            ->assertJson(['carte' => null, 'action' => null]);

        $refus = ['erreur' => 'Cette information n\'est pas accessible avec votre compte employé.'];
        $this->assertSame([$refus, $refus], $this->reponsesDesOutils());
        // La question compte dans le quota du commerçant, au nom de l'employé.
        $journal = QuestionAssistant::sole();
        $this->assertSame($this->proprietaire->id, $journal->utilisateur_id);
        $this->assertSame($employe->id, (int) $journal->pose_par);
    }

    // ── Garde-fous : quota, modèles saturés, fichiers ────────────────────────

    public function test_le_quota_du_jour_est_respecte(): void
    {
        config(['assistant_vocal.questions_par_jour' => 1]);
        Http::fake([
            self::GEMINI.'*' => Http::response($this->texteGemini('Bonjour !')),
            self::VOIX => Http::response('MP3', 200, ['Content-Type' => 'audio/mpeg']),
        ]);

        $this->postJson('/api/assistant-vocal/questions', ['langue' => 'fr', 'texte' => 'Bonjour'], $this->entetes($this->jeton))
            ->assertOk()->assertJson(['questions_restantes' => 0]);
        $this->postJson('/api/assistant-vocal/questions', ['langue' => 'fr', 'texte' => 'Encore'], $this->entetes($this->jeton))
            ->assertStatus(429);

        // Le lendemain, le compteur repart.
        $this->travelTo(Carbon::parse('2026-10-16 08:00:00'));
        $this->getJson('/api/assistant-vocal/etat', $this->entetes($this->jeton))->assertJson(['questions_restantes' => 1]);
    }

    public function test_un_modele_sature_passe_la_main_au_suivant(): void
    {
        Http::fake([
            self::GEMINI.'modele-a:generateContent' => Http::response(['error' => ['message' => 'overloaded']], 503),
            self::GEMINI.'modele-b:generateContent' => Http::response($this->texteGemini('Bonjour !')),
            self::VOIX => Http::response('MP3', 200, ['Content-Type' => 'audio/mpeg']),
        ]);

        $this->postJson('/api/assistant-vocal/questions', ['langue' => 'fr', 'texte' => 'Bonjour'], $this->entetes($this->jeton))
            ->assertOk()->assertJson(['reponse' => 'Bonjour !']);
        $this->assertSame('modele-b', QuestionAssistant::sole()->modele);
    }

    public function test_un_modele_sature_est_laisse_de_cote_une_minute(): void
    {
        Http::fake([
            self::GEMINI.'modele-a:generateContent' => Http::response(['error' => ['message' => 'quota']], 429),
            self::GEMINI.'modele-b:generateContent' => Http::response($this->texteGemini('Bonjour !')),
        ]);
        $poser = fn () => $this->postJson('/api/assistant-vocal/questions', ['langue' => 'fr', 'texte' => 'Bonjour'], $this->entetes($this->jeton))->assertOk();
        $appelsA = fn () => Http::recorded(fn (Request $r) => str_contains($r->url(), 'modele-a'))->count();

        $poser();
        $poser();
        $this->assertSame(1, $appelsA()); // la seconde question ne l'a pas attendu

        $this->travel(61)->seconds();
        $poser();
        $this->assertSame(2, $appelsA());
    }

    public function test_si_le_cerveau_echoue_ce_qui_a_ete_compris_n_est_pas_perdu(): void
    {
        Http::fake([
            self::TRANSCRIPTION => Http::response(['text' => 'Tey ñaata laa jaay ?']),
            self::GEMINI.'*' => Http::response(['error' => ['message' => 'quota']], 429),
        ]);

        $this->post('/api/assistant-vocal/questions', ['langue' => 'wo', 'audio' => $this->wav(2)], $this->entetes($this->jeton))
            ->assertStatus(503)
            ->assertJson(['etape' => 'cerveau', 'transcription' => 'Tey ñaata laa jaay ?']);
        $this->assertSame('Tey ñaata laa jaay ?', QuestionAssistant::sole()->transcription);
    }

    public function test_quand_tout_google_est_sature_le_commercant_est_prevenu(): void
    {
        Http::fake([self::GEMINI.'*' => Http::response(['error' => ['message' => 'quota']], 429)]);

        $this->postJson('/api/assistant-vocal/questions', ['langue' => 'fr', 'texte' => 'Bonjour'], $this->entetes($this->jeton))
            ->assertStatus(503)
            ->assertJson(['erreur' => 'Indisponible', 'etape' => 'cerveau']);
        $this->assertStringContainsString('modele-b : HTTP 429', QuestionAssistant::sole()->erreur);
    }

    public function test_un_fichier_qui_n_est_pas_un_message_vocal_valable_est_refuse(): void
    {
        Http::fake();
        $faux = UploadedFile::fake()->createWithContent('message.wav', str_repeat('x', 2000));

        $this->post('/api/assistant-vocal/questions', ['langue' => 'wo', 'audio' => $faux], $this->entetes($this->jeton))
            ->assertUnprocessable()->assertJsonValidationErrors('audio');
        $this->post('/api/assistant-vocal/questions', ['langue' => 'wo', 'audio' => $this->wav(31.5)], $this->entetes($this->jeton))
            ->assertUnprocessable()->assertJsonValidationErrors('audio');
        $this->postJson('/api/assistant-vocal/questions', ['langue' => 'en', 'texte' => 'Hello'], $this->entetes($this->jeton))
            ->assertUnprocessable()->assertJsonValidationErrors('langue');
        $this->postJson('/api/assistant-vocal/questions', ['langue' => 'fr'], $this->entetes($this->jeton))
            ->assertUnprocessable()->assertJsonValidationErrors('audio');
        Http::assertNothingSent();
        $this->assertSame(0, QuestionAssistant::count());
    }

    // ── Outils de test ───────────────────────────────────────────────────────

    /** Un mois payé (et validé) du plan donné, essai terminé. */
    private function abonner(string $plan): void
    {
        $this->proprietaire->update(['essai_jusqu_au' => null]);
        PaiementAbonnement::create([
            'utilisateur_id' => $this->proprietaire->id, 'plan_code' => $plan, 'periode' => 'mois',
            'montant_attendu' => 5000, 'montant_declare' => 5000, 'moyen' => 'wave', 'statut' => 'valide',
            'debut_le' => '2026-10-01', 'fin_le' => '2026-10-31',
        ]);
    }

    private function creerProduit(string $nom, int $prix): int
    {
        return $this->postJson('/api/produits', ['nom' => $nom, 'prix_vente' => $prix, 'prix_achat' => $prix - 100, 'stock' => 100], $this->entetes($this->jeton))
            ->assertCreated()->json('id');
    }

    private function vendre(int $produitId, int $quantite, string $moyen, ?string $client = null): void
    {
        $vente = ['produit_id' => $produitId, 'quantite' => $quantite, 'moyen_paiement' => $moyen, 'nom_client' => $client];
        $this->postJson('/api/ventes', array_filter($vente), $this->entetes($this->jeton))->assertCreated();
    }

    /** Un message WAV mono 16 kHz de la durée voulue (du silence). */
    private function wav(float $secondes): UploadedFile
    {
        $donnees = str_repeat("\0", (int) round($secondes * 32000));
        $entete = 'RIFF'.pack('V', 36 + strlen($donnees)).'WAVE'
            .'fmt '.pack('VvvVVvv', 16, 1, 1, 16000, 32000, 2, 16)
            .'data'.pack('V', strlen($donnees));

        return UploadedFile::fake()->createWithContent('message.wav', $entete.$donnees);
    }

    private function appelOutil(string $nom, array $arguments = []): array
    {
        return ['candidates' => [['content' => ['role' => 'model', 'parts' => [
            ['functionCall' => ['name' => $nom, 'args' => $arguments ?: new \stdClass]],
        ]]]]];
    }

    private function texteGemini(string $texte): array
    {
        return ['candidates' => [['content' => ['role' => 'model', 'parts' => [['text' => $texte]]]]]];
    }

    /** Ce que les outils ont répondu au cerveau, dans l'ordre. */
    private function reponsesDesOutils(): array
    {
        $dernier = Http::recorded(fn (Request $r) => str_starts_with($r->url(), self::GEMINI))->last()[0];

        return collect($dernier['contents'])
            ->flatMap(fn (array $contenu) => $contenu['parts'])
            ->pluck('functionResponse.response')
            ->filter()
            ->values()
            ->all();
    }
}
