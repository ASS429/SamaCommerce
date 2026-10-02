<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controleur;
use App\Models\Retrait;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ControleurRetraits extends Controleur
{
    public function lister(Request $requete)
    {
        return Retrait::where('admin_id', $requete->user()->id)->orderByDesc('cree_le')->get();
    }

    public function creer(Request $requete)
    {
        $donnees = $requete->validate([
            'montant' => ['required', 'integer', 'min:1'],
            'moyen' => ['required', Rule::in(array_keys(ControleurFinances::COMPTES))],
        ], ['moyen.in' => 'Choisissez Wave, Orange Money ou Espèces.']);

        $solde = ControleurFinances::soldes()[$donnees['moyen']];
        if ($donnees['montant'] > $solde) {
            return response()->json(['erreur' => 'Le compte '.ControleurFinances::COMPTES[$donnees['moyen']].' n’a que '.number_format($solde, 0, ',', ' ').' F.'], 422);
        }

        $retrait = Retrait::create([
            'admin_id' => $requete->user()->id,
            'montant' => $donnees['montant'],
            'moyen' => $donnees['moyen'],
            'statut' => 'validé',
        ]);

        return response()->json(['message' => 'Demande de retrait enregistrée', 'retrait' => $retrait], 201);
    }
}
