<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Contrat\AncienContrat;
use Tests\Contrat\Traducteur;
use Tests\Feature\Outils\RejeuScenario;
use Tests\TestCase;

/**
 * Le contrat FRANÇAIS dit exactement la même chose que l'ancien.
 *
 * Le scénario enregistré sur l'API d'origine (avant la francisation) est
 * rejoué sur les adresses FRANÇAISES, avec les noms de champs français, grâce
 * à l'archive de l'ancien contrat (tests/Contrat). Chaque réponse, retraduite,
 * doit égaler l'empreinte
 * enregistrée avant la francisation : mêmes statuts, mêmes valeurs, mêmes
 * identifiants. C'est la preuve que la nouvelle API est complète — aucune
 * route perdue, aucune règle métier modifiée par la traduction.
 */
class ContratFrancaisTest extends TestCase
{
    use RefreshDatabase;
    use RejeuScenario;

    /**
     * Routes françaises hors scénario, avec la raison.
     *
     * Abonnements (octobre 2026) : routes nées APRÈS l'enregistrement des
     * empreintes, donc absentes du scénario historique. Elles sont éprouvées
     * par AbonnementCommercantTest et AbonnementAdminTest.
     */
    private const NON_JOUEES = [
        'GET|HEAD api/abonnement',
        'GET|HEAD api/abonnement/paiements',
        'POST api/abonnement/paiements',
        'GET|HEAD api/admin/tableau-de-bord',
        'GET|HEAD api/admin/commercants',
        'GET|HEAD api/admin/commercants/{id}',
        'POST api/admin/commercants/{id}/offrir',
        'POST api/admin/commercants/{id}/plan',
        'GET|HEAD api/admin/paiements',
        'GET|HEAD api/admin/paiements/{id}',
        'POST api/admin/paiements/{id}/valider',
        'POST api/admin/paiements/{id}/refuser',
        'POST api/admin/paiements/{id}/annuler',
        'GET|HEAD api/admin/plans',
        'PUT api/admin/plans/{code}',
        'GET|HEAD api/admin/reglages',
        'PUT api/admin/reglages',
        'GET|HEAD api/admin/finances',
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
                    $entetes,
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
