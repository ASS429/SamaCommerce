<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * Verrouille le compte administrateur au demarrage.
 *
 * PROBLEME RESOLU. Le seeder de demonstration creait
 * `admin@samacommerce.sn` avec le mot de passe « password », et ces
 * identifiants figurent dans un depot GitHub PUBLIC. N'importe qui pouvait
 * donc ouvrir le panneau d'administration en production : lister tous les
 * commercants (nom, telephone, paiements), en bloquer un, en supprimer un.
 *
 * DEUX COMPORTEMENTS, et le second est le plus important :
 *  - `ADMIN_PASSWORD` renseigne  -> le compte prend CE mot de passe ;
 *  - `ADMIN_PASSWORD` absent     -> le compte est NEUTRALISE (mot de passe
 *    aleatoire que personne ne connait). Oublier de definir la variable ne doit
 *    JAMAIS laisser la porte publique ouverte : en cas de doute, on ferme.
 *
 * Idempotent : appele a chaque demarrage du conteneur (start.sh).
 */
class SecureAdmin extends Command
{
    protected $signature = 'admin:secure';

    protected $description = "Applique ADMIN_PASSWORD au compte admin, ou le neutralise si la variable est absente";

    /** Longueur minimale exigee : un panneau d'admin merite mieux que 8 signes. */
    private const MIN = 12;

    public function handle(): int
    {
        $admin = User::where('role', 'admin')->first();
        if (! $admin) {
            $this->info('Aucun compte administrateur — rien a faire.');

            return self::SUCCESS;
        }

        $mdp = trim((string) env('ADMIN_PASSWORD', ''));

        if ($mdp === '') {
            // Neutralisation : le compte existe toujours (les eventuelles
            // references en base restent valides) mais devient inaccessible.
            $admin->forceFill(['password' => Hash::make(Str::random(48))])->save();
            $this->warn('ADMIN_PASSWORD absent : compte administrateur NEUTRALISE.');
            $this->warn('Definissez ADMIN_PASSWORD dans Render pour pouvoir vous connecter.');

            return self::SUCCESS;
        }

        if (strlen($mdp) < self::MIN) {
            // On ne rabaisse pas la securite parce que la variable est mauvaise.
            $admin->forceFill(['password' => Hash::make(Str::random(48))])->save();
            $this->error('ADMIN_PASSWORD trop court ('.strlen($mdp).' < '.self::MIN.') : compte NEUTRALISE.');

            return self::FAILURE;
        }

        $admin->forceFill(['password' => Hash::make($mdp)])->save();
        $this->info('Mot de passe administrateur applique ('.$admin->username.').');

        return self::SUCCESS;
    }
}
