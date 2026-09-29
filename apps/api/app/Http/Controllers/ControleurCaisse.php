<?php

namespace App\Http\Controllers;

use App\Models\ClotureCaisse;
use App\Models\Retour;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class ControleurCaisse extends Controleur
{
    /** Agrégats d'un ensemble de ventes par moyen de paiement. */
    private function agreger($ventes): array
    {
        $payees = $ventes->where('paye', true);
        return [
            'nb_ventes' => $ventes->count(),
            'especes' => (float) $payees->where('moyen_paiement', 'especes')->sum('total'),
            'wave' => (float) $payees->where('moyen_paiement', 'wave')->sum('total'),
            'orange' => (float) $payees->where('moyen_paiement', 'orange')->sum('total'),
            'credits' => (float) $ventes->where('paye', false)->where('moyen_paiement', 'credit')->sum('total'),
            'total_encaisse' => (float) $payees->sum('total'),
            'total_ca' => (float) $ventes->sum('total'),
        ];
    }

    public function aujourdhui(Request $requete)
    {
        $ventes = $requete->user()->ventes()->whereDate('cree_le', Carbon::today())->get();
        $donnees = $this->agreger($ventes);
        $retours = Retour::where('utilisateur_id', $requete->user()->id)->whereDate('cree_le', Carbon::today())->get();
        $donnees['total_retours'] = (float) $retours->sum('montant_rembourse');
        $donnees['nb_retours'] = $retours->count();
        $donnees['net'] = $donnees['total_encaisse'] - $donnees['total_retours'];

        return response()->json($donnees);
    }

    public function cloturer(Request $requete)
    {
        $ventes = $requete->user()->ventes()->whereDate('cree_le', Carbon::today())->get();
        $a = $this->agreger($ventes);
        $retours = (float) Retour::where('utilisateur_id', $requete->user()->id)->whereDate('cree_le', Carbon::today())->sum('montant_rembourse');
        $net = $a['total_encaisse'] - $retours;

        $cloture = ClotureCaisse::updateOrCreate(
            // La clé inclut la boutique : deux points de vente clôturent le même
            // jour sans que le second écrase la caisse du premier.
            [
                'utilisateur_id' => $requete->user()->id,
                'boutique_id' => $requete->user()->boutique_active_id,
                'date' => Carbon::today()->toDateString(),
            ],
            [
                'total_especes' => $a['especes'], 'total_wave' => $a['wave'], 'total_orange' => $a['orange'],
                'total_credits' => $a['credits'], 'total_retours' => $retours, 'total_net' => $net,
                'nb_ventes' => $a['nb_ventes'], 'notes' => $requete->input('notes'),
            ],
        );

        \App\Models\JournalActivite::consigner($requete, 'caisse.cloture', 'Net '.number_format($net, 0, '', ' ').' FCFA — '.$a['nb_ventes'].' ventes');

        return response()->json($cloture);
    }

    public function historique(Request $requete)
    {
        return ClotureCaisse::where('utilisateur_id', $requete->user()->id)->orderByDesc('date')->limit(30)->get();
    }

    public function semaine(Request $requete)
    {
        $ventes = $requete->user()->ventes()->where('cree_le', '>=', Carbon::now()->subDays(7))->get();
        $resultat = [];
        for ($i = 6; $i >= 0; $i--) {
            $jour = Carbon::today()->subDays($i);
            $date = $jour->toDateString();
            $duJour = $ventes->filter(fn ($v) => Carbon::parse($v->cree_le)->toDateString() === $date);
            $a = $this->agreger($duJour);
            $resultat[] = [
                'date' => $date, 'nb_ventes' => $a['nb_ventes'], 'total_encaisse' => $a['total_encaisse'],
                'especes' => $a['especes'], 'wave' => $a['wave'], 'orange' => $a['orange'], 'credits' => $a['credits'],
            ];
        }

        return response()->json($resultat);
    }
}
