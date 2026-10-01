<?php

namespace Tests\Feature\Outils;

use App\Mail\CodeParEmail;
use App\Models\Utilisateur;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\URL;

/**
 * Rejeu du scénario de référence (tests/Contrat/scenario_historique.php) et
 * comparaison aux empreintes enregistrées avant la francisation.
 *
 * Utilisé par ContratHistoriqueTest (anciennes adresses, ancien format) et
 * ContratFrancaisTest (nouvelles adresses, format français).
 */
trait RejeuScenario
{
    private const EMPREINTES = 'tests/Contrat/empreintes_avant_francisation.json';

    /**
     * Écarts ASSUMÉS avec les empreintes d'origine, un par un : [étape =>
     * [chemin => [texte d'origine, texte actuel]]]. Chacun est vérifié dans les
     * deux sens ; tout autre écart fait échouer le test.
     *
     *  - Laravel compose le message de validation avec le libellé du champ :
     *    `product_id` n'en avait pas (« product id »), `produit_id` en a un.
     *    Ce texte s'affiche tel quel, il n'est jamais interprété.
     */
    private const ECARTS_ASSUMES = [
        'synchronisation hors ligne' => [
            'failed.1.error' => ['Le champ product id est obligatoire.', 'Le champ produit est obligatoire.'],
        ],
    ];

    /**
     * Défauts CORRIGÉS depuis l'enregistrement des empreintes, qui les ont
     * fidèlement enregistrés. Pour chaque étape listée :
     *  - `defaut` vérifie que l'empreinte contient bien le défaut décrit (sinon
     *    la correction est périmée, et le test le dit) ;
     *  - `corrige` déduit de l'empreinte la réponse attendue désormais ; la
     *    réponse obtenue doit l'égaler exactement, comme pour toute étape ;
     *  - `ensuite` (facultatif) joue ce que ferait l'utilisateur juste après.
     *
     * @return array<string, array{defaut: callable, corrige: callable, ensuite?: callable}>
     */
    private function corrections(): array
    {
        /* 02/10/2026 — ABONNEMENTS REFONDUS. La demande « Premium » rendait le
         * compte Premium à l'instant, avec le montant et l'échéance envoyés par
         * le navigateur. Elle est remplacée par la déclaration d'un paiement
         * (référence de transaction) que l'administrateur valide : les routes
         * de l'ancien circuit et les statistiques calculées sur ces montants
         * déclarés disparaissent (404), et le compte de la propriétaire reste
         * sur son plan payé d'origine (Gratuit — l'essai Pro de 30 jours offert
         * à l'inscription lui garde toutes ses fonctionnalités). */
        $routeRetiree = fn (string $adresse) => [
            'defaut' => fn (array $e) => $e['statut'] === 200,
            'corrige' => fn (array $e) => array_replace($e, ['statut' => 404, 'reponse' => [
                'message' => "The route {$adresse} could not be found.",
            ]]),
        ];
        // Ce que la demande Premium avait écrit dans le compte de la propriétaire.
        $sansPremium = fn (array $compte) => array_replace($compte, [
            'plan' => 'Free', 'payment_method' => null, 'expiration' => null,
            'amount' => '0.00', 'upgrade_status' => 'validé',
        ]);
        // Compte créé par l'administrateur : plus de plan choisi à la création
        // (il se change depuis la fiche), et sa boutique principale est créée
        // comme à l'inscription (n° 6 : les n° 1 à 5 sont déjà pris).
        $compteCreeParAdmin = fn (array $compte) => array_replace($compte, [
            'plan' => 'Free', 'payment_method' => null, 'upgrade_status' => 'validé', 'current_boutique_id' => 6,
        ]);

        return [
            'passage premium' => $routeRetiree('api/auth/passage-premium'),
            'passage premium validé' => $routeRetiree('api/admin/passages-premium/2/valider'),
            'passage premium refusé' => $routeRetiree('api/admin/passages-premium/5/refuser'),
            'vue d\'ensemble' => $routeRetiree('api/admin/statistiques/vue-ensemble'),
            'revenus du mois' => $routeRetiree('api/admin/statistiques/revenus'),
            'revenus totaux' => $routeRetiree('api/admin/statistiques/revenus'),
            'évolution des revenus' => $routeRetiree('api/admin/statistiques/revenus/evolution'),
            'transactions' => $routeRetiree('api/admin/statistiques/transactions'),
            'comptes' => $routeRetiree('api/admin/statistiques/comptes'),
            'détail d\'un compte' => $routeRetiree('api/admin/statistiques/comptes/wave'),
            'moi (employé)' => [
                'defaut' => fn (array $e) => $e['reponse']['plan'] === 'Premium',
                'corrige' => fn (array $e) => array_replace($e, ['reponse' => $sansPremium($e['reponse'])]),
            ],
            'utilisateurs' => [
                'defaut' => fn (array $e) => collect($e['reponse'])->firstWhere('id', 2)['plan'] === 'Premium',
                'corrige' => fn (array $e) => array_replace($e, ['reponse' => array_map(
                    fn (array $compte) => $compte['id'] === 2 ? $sansPremium($compte) : $compte, $e['reponse'],
                )]),
            ],
            // La limite vient désormais du plan qui s'applique (essai Pro), et
            // un dépassement de plan répond 402 en désignant le plan suffisant.
            'limite de boutiques' => [
                'defaut' => fn (array $e) => $e['statut'] === 400 && str_contains($e['reponse']['message'], 'Premium'),
                'corrige' => fn (array $e) => array_replace($e, ['statut' => 402, 'reponse' => [
                    'error' => 'Limite atteinte',
                    'code' => 'BOUTIQUE_LIMIT_REACHED',
                    'message' => 'Le plan Pro permet au maximum 3 boutique(s).',
                    'plan_requis' => 'entreprise',
                    'plan_requis_nom' => 'Entreprise',
                ]]),
            ],
            // Le compte créé par l'administrateur recevait le mot de passe
            // « password » : il reçoit un mot de passe provisoire tiré au
            // hasard, montré une fois. La réponse donne le compte complet.
            'utilisateur créé' => [
                'defaut' => fn (array $e) => $e['reponse']['plan'] === 'Premium' && ! array_key_exists('current_boutique_id', $e['reponse']),
                'corrige' => fn (array $e, array $parNom) => array_replace($e, ['reponse' => $compteCreeParAdmin(array_replace(
                    $parNom['utilisateur bloqué']['reponse'],
                    ['status' => 'Actif', 'updated_at' => $parNom['utilisateur bloqué']['reponse']['created_at']],
                )) + ['mot_de_passe_provisoire' => '<MOT_DE_PASSE>']]),
            ],
            'utilisateur bloqué' => [
                'defaut' => fn (array $e) => $e['reponse']['plan'] === 'Premium',
                'corrige' => fn (array $e) => array_replace($e, ['reponse' => $compteCreeParAdmin($e['reponse'])]),
            ],
            'utilisateur réactivé' => [
                'defaut' => fn (array $e) => $e['reponse']['plan'] === 'Premium',
                'corrige' => fn (array $e) => array_replace($e, ['reponse' => $compteCreeParAdmin($e['reponse'])]),
            ],
            // « Rappel envoyé » ne partait nulle part : la relance prépare le
            // message WhatsApp (avec l'indicatif 221) et l'envoie par e-mail.
            'relance' => [
                'defaut' => fn (array $e) => $e['reponse'] === ['message' => 'Rappel envoyé à nouveau@x.sn'],
                'corrige' => function (array $e) {
                    $texte = 'Bonjour Nouveau, votre plan Pro SamaCommerce expire le 15 octobre 2026. '
                        .'Pour continuer sans interruption, renouvelez-le depuis l’application, menu Mon plan (5 000 F). '
                        .'Merci de votre confiance !';

                    return array_replace($e, ['reponse' => [
                        'message' => 'E-mail envoyé. Ouvrez WhatsApp pour envoyer aussi le message.',
                        'texte' => $texte,
                        'lien_whatsapp' => 'https://wa.me/221777778899?text='.rawurlencode($texte),
                        'email_envoye' => true,
                    ]]);
                },
            ],

            // 30/09/2026 — le double facteur s'activait d'un clic, et le code de
            // connexion n'était envoyé nulle part. L'activation envoie désormais
            // un code, et n'aboutit qu'une fois ce code saisi.
            'double facteur activé' => [
                'defaut' => fn (array $e) => $e['reponse'] === ['twofa_enabled' => true],
                'corrige' => fn (array $e) => array_replace($e, ['reponse' => [
                    'twofa_enabled' => false,
                    'code_envoye' => true,
                    'message' => 'Code envoyé par e-mail. Saisissez-le pour activer la vérification en 2 étapes.',
                    'dev_code' => null,
                ]]),
                // L'utilisateur saisit le code reçu : les étapes suivantes
                // éprouvent donc toujours la connexion en deux étapes.
                'ensuite' => function (array $variables, array &$routesJouees) {
                    $code = Mail::sent(CodeParEmail::class)->last(fn ($c) => $c->motif === 'activation')->code;
                    $this->app['auth']->forgetGuards();
                    $this->postJson('/api/auth/double-facteur/confirmer', ['code' => $code], [
                        'Authorization' => 'Bearer '.$variables['jeton_proprio'],
                    ])->assertOk()->assertJson(['double_facteur_actif' => true]);
                    $routesJouees[] = 'POST api/auth/double-facteur/confirmer';
                },
            ],
            // 30/09/2026 — même défaut, vu de la connexion : le code part
            // désormais par e-mail, et la réponse dit s'il a pu partir.
            'connexion avec double facteur' => [
                'defaut' => fn (array $e) => ($e['reponse']['twofa_required'] ?? false) === true && ! isset($e['reponse']['envoye']),
                'corrige' => fn (array $e) => array_replace($e, ['reponse' => [
                    'twofa_required' => true,
                    'username' => $e['reponse']['username'],
                    'envoye' => true,
                    'message' => 'Code envoyé par e-mail. Pensez à regarder vos courriers indésirables.',
                    'dev_code' => null,
                ]]),
            ],
            // 01/10/2026 — le réglage « 2FA » des paramètres d'administration ne
            // protégeait rien (la connexion ne le lisait pas) : retiré, au profit
            // de la vraie vérification en deux étapes du compte.
            'paramètres modifiés' => [
                'defaut' => fn (array $e) => array_key_exists('twofa_enabled', $e['reponse']['settings']),
                'corrige' => function (array $e) {
                    unset($e['reponse']['settings']['twofa_enabled']);

                    return $e;
                },
            ],
            'double facteur admin' => [
                'defaut' => fn (array $e) => $e['reponse'] === ['message' => '2FA mis à jour', 'enabled' => true],
                'corrige' => fn (array $e) => array_replace($e, ['statut' => 404, 'reponse' => [
                    'message' => 'The route api/admin/parametres/double-facteur could not be found.',
                ]]),
            ],
            // 30/09/2026 — `withCount` écrasait les colonnes demandées : la liste
            // des commandes ne portait jamais le nom ni le téléphone du
            // fournisseur (« Sans fournisseur » partout à l'écran).
            'commandes' => [
                'defaut' => fn (array $e) => ! array_key_exists('fournisseur_name', $e['reponse'][0]),
                'corrige' => function (array $e, array $parNom) {
                    $fournisseur = $parNom['commande détaillée']['reponse']['fournisseur'];
                    $e['reponse'] = array_map(function (array $commande) use ($fournisseur) {
                        $connu = $commande['fournisseur_id'] === $fournisseur['id'];
                        $nombre = $commande['items_count'];
                        unset($commande['items_count']);

                        return $commande + [
                            'fournisseur_name' => $connu ? $fournisseur['name'] : null,
                            'fournisseur_phone' => $connu ? $fournisseur['phone'] : null,
                            'items_count' => $nombre,
                        ];
                    }, $e['reponse']);

                    return $e;
                },
            ],
        ];
    }

    /**
     * Réglages de PRODUCTION, imposés pour que les empreintes ne dépendent pas
     * du poste : sans trace de débogage, langue de secours par défaut (elle
     * fournit les libellés de pagination), adresse de base fixe (elle apparaît
     * dans les liens de pagination). Horloge figée, administrateur connu.
     */
    private function preparerLeMonde(): void
    {
        // Les e-mails sont interceptés : on y lit le code que l'utilisateur saisirait.
        Mail::fake();
        config(['app.debug' => false, 'app.url' => 'http://localhost']);
        URL::forceRootUrl('http://localhost');
        $this->app->setLocale('fr');
        $this->app['translator']->setFallback('en');
        $this->travelTo(Carbon::parse('2026-09-15 10:00:00'));
        Utilisateur::create([
            'identifiant' => 'admin@samacommerce.sn', 'mot_de_passe' => Hash::make('MotDePasseAdmin2026'),
            'nom_commerce' => 'Admin', 'role' => 'admin', 'plan' => 'Premium',
        ]);
    }

    /**
     * Rejoue tout le scénario. `$adaptateur` peut réécrire chaque étape avant envoi
     * (adresse, corps, en-têtes) et chaque réponse avant comparaison.
     *
     * @return array{0: array, 1: array} [traces, routes jouées]
     */
    private function rejouer(?object $adaptateur = null): array
    {
        $variables = [];
        $secrets = [];
        $traces = [];
        $routesJouees = [];

        foreach (require base_path('tests/Contrat/scenario_historique.php') as $etape) {
            // Horodatages distincts : ordre de tri stable.
            $this->travel($etape['attendre'] ?? 1)->seconds();
            $traces[] = $this->jouer($etape, $variables, $secrets, $adaptateur);
            if ($route = Route::current()) {
                $routesJouees[] = implode('|', $route->methods()).' '.$route->uri();
            }
            if ($ensuite = $this->corrections()[$etape['nom']]['ensuite'] ?? null) {
                $ensuite($variables, $routesJouees);
            }
        }

        return [$traces, $routesJouees];
    }

    /** Joue une étape et renvoie sa trace normalisée. */
    private function jouer(array $etape, array &$variables, array &$secrets, ?object $adaptateur): array
    {
        $uri = preg_replace_callback('/\{(\w+)\}/', fn ($m) => (string) $variables[$m[1]], $etape['uri']);
        $corps = $this->remplacer($etape['corps'], $variables);

        $entetes = ['Accept' => 'application/json'];
        if ($etape['role'] !== null) {
            $entetes['Authorization'] = 'Bearer '.$variables[$etape['role']];
        }
        $adresseFrancaise = null;
        if ($adaptateur) {
            [$uri, $corps, $entetes, $adresseFrancaise] = $adaptateur->requete($uri, $corps, $entetes);
        }

        // L'application est réutilisée d'une requête à l'autre : sans cet oubli,
        // le garde Sanctum resterait sur le premier utilisateur authentifié.
        $this->app['auth']->forgetGuards();
        $reponse = $this->json($etape['methode'], $uri, $corps, $entetes);

        $brut = $reponse->getContent() === '' ? null : json_decode($reponse->getContent(), true);
        if ($adaptateur && $brut !== null) {
            $brut = $adaptateur->reponse(json_decode($reponse->getContent()), $adresseFrancaise);
        }

        foreach ($etape['garder'] as $nom => $chemin) {
            $variables[$nom] = data_get($brut, $chemin);
            $this->assertNotNull($variables[$nom], "Étape « {$etape['nom']} » : {$chemin} absent de la réponse");
        }
        foreach ($etape['masquer'] as $nom) {
            $secrets[$variables[$nom]] = '<'.mb_strtoupper($nom).'>';
        }

        return [
            'nom' => $etape['nom'],
            'requete' => $etape['methode'].' '.$etape['uri'],
            'statut' => $reponse->getStatusCode(),
            'reponse' => $this->normaliser($brut, $secrets),
        ];
    }

    private function remplacer(mixed $valeur, array $variables): mixed
    {
        if (is_array($valeur)) {
            return array_map(fn ($v) => $this->remplacer($v, $variables), $valeur);
        }
        if (is_string($valeur) && preg_match('/^\{(\w+)\}$/', $valeur, $m)) {
            return $variables[$m[1]];
        }

        return $valeur;
    }

    /** Compare chaque trace à son empreinte, écarts assumés compris. */
    private function comparerAuxEmpreintes(array $obtenu): void
    {
        $attendu = json_decode(file_get_contents(base_path(self::EMPREINTES)), true);
        $this->assertCount(count($attendu), $obtenu, 'Nombre d\'étapes du scénario');
        $parNom = array_column($attendu, null, 'nom');
        $corrections = $this->corrections();

        foreach ($attendu as $i => $empreinte) {
            // Les règles de normalisation sont idempotentes : on les réapplique
            // aux empreintes, pour qu'une règle ajoutée après coup vaille aussi.
            $empreinte['reponse'] = $this->normaliser($empreinte['reponse'], []);
            if ($correction = $corrections[$empreinte['nom']] ?? null) {
                $this->assertTrue(($correction['defaut'])($empreinte), "Correction périmée : « {$empreinte['nom']} »");
                $empreinte = ($correction['corrige'])($empreinte, $parNom);
            }
            foreach (self::ECARTS_ASSUMES[$empreinte['nom']] ?? [] as $chemin => [$avant, $apres]) {
                $this->assertSame($avant, data_get($empreinte['reponse'], $chemin), "Écart assumé périmé : {$chemin}");
                $this->assertSame($apres, data_get($obtenu[$i]['reponse'], $chemin), "Écart assumé : {$chemin}");
                data_set($obtenu[$i]['reponse'], $chemin, $avant);
            }
            $this->assertSame($empreinte, $obtenu[$i], "Étape {$i} « {$empreinte['nom']} »");
        }
    }

    /**
     * Efface ce qui change d'une exécution à l'autre sans rien dire du contrat :
     * jetons aléatoires, latences, numéro de version, dates posées par la base
     * elle-même, et le nom de classe PHP que Laravel glisse dans ses messages
     * 404 (il change forcément avec la traduction des modèles).
     */
    private function normaliser(mixed $valeur, array $secrets): mixed
    {
        if (is_array($valeur)) {
            $resultat = [];
            foreach ($valeur as $cle => $v) {
                $resultat[$cle] = match (true) {
                    in_array($cle, ['latency_ms', 'latence_ms'], true) => '<N>',
                    // Numéro de version de l'API : change à chaque livraison, par nature.
                    $cle === 'version' => '<VERSION>',
                    // Posée par la base (CURRENT_TIMESTAMP), hors de l'horloge figée.
                    in_array($cle, ['created_date', 'date_creation'], true) => '<HORLOGE_BASE>',
                    // Tiré au hasard à chaque création de compte par l'administrateur.
                    $cle === 'mot_de_passe_provisoire' => '<MOT_DE_PASSE>',
                    default => $this->normaliser($v, $secrets),
                };
            }

            return $resultat;
        }
        if (! is_string($valeur)) {
            return $valeur;
        }
        if (preg_match('/^\d+\|[A-Za-z0-9]{40,}$/', $valeur)) {
            return '<JETON>';
        }
        if (str_starts_with($valeur, 'No query results for model')) {
            return '<INTROUVABLE>';
        }

        return strtr($valeur, $secrets);
    }

    /**
     * Toute route du genre demandé doit avoir été jouée, sauf exception motivée.
     *
     * @param  callable(\Illuminate\Routing\Route): bool  $concernee
     */
    private function verifierCouverture(array $routesJouees, callable $concernee, array $nonJouees = []): void
    {
        $manquantes = collect(Route::getRoutes()->getRoutes())
            ->filter(fn ($r) => str_starts_with($r->uri(), 'api/') && ! str_starts_with($r->uri(), 'api/v1/'))
            ->filter($concernee)
            ->map(fn ($r) => implode('|', $r->methods()).' '.$r->uri())
            ->reject(fn ($r) => in_array($r, $routesJouees, true) || in_array($r, $nonJouees, true))
            ->values()->all();

        $this->assertSame([], $manquantes, 'Routes absentes du scénario');
    }
}
