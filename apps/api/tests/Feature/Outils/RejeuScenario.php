<?php

namespace Tests\Feature\Outils;

use App\Models\Utilisateur;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;
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
     * Réglages de PRODUCTION, imposés pour que les empreintes ne dépendent pas
     * du poste : sans trace de débogage, langue de secours par défaut (elle
     * fournit les libellés de pagination), adresse de base fixe (elle apparaît
     * dans les liens de pagination). Horloge figée, administrateur connu.
     */
    private function preparerLeMonde(): void
    {
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

        foreach ($attendu as $i => $empreinte) {
            // Les règles de normalisation sont idempotentes : on les réapplique
            // aux empreintes, pour qu'une règle ajoutée après coup vaille aussi.
            $empreinte['reponse'] = $this->normaliser($empreinte['reponse'], []);
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
