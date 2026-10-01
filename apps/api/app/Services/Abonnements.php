<?php

namespace App\Services;

use App\Models\ConsommationIa;
use App\Models\MembreBoutique;
use App\Models\PaiementAbonnement;
use App\Models\Plan;
use App\Models\Produit;
use App\Models\ReglagesAbonnement;
use App\Models\Scopes\CloisonnementBoutique;
use App\Models\Utilisateur;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Règles d'abonnement, en un seul endroit.
 *
 *  - Le plan qui s'applique se DÉDUIT des paiements validés et de l'essai :
 *    rien n'est à « faire expirer », il n'y a pas de tâche planifiée à oublier.
 *  - Aucun jour perdu : un renouvellement prolonge la période en cours, un
 *    paiement pendant l'essai commence à la fin de l'essai.
 *  - À l'expiration (délai de grâce écoulé), le compte repasse au Gratuit :
 *    rien n'est supprimé, la vente continue, seuls les AJOUTS au-delà des
 *    limites du plan sont bloqués.
 */
final class Abonnements
{
    /** État d'abonnement d'un compte, à une date (aujourd'hui par défaut). */
    public static function etat(Utilisateur $compte, ?Carbon $jour = null): EtatAbonnement
    {
        $jour = ($jour ?? Carbon::today())->copy()->startOfDay();

        if ($compte->role === 'admin') {
            $tous = array_values(Plan::catalogue());

            return new EtatAbonnement(end($tous), 'admin');
        }

        $reglages = ReglagesAbonnement::courants();
        $periodes = self::periodesValidees($compte->id);

        // 1. Période payée qui couvre aujourd'hui : la plus complète l'emporte
        //    (un passage au plan supérieur chevauche le reste du plan inférieur).
        $planPaye = $finLe = $graceJusquAu = null;
        $source = null;
        $couvrantes = $periodes->filter(fn ($p) => $p->debut_le->lte($jour) && $p->fin_le->gte($jour));
        if ($couvrantes->isNotEmpty()) {
            $courante = $couvrantes->sortByDesc(fn ($p) => $p->plan()->ordre)->first();
            $planPaye = $courante->plan();
            $finLe = self::finDeChaine($periodes, $planPaye->code, $courante->fin_le);
            $source = 'paye';
        } elseif ($derniere = $periodes->filter(fn ($p) => $p->fin_le->lt($jour))->sortByDesc('fin_le')->first()) {
            // 2. Délai de grâce : tout fonctionne encore, le commerçant est prévenu.
            $finGrace = $derniere->fin_le->copy()->addDays($reglages->delai_grace_jours);
            if ($jour->lte($finGrace)) {
                $planPaye = $derniere->plan();
                $finLe = $derniere->fin_le->copy();
                $graceJusquAu = $finGrace;
                $source = 'grace';
            }
        }

        // 3. Essai offert à l'inscription.
        $essaiJusquAu = $compte->essai_jusqu_au && $jour->lte($compte->essai_jusqu_au) ? $compte->essai_jusqu_au->copy() : null;
        $planEssai = $essaiJusquAu ? Plan::parCode($reglages->plan_essai) : null;

        $plan = $planPaye ?? Plan::parCode('gratuit');
        $sourceFinale = $planPaye ? $source : 'gratuit';
        if ($planEssai && $planEssai->ordre > $plan->ordre) {
            $plan = $planEssai;
            $sourceFinale = 'essai';
        }

        // 4. Plan expiré : pour dire « votre plan Pro a expiré le … ».
        $planExpire = $expireLe = null;
        if (! $planPaye && ($derniere = $periodes->sortByDesc('fin_le')->first()) && $derniere->fin_le->lt($jour)) {
            $planExpire = $derniere->plan();
            $expireLe = $derniere->fin_le->copy();
        }

        return new EtatAbonnement($plan, $sourceFinale, $planPaye, $finLe, $graceJusquAu, $essaiJusquAu, $planEssai, $planExpire, $expireLe);
    }

    /** @return Collection<int, PaiementAbonnement> */
    private static function periodesValidees(int $utilisateurId): Collection
    {
        return PaiementAbonnement::query()
            ->where('utilisateur_id', $utilisateurId)
            ->where('statut', 'valide')
            ->whereNotNull('debut_le')->whereNotNull('fin_le')
            ->orderBy('debut_le')
            ->get(['id', 'plan_code', 'debut_le', 'fin_le']);
    }

    /** Fin d'une suite de périodes consécutives du même plan. */
    private static function finDeChaine(Collection $periodes, string $code, Carbon $fin): Carbon
    {
        $fin = $fin->copy();
        while ($suivante = $periodes->first(fn ($p) => $p->plan_code === $code && $p->debut_le->isSameDay($fin->copy()->addDay()))) {
            $fin = $suivante->fin_le->copy();
        }

        return $fin;
    }

    /**
     * Période qu'ouvrirait un paiement validé ce jour-là : [début, fin], bornes
     * incluses. Aucun jour perdu, aucun jour offert par erreur :
     *  - même plan (ou inférieur) que la période payée : elle la prolonge, y
     *    compris pendant le délai de grâce (les jours de grâce utilisés comptent) ;
     *  - plan supérieur : il commence tout de suite ;
     *  - pendant l'essai, un plan de même niveau commence à la fin de l'essai.
     *
     * @return array{0: Carbon, 1: Carbon}
     */
    public static function periodePour(Utilisateur $compte, Plan $plan, string $periode, ?Carbon $jour = null): array
    {
        $jour = ($jour ?? Carbon::today())->copy()->startOfDay();
        $etat = self::etat($compte, $jour);
        $debut = $jour->copy();

        if ($etat->planPaye && $plan->ordre <= $etat->planPaye->ordre) {
            $debut = $etat->finLe->copy()->addDay();
        }
        // Périodes déjà payées pour plus tard (renouvellement anticipé) : à la suite.
        $futures = self::periodesValidees($compte->id)->filter(fn ($p) => $p->debut_le->gt($jour));
        if ($futures->isNotEmpty() && $plan->ordre <= $futures->max(fn ($p) => $p->plan()->ordre)) {
            $debut = Carbon::parse($futures->max('fin_le'))->addDay()->max($debut);
        }
        if ($etat->essaiJusquAu && $plan->ordre <= $etat->planEssai->ordre) {
            $debut = $debut->max($etat->essaiJusquAu->copy()->addDay());
        }

        $fin = $periode === 'an'
            ? $debut->copy()->addYearNoOverflow()->subDay()
            : $debut->copy()->addMonthNoOverflow()->subDay();

        return [$debut, $fin];
    }

    public static function montantAttendu(Plan $plan, string $periode): int
    {
        return $plan->prix($periode, ReglagesAbonnement::courants()->mois_offerts_annuel);
    }

    // --- Décisions de l'administrateur ---------------------------------------

    public static function valider(PaiementAbonnement $paiement, Utilisateur $admin): PaiementAbonnement
    {
        return DB::transaction(function () use ($paiement, $admin) {
            // Verrou : deux clics sur « Valider » ne font pas deux périodes.
            $paiement = PaiementAbonnement::query()->lockForUpdate()->findOrFail($paiement->id);
            self::exigerEnAttente($paiement);

            [$debut, $fin] = self::periodePour($paiement->utilisateur, $paiement->plan(), $paiement->periode);
            $paiement->update([
                'statut' => 'valide',
                'debut_le' => $debut,
                'fin_le' => $fin,
                'numero_recu' => $paiement->montant_declare > 0 ? self::prochainNumeroRecu() : null,
                'decide_par' => $admin->id,
                'decide_le' => Carbon::now(),
                'motif_refus' => null,
            ]);
            self::synchroniserCompte($paiement->utilisateur);

            return $paiement->fresh();
        });
    }

    public static function refuser(PaiementAbonnement $paiement, Utilisateur $admin, string $motif): PaiementAbonnement
    {
        return DB::transaction(function () use ($paiement, $admin, $motif) {
            $paiement = PaiementAbonnement::query()->lockForUpdate()->findOrFail($paiement->id);
            self::exigerEnAttente($paiement);
            $paiement->update([
                'statut' => 'refuse', 'motif_refus' => $motif,
                'decide_par' => $admin->id, 'decide_le' => Carbon::now(),
            ]);

            return $paiement->fresh();
        });
    }

    /** Annule une décision (erreur de clic) : le paiement redevient « à vérifier ». */
    public static function annulerDecision(PaiementAbonnement $paiement): PaiementAbonnement
    {
        return DB::transaction(function () use ($paiement) {
            $paiement = PaiementAbonnement::query()->lockForUpdate()->findOrFail($paiement->id);
            if ($paiement->statut === 'en_attente' || $paiement->origine !== 'declaration') {
                throw new HttpResponseException(response()->json([
                    'erreur' => 'Rien à annuler',
                    'message' => 'Seule une décision prise sur une déclaration peut être annulée.',
                ], 409));
            }
            $paiement->update([
                'statut' => 'en_attente', 'debut_le' => null, 'fin_le' => null, 'numero_recu' => null,
                'motif_refus' => null, 'decide_par' => null, 'decide_le' => null,
            ]);
            self::synchroniserCompte($paiement->utilisateur);

            return $paiement->fresh();
        });
    }

    /**
     * Geste de l'administrateur : plan offert, ou paiement reçu en main propre
     * (espèces). Validé d'emblée, à la suite de la période en cours.
     */
    public static function enregistrerGeste(Utilisateur $compte, Utilisateur $admin, Plan $plan, ?int $jours, string $periode, string $moyen, int $montant): PaiementAbonnement
    {
        return DB::transaction(function () use ($compte, $admin, $plan, $jours, $periode, $moyen, $montant) {
            [$debut, $fin] = self::periodePour($compte, $plan, $periode);
            if ($jours !== null) {
                $fin = $debut->copy()->addDays($jours - 1);
            }
            $paiement = PaiementAbonnement::create([
                'utilisateur_id' => $compte->id,
                'plan_code' => $plan->code,
                'periode' => $periode,
                'montant_attendu' => $montant,
                'montant_declare' => $montant,
                'moyen' => $moyen,
                'statut' => 'valide',
                'origine' => 'admin',
                'debut_le' => $debut,
                'fin_le' => $fin,
                'numero_recu' => $montant > 0 ? self::prochainNumeroRecu() : null,
                'decide_par' => $admin->id,
                'decide_le' => Carbon::now(),
            ]);
            self::synchroniserCompte($compte);

            return $paiement;
        });
    }

    private static function exigerEnAttente(PaiementAbonnement $paiement): void
    {
        if ($paiement->statut !== 'en_attente') {
            throw new HttpResponseException(response()->json([
                'erreur' => 'Déjà traité',
                'message' => 'Ce paiement a déjà été traité.',
            ], 409));
        }
    }

    /** Reçus numérotés sans trou ni doublon : SC-0001, SC-0002… */
    private static function prochainNumeroRecu(): string
    {
        // Les réglages (une ligne) servent de verrou : un seul numéro à la fois.
        ReglagesAbonnement::query()->whereKey(1)->lockForUpdate()->first();
        $dernier = PaiementAbonnement::query()->whereNotNull('numero_recu')->pluck('numero_recu')
            ->map(fn ($n) => (int) substr($n, 3))->max() ?? 0;

        return sprintf('SC-%04d', $dernier + 1);
    }

    /**
     * Recopie dans le compte le plan PAYÉ et son échéance (colonnes `plan` et
     * `expiration`, lues par les écrans existants). Le plan qui s'applique
     * réellement reste calculé par etat() : ces colonnes ne sont qu'un reflet.
     */
    public static function synchroniserCompte(Utilisateur $compte): void
    {
        $jour = Carbon::today();
        $aVenir = self::periodesValidees($compte->id)->filter(fn ($p) => $p->fin_le->gte($jour))->sortByDesc('fin_le')->first();
        $etat = self::etat($compte, $jour);

        if ($aVenir) {
            $plan = $aVenir->plan();
            $echeance = self::finDeChaine(self::periodesValidees($compte->id), $plan->code, $aVenir->fin_le);
        } elseif ($etat->planPaye) {
            $plan = $etat->planPaye;
            $echeance = $etat->finLe;
        } else {
            $plan = Plan::parCode('gratuit');
            $echeance = null;
        }

        $compte->forceFill(['plan' => $plan->nom, 'expiration' => $echeance])->save();
    }

    // --- Limites et fonctionnalités -------------------------------------------

    /**
     * Refuse un AJOUT qui dépasserait la limite du plan (402, avec le plan
     * qui le permettrait). Ce qui existe déjà n'est jamais retiré.
     */
    public static function exigerPlace(Utilisateur $proprietaire, string $cle, int $actuel, string $code, callable $message): void
    {
        $etat = self::etat($proprietaire);
        $limite = $etat->limite($cle);
        if ($limite === null || $actuel < $limite) {
            return;
        }
        $requis = Plan::premierQui(fn (Plan $p) => $p->limite($cle) === null || $p->limite($cle) > $limite);
        self::refuserPourLePlan($code, $message($limite, $etat->plan), $requis);
    }

    /** Vérifie le quota de conseils IA du mois (sans le consommer). */
    public static function exigerConseilIa(Utilisateur $proprietaire): void
    {
        self::exigerPlace($proprietaire, 'ia', ConsommationIa::duMois($proprietaire->id), 'QUOTA_IA_ATTEINT',
            fn (int $quota) => "Vos {$quota} conseils IA du mois sont utilisés. Ils reviennent le 1er du mois prochain, ou passez à un plan supérieur.");
    }

    public static function exigerFonctionnalite(Utilisateur $proprietaire, string $fonctionnalite): void
    {
        if (self::etat($proprietaire)->inclut($fonctionnalite)) {
            return;
        }
        $requis = Plan::premierQui(fn (Plan $p) => $p->inclut($fonctionnalite));
        $libelle = Plan::FONCTIONNALITES[$fonctionnalite] ?? $fonctionnalite;
        self::refuserPourLePlan('FONCTIONNALITE_NON_INCLUSE',
            $requis ? "{$libelle} : inclus à partir du plan {$requis->nom}." : "{$libelle} : non inclus dans votre plan.",
            $requis, ['fonctionnalite' => $fonctionnalite]);
    }

    public static function refuserPourLePlan(string $code, string $message, ?Plan $requis, array $plus = []): never
    {
        throw new HttpResponseException(response()->json([
            'erreur' => 'Limite atteinte',
            'code' => $code,
            'message' => $message,
            'plan_requis' => $requis?->code,
            'plan_requis_nom' => $requis?->nom,
        ] + $plus, 402));
    }

    // --- Lecture ---------------------------------------------------------------

    /** Ce que le commerçant utilise, face aux limites de son plan. */
    public static function utilisation(Utilisateur $proprietaire): array
    {
        return [
            'boutiques' => $proprietaire->boutiques()->count(),
            'employes' => MembreBoutique::where('proprietaire_id', $proprietaire->id)->where('statut', '!=', 'refusee')->count(),
            'produits' => Produit::withoutGlobalScope(CloisonnementBoutique::class)->where('utilisateur_id', $proprietaire->id)->count(),
            'ia' => ConsommationIa::duMois($proprietaire->id),
        ];
    }

    /** État publiable (écran « Mon plan », fiche commerçant). */
    public static function versTableau(EtatAbonnement $etat): array
    {
        $date = fn (?Carbon $d) => $d?->toDateString();

        return [
            'plan' => self::planPublic($etat->plan),
            'source' => $etat->source,
            'plan_paye' => $etat->planPaye?->code,
            'fin_le' => $date($etat->finLe),
            'grace_jusqu_au' => $date($etat->graceJusquAu),
            'essai_jusqu_au' => $date($etat->essaiJusquAu),
            'plan_essai' => $etat->planEssai?->code,
            'plan_expire' => $etat->planExpire?->code,
            'expire_le' => $date($etat->expireLe),
            'jours_restants' => $etat->joursRestants(),
            'limites' => array_map(fn ($colonne) => $etat->plan->{$colonne}, Plan::LIMITES),
            'fonctionnalites' => array_values($etat->plan->fonctionnalites ?? []),
        ];
    }

    public static function planPublic(Plan $plan): array
    {
        $moisOfferts = ReglagesAbonnement::courants()->mois_offerts_annuel;

        return [
            'code' => $plan->code,
            'nom' => $plan->nom,
            'accroche' => $plan->accroche,
            'prix_mensuel' => $plan->prix_mensuel,
            'prix_annuel' => $plan->sur_devis ? null : $plan->prix('an', $moisOfferts),
            'sur_devis' => $plan->sur_devis,
            'prix_a_partir_de' => $plan->prix_a_partir_de,
            'limites' => array_map(fn ($colonne) => $plan->{$colonne}, Plan::LIMITES),
            'fonctionnalites' => array_values($plan->fonctionnalites ?? []),
            'ordre' => $plan->ordre,
        ];
    }
}
