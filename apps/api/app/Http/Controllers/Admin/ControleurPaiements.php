<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\ControleurAbonnement;
use App\Http\Controllers\Controleur;
use App\Models\PaiementAbonnement;
use App\Services\Abonnements;
use App\Services\RappelsAbonnement;
use App\Support\Telephone;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

/**
 * File « Paiements à vérifier » : l'administrateur compare chaque déclaration
 * à l'historique de son compte Wave ou Orange Money, puis valide ou refuse.
 */
class ControleurPaiements extends Controleur
{
    public function lister(Request $requete)
    {
        $statut = in_array($requete->query('statut'), ['valide', 'refuse'], true) ? $requete->query('statut') : 'en_attente';

        $requeteBase = PaiementAbonnement::leger()->with('utilisateur')->where('statut', $statut);
        // À vérifier : les plus anciens d'abord (premier arrivé, premier servi).
        $paiements = $statut === 'en_attente'
            ? $requeteBase->orderBy('cree_le')->limit(200)->get()
            : $requeteBase->where('origine', '!=', 'reprise')->orderByDesc('decide_le')->limit(100)->get();

        return response()->json([
            'paiements' => $paiements->map(fn (PaiementAbonnement $p) => $this->detail($p))->values(),
            'compteurs' => [
                'en_attente' => PaiementAbonnement::where('statut', 'en_attente')->count(),
            ],
        ]);
    }

    public function afficher(int $id)
    {
        $paiement = PaiementAbonnement::with('utilisateur')->findOrFail($id);

        return response()->json($this->detail($paiement) + ['capture' => $paiement->capture]);
    }

    public function valider(Request $requete, int $id)
    {
        // La case « j'ai retrouvé ce paiement » n'est pas qu'une décoration :
        // l'API refuse une validation qui ne l'affirme pas.
        $requete->validate(['verifie' => ['accepted']], [
            'verifie.accepted' => 'Confirmez avoir retrouvé ce paiement dans votre application avant de valider.',
        ]);
        $paiement = Abonnements::valider(PaiementAbonnement::findOrFail($id), $requete->user());

        return response()->json([
            'message' => 'Paiement validé.',
            'paiement' => $this->detail($paiement->load('utilisateur')),
        ]);
    }

    public function refuser(Request $requete, int $id)
    {
        $donnees = $requete->validate(['motif' => ['required', 'string', 'max:120']]);
        $paiement = Abonnements::refuser(PaiementAbonnement::findOrFail($id), $requete->user(), $donnees['motif']);

        return response()->json([
            'message' => 'Paiement refusé. Le commerçant voit le motif.',
            'paiement' => $this->detail($paiement->load('utilisateur')),
        ]);
    }

    public function annuler(int $id)
    {
        $paiement = Abonnements::annulerDecision(PaiementAbonnement::findOrFail($id));

        return response()->json([
            'message' => 'Décision annulée : le paiement est de nouveau à vérifier.',
            'paiement' => $this->detail($paiement->load('utilisateur')),
        ]);
    }

    /** Déclaration + commerçant + contrôles automatiques + effet d'une validation. */
    private function detail(PaiementAbonnement $p): array
    {
        $compte = $p->utilisateur;
        $etat = Abonnements::etat($compte);
        $referenceReutilisee = PaiementAbonnement::referenceDejaUtilisee($p->moyen, $p->reference_cle, $p->id);

        $effet = null;
        if ($p->statut === 'en_attente') {
            [$debut, $fin] = Abonnements::periodePour($compte, $p->plan(), $p->periode);
            $effet = [
                'debut_le' => $debut->toDateString(),
                'fin_le' => $fin->toDateString(),
                'texte' => $p->plan()->nom.' actif jusqu’au '.RappelsAbonnement::dateLongue($fin),
                'explication' => match (true) {
                    $debut->gt(Carbon::today()) && $etat->source === 'essai' => 'La période payée commence à la fin de l’essai : aucun jour perdu.',
                    $debut->gt(Carbon::today()) => 'La nouvelle période s’ajoute à l’échéance actuelle : aucun jour perdu.',
                    $debut->lt(Carbon::today()) => 'La période reprend à l’échéance passée : les jours de grâce utilisés comptent.',
                    default => 'La période commence le jour de la validation.',
                },
            ];
        }

        return ControleurAbonnement::paiementPublic($p) + [
            'commercant' => [
                'id' => $compte->id,
                'nom_commerce' => $compte->nom_commerce,
                'identifiant' => $compte->identifiant,
                'telephone' => $compte->telephone,
                'cree_le' => $compte->cree_le?->toIso8601String(),
                'plan_actuel' => self::descriptionEtat($etat),
                'lien_whatsapp' => Telephone::lienWhatsApp($compte->telephone, 'Bonjour, à propos de votre paiement SamaCommerce ('.$p->libelleFormule().') : '),
            ],
            'controles' => [
                'montant_conforme' => $p->montant_declare === $p->montant_attendu,
                'ecart' => $p->montant_declare - $p->montant_attendu,
                'reference_reutilisee' => $referenceReutilisee,
                'numero_du_compte' => Telephone::memeNumero($p->numero_payeur, $compte->telephone),
            ],
            'effet' => $effet,
        ];
    }

    /** « Essai Pro, jusqu'au 24 octobre » — ce que l'administrateur doit savoir d'un coup d'œil. */
    public static function descriptionEtat(\App\Services\EtatAbonnement $etat): string
    {
        $date = fn (?Carbon $d) => $d ? RappelsAbonnement::dateLongue($d) : '';

        return match ($etat->source) {
            'essai' => "Essai {$etat->plan->nom}, jusqu’au {$date($etat->essaiJusquAu)}",
            'paye' => "{$etat->plan->nom}, jusqu’au {$date($etat->finLe)}",
            'grace' => "{$etat->plan->nom} expiré le {$date($etat->finLe)} (délai de grâce)",
            'admin' => 'Administrateur',
            default => $etat->planExpire ? "Gratuit (plan {$etat->planExpire->nom} expiré)" : 'Gratuit',
        };
    }
}
