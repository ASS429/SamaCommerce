<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controleur;
use App\Models\Retrait;
use App\Models\TransfertAdmin;
use App\Models\Utilisateur;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class ControleurStatistiques extends Controleur
{
    private function premiumValides()
    {
        return Utilisateur::where('plan', 'Premium')->where('statut_demande_premium', 'validé');
    }

    public function vueEnsemble()
    {
        $aujourdhui = Carbon::today();
        $debutMois = Carbon::now()->startOfMonth();

        $totalUtilisateurs = Utilisateur::count();
        $premiumActifs = (clone $this->premiumValides())
            ->where(fn ($q) => $q->whereNull('expiration')->orWhereDate('expiration', '>=', $aujourdhui))
            ->count();
        $revenus = (float) $this->premiumValides()->sum('montant');
        $enAttente = Utilisateur::where('plan', 'Premium')->where('statut_demande_premium', 'en attente')->count();

        $utilisateursAvant = Utilisateur::where('cree_le', '<', $debutMois)->count();
        $revenusAvant = (float) (clone $this->premiumValides())->where('cree_le', '<', $debutMois)->sum('montant');

        return response()->json([
            'total_utilisateurs' => $totalUtilisateurs,
            'premium_actifs' => $premiumActifs,
            'revenus' => $revenus,
            'en_attente' => $enAttente,
            'croissance' => [
                'total_utilisateurs' => ['actuel' => $totalUtilisateurs, 'precedent' => $utilisateursAvant],
                'premium_actifs' => ['actuel' => $premiumActifs, 'precedent' => $premiumActifs],
                'revenus' => ['actuel' => $revenus, 'precedent' => $revenusAvant],
            ],
        ]);
    }

    public function revenus(Request $requete)
    {
        $periode = strtolower($requete->query('periode', 'mois'));
        $solde = (float) $this->premiumValides()->sum('montant');

        $q = $this->premiumValides();
        if ($periode === 'jour') $q->whereDate('expiration', Carbon::today());
        elseif ($periode === 'semaine') $q->whereBetween('expiration', [Carbon::now()->startOfWeek(), Carbon::now()->endOfWeek()]);
        elseif ($periode === 'mois') $q->whereBetween('expiration', [Carbon::now()->startOfMonth(), Carbon::now()->endOfMonth()]);
        $totalPeriode = $periode === 'tout' ? $solde : (float) $q->sum('montant');

        $enAttente = (float) Utilisateur::where('plan', 'Premium')->where('statut_demande_premium', 'en attente')->sum('montant');

        return response()->json([
            'solde' => $solde,
            'total_periode' => $totalPeriode,
            'en_attente' => $enAttente,
            'periode' => $periode,
        ]);
    }

    public function transactions(Request $requete)
    {
        $limite = (int) $requete->integer('limite', 10);
        return Utilisateur::where('plan', 'Premium')
            ->orderByRaw('expiration IS NULL, expiration DESC')
            ->limit($limite)
            ->get(['id', 'identifiant', 'plan', 'montant', 'moyen_paiement', 'statut_demande_premium', 'expiration', 'cree_le']);
    }

    public function comptes(Request $requete)
    {
        $adminId = $requete->user()->id;
        $comptes = ['orange' => 0.0, 'wave' => 0.0, 'especes' => 0.0];

        foreach ($this->premiumValides()->get(['moyen_paiement', 'montant']) as $u) {
            if ($u->moyen_paiement && isset($comptes[$u->moyen_paiement])) {
                $comptes[$u->moyen_paiement] += (float) $u->montant;
            }
        }
        foreach (Retrait::where('admin_id', $adminId)->where('statut', 'validé')->get() as $r) {
            if (isset($comptes[$r->moyen])) $comptes[$r->moyen] -= (float) $r->montant;
        }
        foreach (TransfertAdmin::where('admin_id', $adminId)->get() as $t) {
            if (isset($comptes[$t->compte_source])) $comptes[$t->compte_source] -= (float) $t->montant;
            if (isset($comptes[$t->compte_destination])) $comptes[$t->compte_destination] += (float) $t->montant;
        }

        $total = array_sum($comptes);
        $entrees = (float) (clone $this->premiumValides())->whereDate('cree_le', Carbon::today())->sum('montant');
        $retraits = (float) Retrait::where('admin_id', $adminId)->where('statut', 'validé')
            ->whereDate('cree_le', Carbon::today())->sum('montant');

        return response()->json([
            'comptes' => $comptes, 'total' => $total,
            'entrees' => $entrees, 'retraits' => $retraits, 'net' => $entrees - $retraits,
        ]);
    }

    public function detailCompte(Request $requete, string $moyen)
    {
        $adminId = $requete->user()->id;
        return response()->json([
            'abonnements' => $this->premiumValides()->where('moyen_paiement', $moyen)
                ->orderByRaw('expiration IS NULL, expiration DESC')->limit(50)
                ->get(['identifiant', 'montant', 'moyen_paiement', 'expiration', 'cree_le']),
            'retraits' => Retrait::where('admin_id', $adminId)->where('statut', 'validé')->where('moyen', $moyen)
                ->orderByDesc('cree_le')->limit(50)->get(['montant', 'statut', 'cree_le']),
            'transferts' => TransfertAdmin::where('admin_id', $adminId)
                ->where(fn ($q) => $q->where('compte_source', $moyen)->orWhere('compte_destination', $moyen))
                ->orderByDesc('cree_le')->limit(50)->get(),
        ]);
    }

    public function evolution()
    {
        $annee = Carbon::now()->year;
        $lignes = $this->premiumValides()->whereNotNull('expiration')
            ->whereYear('expiration', $annee)->get(['expiration', 'montant']);

        $parMois = [];
        foreach ($lignes as $l) {
            $cle = Carbon::parse($l->expiration)->format('Y-m');
            $parMois[$cle] = ($parMois[$cle] ?? 0) + (float) $l->montant;
        }
        ksort($parMois);

        return response()->json(array_map(fn ($mois, $total) => compact('mois', 'total'),
            array_keys($parMois), array_values($parMois)));
    }
}
