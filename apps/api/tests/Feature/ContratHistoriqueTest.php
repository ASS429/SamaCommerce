<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

/**
 * Le contrat d'API tel qu'il était AVANT la francisation.
 *
 * POURQUOI. Pendant la transition, des téléphones continueront d'appeler les
 * anciennes routes avec les anciens noms de champs — dont la file des ventes
 * faites hors ligne. Ce test rejoue un scénario qui touche chaque route et
 * compare chaque réponse, statut compris, aux empreintes enregistrées sur le
 * code d'origine. Un seul écart, et un téléphone resté sur l'ancienne version
 * risquerait de mal afficher ou de perdre une vente.
 *
 * Pour réenregistrer les empreintes (uniquement sur le code d'origine, tag
 * `avant-francisation`) : ENREGISTRER_CONTRAT=1 php artisan test --filter=ContratHistorique
 */
class ContratHistoriqueTest extends TestCase
{
    use RefreshDatabase;

    private const EMPREINTES = 'tests/Contrat/empreintes_avant_francisation.json';

    /** Routes volontairement hors scénario, avec la raison. */
    private const NON_JOUEES = [
        // Le code reçu par e-mail est haché en base : impossible à connaître
        // depuis un test boîte noire. Le cas d'échec est joué, le succès est
        // couvert par MotDePasseOublieTest.
    ];

    public function test_chaque_route_repond_comme_avant_la_francisation(): void
    {
        // Réponses de production : sans trace de débogage (chemins de fichiers).
        config(['app.debug' => false]);
        $this->travelTo(Carbon::parse('2026-09-15 10:00:00'));
        User::create([
            'username' => 'admin@samacommerce.sn', 'password' => Hash::make('MotDePasseAdmin2026'),
            'company_name' => 'Admin', 'role' => 'admin', 'plan' => 'Premium',
        ]);

        $variables = [];
        $secrets = [];
        $obtenu = [];
        $routesJouees = [];

        foreach (require base_path('tests/Contrat/scenario_historique.php') as $etape) {
            // Horodatages distincts : ordre de tri stable.
            $this->travel($etape['attendre'] ?? 1)->seconds();
            $obtenu[] = $this->jouer($etape, $variables, $secrets);
            if ($route = Route::current()) {
                $routesJouees[] = implode('|', $route->methods()).' '.$route->uri();
            }
        }

        $this->verifierCouverture($routesJouees);

        if (getenv('ENREGISTRER_CONTRAT')) {
            file_put_contents(
                base_path(self::EMPREINTES),
                json_encode($obtenu, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)."\n",
            );
            $this->markTestIncomplete(count($obtenu).' empreintes enregistrées : relancer sans ENREGISTRER_CONTRAT.');
        }

        $attendu = json_decode(file_get_contents(base_path(self::EMPREINTES)), true);
        $this->assertCount(count($attendu), $obtenu, 'Nombre d\'étapes du scénario');
        foreach ($attendu as $i => $empreinte) {
            $this->assertSame($empreinte, $obtenu[$i], "Étape {$i} « {$empreinte['nom']} »");
        }
    }

    /** Joue une étape et renvoie sa trace normalisée. */
    private function jouer(array $etape, array &$variables, array &$secrets): array
    {
        $uri = preg_replace_callback('/\{(\w+)\}/', fn ($m) => (string) $variables[$m[1]], $etape['uri']);
        $corps = $this->remplacer($etape['corps'], $variables);

        $entetes = ['Accept' => 'application/json'];
        if ($etape['role'] !== null) {
            $entetes['Authorization'] = 'Bearer '.$variables[$etape['role']];
        }

        // L'application est réutilisée d'une requête à l'autre : sans cet oubli,
        // le garde Sanctum resterait sur le premier utilisateur authentifié.
        $this->app['auth']->forgetGuards();
        $reponse = $this->json($etape['methode'], $uri, $corps, $entetes);

        $brut = $reponse->getContent() === '' ? null : json_decode($reponse->getContent(), true);
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

    /**
     * Efface ce qui change d'une exécution à l'autre sans rien dire du contrat :
     * jetons aléatoires, latences, dates posées par la base elle-même, et le
     * nom de classe PHP que Laravel glisse
     * dans ses messages 404 (il change forcément avec la traduction des modèles).
     */
    private function normaliser(mixed $valeur, array $secrets): mixed
    {
        if (is_array($valeur)) {
            $resultat = [];
            foreach ($valeur as $cle => $v) {
                $resultat[$cle] = match (true) {
                    in_array($cle, ['latency_ms', 'latence_ms'], true) => '<N>',
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

    /** Toute route de l'API doit être jouée, sauf exception motivée. */
    private function verifierCouverture(array $routesJouees): void
    {
        $manquantes = collect(Route::getRoutes()->getRoutes())
            ->filter(fn ($r) => str_starts_with($r->uri(), 'api/') && ! str_starts_with($r->uri(), 'api/v1/'))
            ->map(fn ($r) => implode('|', $r->methods()).' '.$r->uri())
            ->reject(fn ($r) => in_array($r, $routesJouees, true) || in_array($r, self::NON_JOUEES, true))
            ->values()->all();

        $this->assertSame([], $manquantes, 'Routes absentes du scénario');
    }
}
