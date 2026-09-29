<?php

namespace App\Http\Controllers;

use App\Http\Resources\RessourceCategorie;
use Illuminate\Http\Request;

class ControleurCategorie extends Controleur
{
    public function lister(Request $requete)
    {
        return RessourceCategorie::collection($requete->user()->categories()->orderBy('id')->get());
    }

    public function creer(Request $requete)
    {
        $donnees = $requete->validate([
            'nom' => ['required', 'string', 'max:255'],
            'emoji' => ['nullable', 'string', 'max:16'],
            'couleur' => ['nullable', 'string', 'max:32'],
            'negociable' => ['nullable', 'boolean'],
        ]);

        $categorie = $requete->user()->categories()->create([
            'nom' => trim($donnees['nom']),
            'emoji' => $donnees['emoji'] ?? '🏷️',
            'couleur' => $donnees['couleur'] ?? null,
            'negociable' => $donnees['negociable'] ?? false,
        ]);

        return (new RessourceCategorie($categorie))->response()->setStatusCode(201);
    }

    public function modifier(Request $requete, int $id)
    {
        $categorie = $requete->user()->categories()->findOrFail($id);
        $categorie->update($requete->validate([
            'nom' => ['sometimes', 'string', 'max:255'],
            'emoji' => ['nullable', 'string', 'max:16'],
            'couleur' => ['nullable', 'string', 'max:32'],
            'negociable' => ['nullable', 'boolean'],
        ]));

        return new RessourceCategorie($categorie);
    }

    public function supprimer(Request $requete, int $id)
    {
        $categorie = $requete->user()->categories()->findOrFail($id);

        if ($categorie->produits()->count() > 0) {
            return response()->json(['erreur' => 'Impossible de supprimer : catégorie avec produits.'], 400);
        }

        $categorie->delete();

        return response()->json(['succes' => true, 'message' => 'Catégorie supprimée avec succès']);
    }
}
