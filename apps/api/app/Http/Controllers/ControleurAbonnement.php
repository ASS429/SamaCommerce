<?php

namespace App\Http\Controllers;

use App\Models\PaiementAbonnement;
use App\Models\Plan;
use App\Models\ReglagesAbonnement;
use App\Services\Abonnements;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Côté commerçant : « Mon plan » (état, plans, où payer) et déclaration d'un
 * paiement. Le montant attendu est calculé ICI, jamais pris du navigateur, et
 * rien ne s'active avant la validation de l'administrateur.
 */
class ControleurAbonnement extends Controleur
{
    /** Photo du SMS de confirmation : data URL compressée par l'appareil (≤ 200 Ko). */
    public const REGLES_CAPTURE = [
        'nullable', 'string', 'max:204800',
        'regex:/^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+\/]++={0,2}$/',
    ];

    /** GET /abonnement — tout l'écran « Mon plan » en une requête. */
    public function etat(Request $requete)
    {
        $proprietaire = $requete->user();
        $reglages = ReglagesAbonnement::courants();

        $enAttente = PaiementAbonnement::leger()->where('utilisateur_id', $proprietaire->id)
            ->where('statut', 'en_attente')->latest('cree_le')->first();
        // Un refus récent s'affiche (avec son motif) tant qu'aucune nouvelle
        // déclaration ne l'a remplacé : le commerçant doit savoir quoi corriger.
        $dernier = PaiementAbonnement::leger()->where('utilisateur_id', $proprietaire->id)
            ->where('origine', 'declaration')->latest('cree_le')->first();
        $refus = $dernier && $dernier->statut === 'refuse' && $dernier->decide_le?->gte(Carbon::now()->subDays(7)) ? $dernier : null;

        return response()->json([
            'etat' => Abonnements::versTableau(Abonnements::etat($proprietaire)),
            'utilisation' => Abonnements::utilisation($proprietaire),
            'plans' => array_values(array_map(fn (Plan $p) => Abonnements::planPublic($p), Plan::catalogue())),
            'paiement' => [
                'numero_wave' => $reglages->numero_wave,
                'numero_orange' => $reglages->numero_orange,
                'nom_beneficiaire' => $reglages->nom_beneficiaire,
                'reference_obligatoire' => $reglages->reference_obligatoire,
                'capture_autorisee' => $reglages->capture_autorisee,
                'mois_offerts_annuel' => $reglages->mois_offerts_annuel,
            ],
            'en_attente' => $enAttente ? self::paiementPublic($enAttente) : null,
            'dernier_refus' => $refus ? self::paiementPublic($refus) : null,
            'peut_payer' => ! $requete->attributes->get('est_employe', false),
        ]);
    }

    /** POST /abonnement/paiements — « J'ai payé : voici la référence ». */
    public function declarer(Request $requete)
    {
        if ($requete->attributes->get('est_employe', false)) {
            return response()->json([
                'erreur' => 'Accès refusé',
                'message' => 'Seul le propriétaire de la boutique peut payer l’abonnement.',
            ], 403);
        }

        $reglages = ReglagesAbonnement::courants();
        $declarables = collect(Plan::catalogue())->filter(fn (Plan $p) => $p->estPayant() && ! $p->sur_devis)->keys()->all();
        $donnees = $requete->validate([
            'plan' => ['required', Rule::in($declarables)],
            'periode' => ['required', 'in:mois,an'],
            'moyen' => ['required', 'in:wave,orange'],
            'numero_payeur' => ['required', 'string', 'max:32', 'regex:/^[0-9 +().-]{7,32}$/'],
            'reference' => [$reglages->reference_obligatoire ? 'required' : 'nullable', 'string', 'max:64'],
            'montant' => ['required', 'integer', 'min:1', 'max:10000000'],
            'capture' => $reglages->capture_autorisee ? self::REGLES_CAPTURE : ['prohibited'],
        ], [
            'plan.in' => 'Ce plan ne se paie pas ici : écrivez-nous pour un devis.',
            'reference.required' => 'Recopiez la référence du SMS : sans elle, nous ne pouvons pas retrouver votre paiement.',
            'numero_payeur.regex' => 'Indiquez le numéro de téléphone qui a envoyé l’argent.',
        ]);

        if (! $reglages->numeroPour($donnees['moyen'])) {
            throw ValidationException::withMessages([
                'moyen' => ['Ce moyen de paiement n’est pas encore disponible. Choisissez-en un autre ou écrivez-nous.'],
            ]);
        }

        $proprietaire = $requete->user();
        if (PaiementAbonnement::where('utilisateur_id', $proprietaire->id)->where('statut', 'en_attente')->exists()) {
            return response()->json([
                'erreur' => 'Déjà en cours',
                'message' => 'Un paiement est déjà en cours de vérification. Nous vous prévenons dès qu’il est traité.',
            ], 409);
        }

        $cle = PaiementAbonnement::cleReference($donnees['reference'] ?? null);
        if (PaiementAbonnement::referenceDejaUtilisee($donnees['moyen'], $cle)) {
            throw ValidationException::withMessages([
                'reference' => ['Cette référence a déjà été utilisée. Vérifiez le SMS de confirmation.'],
            ]);
        }

        $plan = Plan::parCode($donnees['plan']);
        $paiement = PaiementAbonnement::create([
            'utilisateur_id' => $proprietaire->id,
            'plan_code' => $plan->code,
            'periode' => $donnees['periode'],
            'montant_attendu' => Abonnements::montantAttendu($plan, $donnees['periode']),
            'montant_declare' => $donnees['montant'],
            'moyen' => $donnees['moyen'],
            'numero_payeur' => trim($donnees['numero_payeur']),
            'reference' => PaiementAbonnement::referenceAffichee($donnees['reference'] ?? null),
            'reference_cle' => $cle,
            'capture' => $donnees['capture'] ?? null,
            'statut' => 'en_attente',
            'origine' => 'declaration',
        ]);

        return response()->json([
            'message' => 'Paiement envoyé pour vérification. Nous vous prévenons dès qu’il est validé.',
            'paiement' => self::paiementPublic($paiement),
        ], 201);
    }

    /** GET /abonnement/paiements — historique des paiements du commerçant. */
    public function historique(Request $requete)
    {
        return PaiementAbonnement::leger()->where('utilisateur_id', $requete->user()->id)
            ->latest('cree_le')->limit(50)->get()
            ->map(fn (PaiementAbonnement $p) => self::paiementPublic($p));
    }

    /** Forme publique d'un paiement (sans la photo du reçu). */
    public static function paiementPublic(PaiementAbonnement $p): array
    {
        return [
            'id' => $p->id,
            'plan' => $p->plan_code,
            'plan_nom' => $p->plan()->nom,
            'formule' => $p->libelleFormule(),
            'periode' => $p->periode,
            'montant_attendu' => $p->montant_attendu,
            'montant_declare' => $p->montant_declare,
            'moyen' => $p->moyen,
            'moyen_libelle' => $p->libelleMoyen(),
            'numero_payeur' => $p->numero_payeur,
            'reference' => $p->reference,
            'a_capture' => $p->aUneCapture(),
            'statut' => $p->statut,
            'motif_refus' => $p->motif_refus,
            'origine' => $p->origine,
            'debut_le' => $p->debut_le?->toDateString(),
            'fin_le' => $p->fin_le?->toDateString(),
            'numero_recu' => $p->numero_recu,
            'cree_le' => $p->cree_le?->toIso8601String(),
            'decide_le' => $p->decide_le?->toIso8601String(),
        ];
    }
}
