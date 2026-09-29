<?php

namespace App\Http\Controllers;

use App\Models\Tontine;
use Illuminate\Http\Request;

class ControleurTontine extends Controleur
{
    public function lister()
    {
        return Tontine::orderByDesc('date_creation')->get();
    }

    public function creer(Request $requete)
    {
        $donnees = $requete->validate([
            'nom' => ['required', 'string', 'max:255'],
            'type' => ['nullable', 'string', 'max:255'],
            'montant' => ['nullable', 'numeric', 'min:0'],
            'membres' => ['nullable', 'integer', 'min:0'],
        ]);

        return response()->json(Tontine::create($donnees), 201);
    }
}
