<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controleur;
use App\Models\TransfertAdmin;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ControleurTransferts extends Controleur
{
    public function lister(Request $requete)
    {
        return TransfertAdmin::where('admin_id', $requete->user()->id)->orderByDesc('cree_le')->get();
    }

    public function creer(Request $requete)
    {
        $comptes = array_keys(ControleurFinances::COMPTES);
        $donnees = $requete->validate([
            'source' => ['required', Rule::in($comptes), 'different:destination'],
            'destination' => ['required', Rule::in($comptes)],
            'montant' => ['required', 'integer', 'min:1'],
        ], ['source.different' => 'Choisissez deux comptes différents.']);

        $solde = ControleurFinances::soldes()[$donnees['source']];
        if ($donnees['montant'] > $solde) {
            return response()->json(['erreur' => 'Le compte '.ControleurFinances::COMPTES[$donnees['source']].' n’a que '.number_format($solde, 0, ',', ' ').' F.'], 422);
        }

        $transfert = TransfertAdmin::create([
            'admin_id' => $requete->user()->id,
            'compte_source' => $donnees['source'],
            'compte_destination' => $donnees['destination'],
            'montant' => $donnees['montant'],
        ]);

        return response()->json(['message' => 'Transfert enregistré', 'transfert' => $transfert], 201);
    }
}
