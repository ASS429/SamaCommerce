<?php

namespace App\Http\Controllers;

use App\Models\JournalActivite;
use Illuminate\Http\Request;

class ControleurActivite extends Controleur
{
    /** Journal d'activité du propriétaire (50 dernières actions), boutique courante. */
    public function lister(Request $requete)
    {
        $selection = JournalActivite::where('proprietaire_id', $requete->user()->id);

        $selection->orderByDesc('id');

        // T9 — pagination sur demande (?page=N) ; sinon les 50 dernières (rétro-compatible).
        if ($requete->filled('page')) {
            return $selection->paginate((int) $requete->integer('par_page', 30));
        }

        return $selection->limit(50)->get();
    }
}
