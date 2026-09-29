<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controleur;
use App\Models\TransfertAdmin;
use Illuminate\Http\Request;

class ControleurTransferts extends Controleur
{
    public function lister(Request $requete)
    {
        return TransfertAdmin::where('admin_id', $requete->user()->id)->orderByDesc('cree_le')->get();
    }

    public function creer(Request $requete)
    {
        $donnees = $requete->validate([
            'source' => ['required', 'string', 'different:destination'],
            'destination' => ['required', 'string'],
            'montant' => ['required', 'numeric', 'min:0'],
        ]);

        $transfert = TransfertAdmin::create([
            'admin_id' => $requete->user()->id,
            'compte_source' => $donnees['source'],
            'compte_destination' => $donnees['destination'],
            'montant' => $donnees['montant'],
        ]);

        return response()->json(['message' => 'Transfert enregistré', 'transfert' => $transfert], 201);
    }
}
