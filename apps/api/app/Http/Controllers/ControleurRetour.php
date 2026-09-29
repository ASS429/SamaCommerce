<?php

namespace App\Http\Controllers;

use App\Models\Retour;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class ControleurRetour extends Controleur
{
    public function lister(Request $requete)
    {
        return Retour::where('retours.utilisateur_id', $requete->user()->id)
            ->join('produits', 'produits.id', '=', 'retours.produit_id')
            ->orderByDesc('retours.cree_le')->limit(100)
            ->get(['retours.*', 'produits.nom as nom_produit', 'produits.prix_vente as prix_produit']);
    }

    public function statistiques(Request $requete)
    {
        $lignes = Retour::where('utilisateur_id', $requete->user()->id)->get();
        $jour = $lignes->filter(fn ($r) => Carbon::parse($r->cree_le)->isToday());

        return response()->json([
            'nb_retours' => $lignes->count(),
            'total_rembourse' => (float) $lignes->sum('montant_rembourse'),
            'retours_jour' => $jour->count(),
            'rembourse_jour' => (float) $jour->sum('montant_rembourse'),
        ]);
    }

    public function creer(Request $requete)
    {
        $donnees = $requete->validate([
            'vente_id' => ['required', 'integer'],
            'quantite' => ['required', 'integer', 'min:1'],
            'motif' => ['nullable', 'string'],
            'moyen_remboursement' => ['nullable', 'in:avoir,especes,wave,orange'],
        ]);

        return DB::transaction(function () use ($requete, $donnees) {
            $vente = $requete->user()->ventes()->lockForUpdate()->findOrFail($donnees['vente_id']);

            $dejaRendu = (int) Retour::where('vente_id', $vente->id)->sum('quantite');
            $maximum = $vente->quantite - $dejaRendu;
            if ($donnees['quantite'] > $maximum) {
                return response()->json(['erreur' => "Maximum {$maximum} unité(s) retournable(s)"], 400);
            }

            $rembourse = $vente->quantite > 0 ? round(($vente->total / $vente->quantite) * $donnees['quantite'], 2) : 0;

            $retour = Retour::create([
                'vente_id' => $vente->id, 'produit_id' => $vente->produit_id,
                'utilisateur_id' => $requete->user()->id, 'boutique_id' => $requete->user()->boutique_active_id,
                'quantite' => $donnees['quantite'],
                'motif' => $donnees['motif'] ?? null, 'moyen_remboursement' => $donnees['moyen_remboursement'] ?? 'avoir',
                'montant_rembourse' => $rembourse,
            ]);

            // Recréditer le stock
            $requete->user()->produits()->where('id', $vente->produit_id)->increment('stock', $donnees['quantite']);
            static::perimerStatistiques($requete->user()->id); // T13 — périmer le cache des statistiques

            // Mettre à jour la vente
            $nouvelleQuantite = $vente->quantite - $donnees['quantite'];
            if ($nouvelleQuantite === 0) {
                $vente->update(['quantite' => 0, 'total' => 0, 'moyen_paiement' => 'retour']);
            } else {
                $vente->update(['quantite' => $nouvelleQuantite, 'total' => max(0, $vente->total - $rembourse)]);
            }

            return response()->json([
                'message' => "Retour enregistré — " . number_format($rembourse, 0, ',', ' ') . " F remboursés",
                'retour' => $retour, 'stock_restitue' => $donnees['quantite'], 'montant_rembourse' => $rembourse,
            ], 201);
        });
    }
}
