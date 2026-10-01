<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controleur;
use App\Models\MembreBoutique;
use App\Models\PaiementAbonnement;
use App\Models\Plan;
use App\Models\Utilisateur;
use App\Services\Abonnements;
use App\Services\ClientIa;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

/** Tableau de bord de l'administrateur : revenus, plans, ce qui attend, santé. */
class ControleurTableauDeBord extends Controleur
{
    public function afficher()
    {
        $aujourdhui = Carbon::today();
        $employes = MembreBoutique::where('statut', 'acceptee')->whereNotNull('membre_id')->pluck('membre_id');
        $comptes = Utilisateur::where('role', '!=', 'admin')->whereNotIn('id', $employes)->orderByDesc('cree_le')->orderByDesc('id')->get();

        $repartition = ['gratuit' => 0, 'essai' => 0] + collect(Plan::catalogue())->filter->estPayant()->map(fn () => 0)->all();
        $mrr = 0;
        $expirent = 0;
        foreach ($comptes as $compte) {
            $etat = Abonnements::etat($compte, $aujourdhui);
            if (in_array($etat->source, ['paye', 'grace'], true)) {
                $repartition[$etat->planPaye->code] = ($repartition[$etat->planPaye->code] ?? 0) + 1;
                $mrr += $this->valeurMensuelle($compte->id, $aujourdhui);
            } elseif ($etat->source === 'essai') {
                $repartition['essai']++;
            } else {
                $repartition['gratuit']++;
            }
            $jours = $etat->joursRestants($aujourdhui);
            if (in_array($etat->source, ['paye', 'essai'], true) && $jours !== null && $jours <= 7) {
                $expirent++;
            }
        }

        $valides = PaiementAbonnement::leger()->where('statut', 'valide')->where('montant_declare', '>', 0)
            ->where('origine', '!=', 'reprise')->whereNotNull('decide_le');
        $debutMois = $aujourdhui->copy()->startOfMonth();

        $revenus = [];
        for ($i = 5; $i >= 0; $i--) {
            $debut = $debutMois->copy()->subMonthsNoOverflow($i);
            $revenus[] = [
                'mois' => $debut->format('Y-m'),
                'total' => (int) (clone $valides)->whereBetween('decide_le', [$debut, $debut->copy()->endOfMonth()])->sum('montant_declare'),
            ];
        }

        // Essais terminés le mois dernier, et combien ont payé depuis.
        $debutPrecedent = $debutMois->copy()->subMonthNoOverflow();
        $essaisFinis = $comptes->filter(fn ($c) => $c->essai_jusqu_au && $c->essai_jusqu_au->between($debutPrecedent, $debutMois->copy()->subDay()));
        $convertis = $essaisFinis->filter(fn ($c) => PaiementAbonnement::where('utilisateur_id', $c->id)->where('statut', 'valide')->where('montant_declare', '>', 0)->exists());

        $aVerifier = PaiementAbonnement::leger()->with('utilisateur:id,nom_commerce,identifiant')
            ->where('statut', 'en_attente')->orderBy('cree_le')->limit(3)->get();

        return response()->json([
            'chiffres' => [
                'revenu_mensuel_recurrent' => (int) round($mrr),
                'abonnes_payants' => array_sum(array_diff_key($repartition, ['gratuit' => 0, 'essai' => 0])),
                'encaisse_mois' => (int) (clone $valides)->where('decide_le', '>=', $debutMois)->sum('montant_declare'),
                'paiements_valides_mois' => (clone $valides)->where('decide_le', '>=', $debutMois)->count(),
                'a_verifier' => PaiementAbonnement::where('statut', 'en_attente')->count(),
                'expirent_sous_7_jours' => $expirent,
                'commercants' => $comptes->count(),
            ],
            'repartition' => $repartition,
            'revenus' => $revenus,
            'conversion_essais' => ['termines' => $essaisFinis->count(), 'convertis' => $convertis->count(), 'mois' => $debutPrecedent->format('Y-m')],
            'a_verifier' => $aVerifier->map(fn (PaiementAbonnement $p) => [
                'id' => $p->id,
                'commerce' => $p->utilisateur?->nom_commerce ?: $p->utilisateur?->identifiant,
                'formule' => $p->libelleFormule(),
                'moyen' => $p->moyen,
                'montant_declare' => $p->montant_declare,
                'ecart' => $p->montant_declare - $p->montant_attendu,
                'cree_le' => $p->cree_le?->toIso8601String(),
            ])->values(),
            'inscriptions' => $comptes->take(5)->map(fn (Utilisateur $c) => [
                'id' => $c->id,
                'nom_commerce' => $c->nom_commerce ?: $c->identifiant,
                'cree_le' => $c->cree_le?->toIso8601String(),
                'essai_jours_restants' => $c->essai_jusqu_au && $c->essai_jusqu_au->gte($aujourdhui) ? (int) $aujourdhui->diffInDays($c->essai_jusqu_au) : null,
            ])->values(),
            'sante' => $this->sante(),
        ]);
    }

    /** Valeur mensuelle de l'abonnement en cours (un an payé compte pour 1/12 par mois). */
    private function valeurMensuelle(int $utilisateurId, Carbon $jour): float
    {
        $courant = PaiementAbonnement::leger()->where('utilisateur_id', $utilisateurId)->where('statut', 'valide')
            ->whereDate('debut_le', '<=', $jour)->orderByDesc('fin_le')->first();
        if (! $courant) {
            return 0;
        }

        return $courant->periode === 'an' ? $courant->montant_declare / 12 : $courant->montant_declare;
    }

    /** API, IA, sauvegarde de nuit, réveil automatique. */
    private function sante(): array
    {
        $debut = microtime(true);
        try {
            DB::select('select 1');
            $base = true;
        } catch (\Throwable) {
            $base = false;
        }
        $latence = (int) round((microtime(true) - $debut) * 1000);

        $ia = Cache::remember('sante:ia', 120, function () {
            try {
                $url = (new ClientIa)->adresseDeBase();

                return $url !== null && Http::timeout(2)->get($url.'/sante')->successful();
            } catch (\Throwable) {
                return false;
            }
        });

        return [
            'api' => ['ok' => $base, 'latence_ms' => $latence],
            'ia' => ['ok' => (bool) $ia],
            'sauvegarde' => $this->derniereSauvegarde(),
            'reveil' => ['dernier' => Cache::get('reveil:dernier')],
        ];
    }

    /**
     * Dernière exécution du workflow de sauvegarde (dépôt public : l'API de
     * GitHub répond sans jeton). Mise en cache 30 min, et seulement en
     * production — les tests ne sortent pas sur Internet.
     */
    private function derniereSauvegarde(): ?array
    {
        if (! app()->environment('production')) {
            return null;
        }

        return Cache::remember('sante:sauvegarde', 1800, function () {
            try {
                $depot = config('app.depot_github', 'ASS429/SamaCommerce');
                $reponse = Http::timeout(3)->withHeaders(['Accept' => 'application/vnd.github+json', 'User-Agent' => 'SamaCommerce'])
                    ->get("https://api.github.com/repos/{$depot}/actions/workflows/sauvegarde-base.yml/runs", ['per_page' => 1]);
                $execution = $reponse->json('workflow_runs.0');

                return $execution ? [
                    'ok' => $execution['conclusion'] === 'success',
                    'etat' => $execution['conclusion'] ?? $execution['status'],
                    'le' => $execution['updated_at'],
                ] : null;
            } catch (\Throwable) {
                return null;
            }
        });
    }
}
