<?php

namespace Tests\Feature;

use App\Compatibilite\AncienContrat;
use App\Compatibilite\Traducteur;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Outils\RejeuScenario;
use Tests\TestCase;

/**
 * Le contrat FRANÇAIS dit exactement la même chose que l'ancien.
 *
 * Le même scénario que ContratHistoriqueTest est rejoué, mais sur les
 * NOUVELLES adresses, avec les noms de champs français et l'en-tête de la
 * nouvelle application. Chaque réponse, retraduite, doit égaler l'empreinte
 * enregistrée avant la francisation : mêmes statuts, mêmes valeurs, mêmes
 * identifiants. C'est la preuve que la nouvelle API est complète — aucune
 * route perdue, aucune règle métier modifiée par la traduction.
 */
class ContratFrancaisTest extends TestCase
{
    use RefreshDatabase;
    use RejeuScenario;

    /** Routes françaises hors scénario, avec la raison. */
    private const NON_JOUEES = [
        // Apparue avec la francisation (pas d'équivalent dans l'ancien
        // scénario) : couverte par CompatibiliteTest.
        'GET|HEAD api/sante/compatibilite',
    ];

    public function test_chaque_route_francaise_repond_comme_l_ancienne(): void
    {
        $this->preparerLeMonde();

        [$traces, $routesJouees] = $this->rejouer(new class
        {
            /** Nouvelle adresse => ancienne, pour les liens de pagination de la réponse. */
            private array $liens = [];

            /** Ancienne adresse + ancien corps → nouvelle adresse + corps français. */
            public function requete(string $uri, array $corps, array $entetes): array
            {
                $morceaux = parse_url($uri);
                $chemin = substr($morceaux['path'], strlen('/api/'));
                $version = str_starts_with($chemin, 'v1/') ? 'v1/' : '';
                [$adresse, $modele] = $this->traduireChemin(substr($chemin, strlen($version)));
                $this->liens = ['/api/'.$version.$adresse => $morceaux['path']];

                $requete = '';
                if (isset($morceaux['query'])) {
                    parse_str($morceaux['query'], $parametres);
                    $requete = '?'.http_build_query(Traducteur::entree($parametres));
                }

                return [
                    '/api/'.$version.$adresse.$requete,
                    Traducteur::entree($corps),
                    $entetes + [AncienContrat::ENTETE => 'fr'],
                    $modele,
                ];
            }

            /**
             * Réponse française → ancien format, pour la comparer à l'empreinte.
             * Les liens de pagination portent l'adresse DEMANDÉE (la nouvelle) :
             * on y remet l'ancienne, seule différence attendue.
             */
            public function reponse(mixed $donnees, ?string $modele): array
            {
                $json = json_encode(Traducteur::sortie($donnees, (string) $modele), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

                return json_decode(strtr($json, $this->liens), true);
            }

            /**
             * Trouve l'ancienne adresse qui correspond (littérale d'abord, sinon
             * avec paramètres) et renvoie [nouvelle adresse, son modèle].
             */
            private function traduireChemin(string $chemin): array
            {
                if (isset(AncienContrat::ADRESSES[$chemin])) {
                    return [AncienContrat::ADRESSES[$chemin], AncienContrat::ADRESSES[$chemin]];
                }
                foreach (AncienContrat::ADRESSES as $ancien => $nouveau) {
                    $motif = '#^'.preg_replace('/\\\\\{\w+\\\\\}/', '([^/]+)', preg_quote($ancien, '#')).'$#';
                    if (str_contains($ancien, '{') && preg_match($motif, $chemin, $valeurs)) {
                        array_shift($valeurs);
                        $adresse = preg_replace_callback('/\{\w+\}/', function () use (&$valeurs) {
                            return array_shift($valeurs);
                        }, $nouveau);

                        return [$adresse, $nouveau];
                    }
                }
                throw new \RuntimeException("Aucune nouvelle adresse pour « {$chemin} »");
            }
        });

        // Toute route FRANÇAISE (uniquement française, ou partagée) doit être jouée.
        $this->verifierCouverture(
            $routesJouees,
            fn ($r) => in_array($r->getAction('contrat'), [null, 'partage'], true),
            self::NON_JOUEES,
        );
        $this->comparerAuxEmpreintes($traces);
    }
}
