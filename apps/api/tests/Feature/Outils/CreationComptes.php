<?php

namespace Tests\Feature\Outils;

use App\Models\MembreBoutique;
use App\Models\Utilisateur;

/**
 * Outils de test : créer des commerçants (par la route d'inscription, qui crée
 * aussi la boutique principale et le jeton) et des employés (adhésion acceptée).
 */
trait CreationComptes
{
    /** Inscrit un commerçant et renvoie [Utilisateur, jeton]. */
    protected function inscrireCommercant(string $identifiant = 'proprietaire@test.sn', string $boutique = 'Boutique Test'): array
    {
        $reponse = $this->postJson('/api/auth/inscription', [
            'identifiant' => $identifiant,
            'mot_de_passe' => 'Password123',
            'nom_commerce' => $boutique,
        ])->assertCreated();

        return [Utilisateur::where('identifiant', $identifiant)->firstOrFail(), $reponse->json('jeton')];
    }

    /** Crée un employé rattaché au propriétaire, renvoie [Utilisateur, jeton]. */
    protected function creerEmploye(Utilisateur $proprietaire, array $permissions, string $identifiant = 'employe@test.sn'): array
    {
        [$employe, $jeton] = $this->inscrireCommercant($identifiant, 'Perso');

        MembreBoutique::create([
            'proprietaire_id' => $proprietaire->id,
            'boutique_rattachement_id' => $proprietaire->boutique_active_id,
            'membre_id' => $employe->id,
            'email' => $identifiant,
            'role' => 'employe',
            'statut' => 'acceptee',
            'permissions' => $permissions,
            'acceptee_le' => now(),
        ]);

        return [$employe, $jeton];
    }

    /**
     * En-têtes d'une requête authentifiée.
     *
     * On oublie les gardes résolus avant chaque requête : en test, l'application
     * est réutilisée entre les appels HTTP et le garde Sanctum garderait sinon
     * en mémoire le PREMIER utilisateur authentifié (en production, chaque
     * requête est un processus neuf : non concerné).
     */
    protected function entetes(string $jeton): array
    {
        $this->app['auth']->forgetGuards();

        return ['Authorization' => 'Bearer '.$jeton, 'Accept' => 'application/json'];
    }
}
