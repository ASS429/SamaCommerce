<?php

namespace App\Services;

use App\Mail\RappelAbonnement;
use App\Models\ReglagesAbonnement;
use App\Models\Utilisateur;
use App\Support\Telephone;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/**
 * Rappels d'échéance : 7 jours avant, la veille, le jour même, pendant le
 * délai de grâce (selon les réglages).
 *
 * Par e-mail, ils partent seuls (une fois par jour, au premier réveil de
 * l'API par cron-job.org : l'hébergement gratuit n'a pas de tâche planifiée).
 * Par WhatsApp, le message est préparé : l'administrateur l'envoie d'un clic
 * depuis la fiche du commerçant.
 */
final class RappelsAbonnement
{
    /** Texte de relance, à partir du modèle des réglages. */
    public static function texte(Utilisateur $compte, ?EtatAbonnement $etat = null): string
    {
        $etat ??= Abonnements::etat($compte);
        $reglages = ReglagesAbonnement::courants();
        $plan = $etat->planPaye ?? $etat->planEssai ?? $etat->planExpire ?? $etat->plan;
        $echeance = $etat->finLe ?? $etat->essaiJusquAu ?? $etat->expireLe;
        $montant = Abonnements::montantAttendu($plan->estPayant() ? $plan : \App\Models\Plan::parCode('essentiel'), 'mois');
        $nom = $compte->nom_commerce ?: $compte->identifiant;

        return strtr($reglages->message_relance ?: 'Bonjour {nom}, votre plan {plan} SamaCommerce expire le {date}.', [
            '{nom}' => $nom,
            '{prénom}' => $nom,
            '{plan}' => $plan->nom,
            '{date}' => $echeance ? self::dateLongue($echeance) : 'bientôt',
            '{montant}' => number_format($montant, 0, ',', ' ').' F',
        ]);
    }

    public static function lienWhatsApp(Utilisateur $compte, ?EtatAbonnement $etat = null): ?string
    {
        return Telephone::lienWhatsApp($compte->telephone, self::texte($compte, $etat));
    }

    public static function dateLongue(Carbon $date): string
    {
        $mois = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

        return ($date->day === 1 ? '1er' : $date->day).' '.$mois[$date->month - 1].' '.$date->year;
    }

    /** Envoie les rappels du jour par e-mail. Renvoie le nombre de messages partis. */
    public static function envoyerCeuxDuJour(?Carbon $jour = null): int
    {
        $jour = ($jour ?? Carbon::today())->copy()->startOfDay();
        $reglages = ReglagesAbonnement::courants();
        $types = $reglages->rappels ?? [];
        if ($types === []) {
            return 0;
        }

        $comptes = Utilisateur::query()
            ->where('role', '!=', 'admin')
            ->where('statut', '!=', 'Bloqué')
            ->whereNotNull('expiration')
            ->whereBetween('expiration', [$jour->copy()->subDays($reglages->delai_grace_jours), $jour->copy()->addDays(7)])
            ->get();

        $envoyes = 0;
        foreach ($comptes as $compte) {
            $etat = Abonnements::etat($compte, $jour);
            if (! $etat->planPaye || ! $etat->finLe) {
                continue;
            }
            $ecart = (int) $jour->diffInDays($etat->finLe, false);
            $type = match (true) {
                $ecart === 7 => 'j-7',
                $ecart === 1 => 'j-1',
                $ecart === 0 => 'j0',
                $ecart < 0 => 'grace',
                default => null,
            };
            if ($type === null || ! in_array($type, $types, true) || ! filter_var($compte->identifiant, FILTER_VALIDATE_EMAIL)) {
                continue;
            }

            $cle = ['utilisateur_id' => $compte->id, 'type' => $type, 'echeance' => $etat->finLe->toDateString()];
            if (DB::table('rappels_abonnement')->where($cle)->exists()) {
                continue;
            }

            try {
                Mail::to($compte->identifiant)->send(new RappelAbonnement(self::texte($compte, $etat), $etat->planPaye->nom, self::dateLongue($etat->finLe)));
                DB::table('rappels_abonnement')->insert($cle + ['cree_le' => Carbon::now(), 'modifie_le' => Carbon::now()]);
                $envoyes++;
            } catch (\Throwable $e) {
                Log::warning('[rappels] envoi impossible', ['utilisateur_id' => $compte->id, 'cause' => $e->getMessage()]);
            }
        }

        return $envoyes;
    }
}
