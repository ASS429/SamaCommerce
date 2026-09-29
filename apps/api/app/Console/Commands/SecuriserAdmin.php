<?php

namespace App\Console\Commands;

use App\Models\Utilisateur;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * Verrouille le compte administrateur au démarrage.
 *
 * PROBLÈME RÉSOLU. Le jeu de démonstration créait `admin@samacommerce.sn`
 * avec le mot de passe « password », et ces identifiants figurent dans un
 * dépôt GitHub PUBLIC. N'importe qui pouvait donc ouvrir le panneau
 * d'administration en production : lister tous les commerçants (nom,
 * téléphone, paiements), en bloquer un, en supprimer un.
 *
 * DEUX COMPORTEMENTS, et le second est le plus important :
 *  - `ADMIN_PASSWORD` renseigné  -> le compte prend CE mot de passe ;
 *  - `ADMIN_PASSWORD` absent     -> le compte est NEUTRALISÉ (mot de passe
 *    aléatoire que personne ne connaît). Oublier de définir la variable ne doit
 *    JAMAIS laisser la porte publique ouverte : en cas de doute, on ferme.
 *
 * (Le nom de la variable reste en anglais : c'est un secret défini à la main
 * dans Render, décision du 29/09/2026.)
 *
 * Idempotente : appelée à chaque démarrage du conteneur (demarrer.sh).
 */
class SecuriserAdmin extends Command
{
    protected $signature = 'admin:securiser';

    protected $description = "Applique ADMIN_PASSWORD au compte admin, ou le neutralise si la variable est absente";

    /** Longueur minimale exigée : un panneau d'administration mérite mieux que 8 signes. */
    private const MINIMUM = 12;

    public function handle(): int
    {
        $admin = Utilisateur::where('role', 'admin')->first();
        if (! $admin) {
            $this->info('Aucun compte administrateur — rien à faire.');

            return self::SUCCESS;
        }

        $motDePasse = trim((string) env('ADMIN_PASSWORD', ''));

        if ($motDePasse === '') {
            // Neutralisation : le compte existe toujours (les éventuelles
            // références en base restent valides) mais devient inaccessible.
            $admin->forceFill(['mot_de_passe' => Hash::make(Str::random(48))])->save();
            $this->warn('ADMIN_PASSWORD absent : compte administrateur NEUTRALISÉ.');
            $this->warn('Définissez ADMIN_PASSWORD dans Render pour pouvoir vous connecter.');

            return self::SUCCESS;
        }

        if (strlen($motDePasse) < self::MINIMUM) {
            // On ne rabaisse pas la sécurité parce que la variable est mauvaise.
            $admin->forceFill(['mot_de_passe' => Hash::make(Str::random(48))])->save();
            $this->error('ADMIN_PASSWORD trop court ('.strlen($motDePasse).' < '.self::MINIMUM.') : compte NEUTRALISÉ.');

            return self::FAILURE;
        }

        $admin->forceFill(['mot_de_passe' => Hash::make($motDePasse)])->save();
        $this->info('Mot de passe administrateur appliqué ('.$admin->identifiant.').');

        return self::SUCCESS;
    }
}
