<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controleur;
use App\Models\Retrait;
use Illuminate\Http\Request;

class ControleurRetraits extends Controleur
{
    public function lister(Request $requete)
    {
        return Retrait::where('admin_id', $requete->user()->id)->orderByDesc('cree_le')->get();
    }

    public function creer(Request $requete)
    {
        $donnees = $requete->validate([
            'montant' => ['required', 'numeric', 'min:0'],
            'moyen' => ['required', 'string'],
        ]);

        $retrait = Retrait::create([
            'admin_id' => $requete->user()->id,
            'montant' => $donnees['montant'],
            'moyen' => $donnees['moyen'],
            'statut' => 'validé',
        ]);

        return response()->json(['message' => 'Demande de retrait enregistrée', 'retrait' => $retrait], 201);
    }
}
