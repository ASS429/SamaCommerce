<?php

namespace App\Http\Controllers;

use App\Http\Resources\RessourceProduit;
use App\Models\Produit;
use Illuminate\Http\Request;

class ControleurProduit extends Controleur
{
    public function lister(Request $requete)
    {
        $selection = $requete->user()->produits()->with('conditionnements');
        $selection->orderByDesc('id');

        // T9 — pagination sur demande (?page=N) ; sinon tableau complet (rétro-compatible).
        if ($requete->filled('page')) {
            $pagination = $selection->paginate((int) $requete->integer('par_page', 30));
            $pagination->setCollection($pagination->getCollection()->map(fn ($p) => (new RessourceProduit($p))->resolve($requete)));

            return $pagination; // T8 — enveloppe de pagination conservée, éléments normalisés
        }

        return RessourceProduit::collection($selection->get());
    }

    public function afficher(Request $requete, int $id)
    {
        return new RessourceProduit($requete->user()->produits()->with('conditionnements')->findOrFail($id));
    }

    public function creer(Request $requete)
    {
        $donnees = $this->valider($requete);

        $produit = $requete->user()->produits()->create([
            'nom' => $donnees['nom'],
            'boutique_id' => $requete->user()->boutique_active_id,
            'categorie_id' => $donnees['categorie_id'] ?? null,
            'description' => $donnees['description'] ?? null,
            'code_barres' => $donnees['code_barres'] ?? null,
            'prix_vente' => $donnees['prix_vente'] ?? 0,
            'prix_achat' => $donnees['prix_achat'] ?? 0,
            'stock' => $donnees['stock'] ?? 0,
            'unite_base' => $donnees['unite_base'] ?? 'piece',
            'prix_min' => $donnees['prix_min'] ?? null,
            'negociable' => $donnees['negociable'] ?? null,
            'photo' => $donnees['photo'] ?? null,
        ]);

        $this->remplacerConditionnements($produit, $donnees['conditionnements'] ?? null);

        \App\Models\JournalActivite::consigner($requete, 'produit.ajout', $produit->nom);

        return (new RessourceProduit($produit->load('conditionnements')))->response()->setStatusCode(201);
    }

    public function modifier(Request $requete, int $id)
    {
        $produit = $requete->user()->produits()->findOrFail($id);
        $donnees = $this->valider($requete, true);

        $produit->update(collect($donnees)->except('conditionnements')->all());
        $this->remplacerConditionnements($produit, $donnees['conditionnements'] ?? null);

        return new RessourceProduit($produit->load('conditionnements'));
    }

    public function supprimer(Request $requete, int $id)
    {
        $produit = $requete->user()->produits()->findOrFail($id);
        \App\Models\JournalActivite::consigner($requete, 'produit.suppr', $produit->nom);
        $produit->delete(); // T4 — corbeille

        return response()->json(['message' => 'Produit supprimé']);
    }

    /** T4 — Corbeille : produits supprimés (récupérables). */
    public function corbeille(Request $requete)
    {
        return RessourceProduit::collection(
            $requete->user()->produits()->onlyTrashed()->with('conditionnements')->orderByDesc('supprime_le')->get()
        );
    }

    /** T4 — Restaure un produit supprimé. */
    public function restaurer(Request $requete, int $id)
    {
        $produit = $requete->user()->produits()->onlyTrashed()->findOrFail($id);
        $produit->restore();
        \App\Models\JournalActivite::consigner($requete, 'produit.restaure', $produit->nom);

        return new RessourceProduit($produit->load('conditionnements'));
    }

    private function valider(Request $requete, bool $partiel = false): array
    {
        $regle = $partiel ? 'sometimes' : 'nullable';

        return $requete->validate([
            'nom' => [$partiel ? 'sometimes' : 'required', 'string', 'max:255'],
            // S4 — la catégorie doit appartenir au propriétaire (pas de fuite entre commerçants).
            'categorie_id' => ['nullable', 'integer', $this->existeChezProprietaire($requete, 'categories')],
            'description' => ['nullable', 'string'],
            'code_barres' => ['nullable', 'string', 'max:64'],
            'prix_vente' => [$regle, 'numeric', 'min:0'],
            'prix_achat' => [$regle, 'numeric', 'min:0'],
            'stock' => [$regle, 'integer', 'min:0'],
            'unite_base' => ['nullable', 'in:piece,g,ml'],
            'prix_min' => ['nullable', 'integer', 'min:0'],
            'negociable' => ['nullable', 'boolean'],
            'photo' => self::REGLES_PHOTO,
            'conditionnements' => ['nullable', 'array'],
            'conditionnements.*.libelle' => ['required_with:conditionnements', 'string', 'max:64'],
            'conditionnements.*.facteur' => ['required_with:conditionnements', 'integer', 'min:1'],
            'conditionnements.*.prix' => ['required_with:conditionnements', 'integer', 'min:0'],
        ]);
    }

    /** Remplace les conditionnements de gros du produit (null = ne pas toucher). */
    private function remplacerConditionnements(Produit $produit, ?array $conditionnements): void
    {
        if ($conditionnements === null) {
            return;
        }
        $produit->conditionnements()->delete();
        foreach ($conditionnements as $c) {
            $produit->conditionnements()->create([
                'libelle' => $c['libelle'],
                'facteur' => (int) $c['facteur'],
                'prix' => (int) $c['prix'],
            ]);
        }
    }
}
