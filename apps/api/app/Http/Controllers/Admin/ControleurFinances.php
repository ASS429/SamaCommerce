<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controleur;
use App\Models\PaiementAbonnement;
use App\Models\Retrait;
use App\Models\TransfertAdmin;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

/**
 * L'argent des abonnements, compte par compte. Chaque entrée vient d'un
 * paiement VALIDÉ — plus du montant qu'un navigateur déclarait.
 */
class ControleurFinances extends Controleur
{
    private const COMPTES = ['wave' => 'Wave', 'orange' => 'Orange Money', 'especes' => 'Espèces'];

    public function afficher(Request $requete)
    {
        $mois = preg_match('/^\d{4}-\d{2}$/', (string) $requete->query('mois')) ? $requete->query('mois') : Carbon::now()->format('Y-m');
        $debutMois = Carbon::createFromFormat('Y-m-d', $mois.'-01')->startOfDay();
        $finMois = $debutMois->copy()->endOfMonth();

        $encaissements = PaiementAbonnement::leger()->with('utilisateur:id,nom_commerce,identifiant')
            ->where('statut', 'valide')->where('montant_declare', '>', 0)
            ->whereIn('moyen', array_keys(self::COMPTES))->get();
        $retraits = Retrait::where('statut', 'validé')->get();
        $transferts = TransfertAdmin::all();

        $comptes = [];
        foreach (self::COMPTES as $moyen => $libelle) {
            $dansLeMois = fn ($date) => $date && Carbon::parse($date)->between($debutMois, $finMois);
            $entrees = $encaissements->where('moyen', $moyen);
            $sorties = $retraits->where('moyen', $moyen);
            $solde = $entrees->sum('montant_declare') - $sorties->sum(fn ($r) => (int) $r->montant)
                - $transferts->where('compte_source', $moyen)->sum(fn ($t) => (int) $t->montant)
                + $transferts->where('compte_destination', $moyen)->sum(fn ($t) => (int) $t->montant);

            $comptes[] = [
                'moyen' => $moyen,
                'libelle' => $libelle,
                'solde' => (int) $solde,
                'entrees_mois' => (int) $entrees->filter(fn ($p) => $dansLeMois($p->decide_le))->sum('montant_declare'),
                'sorties_mois' => (int) $sorties->filter(fn ($r) => $dansLeMois($r->cree_le))->sum(fn ($r) => (int) $r->montant),
            ];
        }

        $mouvements = collect()
            ->merge($encaissements->filter(fn ($p) => $p->decide_le && $p->decide_le->between($debutMois, $finMois))->map(fn ($p) => [
                'type' => 'entree',
                'date' => $p->decide_le->toIso8601String(),
                'libelle' => 'Abonnement '.$p->libelleFormule(),
                'detail' => ($p->utilisateur?->nom_commerce ?: $p->utilisateur?->identifiant).($p->numero_recu ? ' · reçu '.$p->numero_recu : ''),
                'compte' => $p->moyen,
                'montant' => $p->montant_declare,
            ]))
            ->merge($retraits->filter(fn ($r) => Carbon::parse($r->cree_le)->between($debutMois, $finMois))->map(fn ($r) => [
                'type' => 'retrait',
                'date' => Carbon::parse($r->cree_le)->toIso8601String(),
                'libelle' => 'Retrait',
                'detail' => 'Enregistré par l’administrateur',
                'compte' => $r->moyen,
                'montant' => -(int) $r->montant,
            ]))
            ->merge($transferts->filter(fn ($t) => Carbon::parse($t->cree_le)->between($debutMois, $finMois))->map(fn ($t) => [
                'type' => 'transfert',
                'date' => Carbon::parse($t->cree_le)->toIso8601String(),
                'libelle' => 'Transfert '.(self::COMPTES[$t->compte_source] ?? $t->compte_source).' → '.(self::COMPTES[$t->compte_destination] ?? $t->compte_destination),
                'detail' => 'Entre vos comptes',
                'compte' => $t->compte_source,
                'montant' => (int) $t->montant,
            ]))
            ->sortByDesc('date')->values();

        return response()->json([
            'mois' => $mois,
            'comptes' => $comptes,
            'total' => array_sum(array_column($comptes, 'solde')),
            'encaisse_mois' => array_sum(array_column($comptes, 'entrees_mois')),
            'retire_mois' => array_sum(array_column($comptes, 'sorties_mois')),
            'mouvements' => $mouvements,
        ]);
    }
}
