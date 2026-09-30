<?php

namespace App\Http\Controllers;

use App\Models\Commande;
use App\Models\LigneCommande;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ControleurCommande extends Controleur
{
    public function lister(Request $requete)
    {
        /* Les colonnes sont choisies AVANT `withCount` : celui-ci remplit la
           sélection dès qu'elle est vide (`commandes.*` + le compte), et les
           colonnes passées ensuite à `get()` étaient ignorées. Le nom et le
           téléphone du fournisseur ne sont ainsi jamais remontés jusqu'au
           30/09/2026 : la liste affichait « Sans fournisseur » partout. */
        return Commande::where('commandes.utilisateur_id', $requete->user()->id)
            ->leftJoin('fournisseurs', 'fournisseurs.id', '=', 'commandes.fournisseur_id')
            ->select(['commandes.*', 'fournisseurs.nom as nom_fournisseur', 'fournisseurs.telephone as telephone_fournisseur'])
            ->withCount('lignes as nb_lignes')
            ->orderByDesc('commandes.cree_le')
            ->get();
    }

    public function afficher(Request $requete, int $id)
    {
        $commande = Commande::where('utilisateur_id', $requete->user()->id)->with(['fournisseur', 'lignes.produit:id,nom,stock'])->findOrFail($id);

        return $commande;
    }

    public function creer(Request $requete)
    {
        $donnees = $requete->validate([
            // S4 — fournisseur et produits doivent appartenir au propriétaire.
            'fournisseur_id' => ['nullable', 'integer', $this->existeChezProprietaire($requete, 'fournisseurs')],
            'notes' => ['nullable', 'string'],
            'date_prevue' => ['nullable', 'date'],
            'lignes' => ['required', 'array', 'min:1'],
            'lignes.*.produit_id' => ['required', 'integer', $this->existeChezProprietaire($requete, 'produits')],
            'lignes.*.quantite' => ['required', 'integer', 'min:1'],
            'lignes.*.prix_unitaire' => ['required', 'numeric', 'min:0'],
        ]);

        return DB::transaction(function () use ($requete, $donnees) {
            $total = collect($donnees['lignes'])->sum(fn ($l) => $l['quantite'] * $l['prix_unitaire']);
            $commande = Commande::create([
                'utilisateur_id' => $requete->user()->id,
                'boutique_id' => $requete->user()->boutique_active_id,
                'fournisseur_id' => $donnees['fournisseur_id'] ?? null,
                'total' => $total, 'notes' => $donnees['notes'] ?? null,
                'date_prevue' => $donnees['date_prevue'] ?? null, 'statut' => 'en_attente',
            ]);
            foreach ($donnees['lignes'] as $ligne) {
                LigneCommande::create(['commande_id' => $commande->id] + $ligne);
            }

            return response()->json($commande->load('lignes'), 201);
        });
    }

    public function modifier(Request $requete, int $id)
    {
        $commande = Commande::where('utilisateur_id', $requete->user()->id)->findOrFail($id);
        $commande->update($requete->validate([
            'statut' => ['sometimes', 'in:en_attente,recue'],
            'notes' => ['nullable', 'string'],
            'date_prevue' => ['nullable', 'date'],
            'fournisseur_id' => ['nullable', 'integer', $this->existeChezProprietaire($requete, 'fournisseurs')],
        ]));

        return $commande;
    }

    /** Réception : recrédite le stock des produits commandés et passe en « reçue ». */
    public function recevoir(Request $requete, int $id)
    {
        return DB::transaction(function () use ($requete, $id) {
            $commande = Commande::where('utilisateur_id', $requete->user()->id)->with('lignes')->findOrFail($id);
            foreach ($commande->lignes as $ligne) {
                $requete->user()->produits()->where('id', $ligne->produit_id)->increment('stock', $ligne->quantite);
            }
            $commande->update(['statut' => 'recue']);

            return response()->json(['commande' => $commande, 'message' => "Stock mis à jour pour {$commande->lignes->count()} produit(s)"]);
        });
    }

    public function supprimer(Request $requete, int $id)
    {
        Commande::where('utilisateur_id', $requete->user()->id)->findOrFail($id)->delete();

        return response()->json(['message' => 'Commande supprimée']);
    }
}
