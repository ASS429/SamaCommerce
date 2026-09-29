<?php

namespace App\Http\Controllers;

use App\Models\LigneCommande;
use App\Models\Livraison;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class ControleurLivraison extends Controleur
{
    public function lister(Request $requete)
    {
        return Livraison::where('livraisons.utilisateur_id', $requete->user()->id)
            ->leftJoin('commandes', 'commandes.id', '=', 'livraisons.commande_id')
            ->leftJoin('fournisseurs', 'fournisseurs.id', '=', 'commandes.fournisseur_id')
            ->orderByDesc('livraisons.cree_le')
            ->get([
                'livraisons.*',
                'commandes.statut as statut_commande',
                'commandes.total as total_commande',
                'commandes.date_prevue',
                'fournisseurs.nom as nom_fournisseur',
                // Le suivi se fait par WhatsApp : le numéro doit remonter avec la ligne.
                'fournisseurs.telephone as telephone_fournisseur',
            ]);
    }

    public function afficher(Request $requete, int $id)
    {
        $livraison = Livraison::where('utilisateur_id', $requete->user()->id)->with('commande.fournisseur')->findOrFail($id);
        $lignes = $livraison->commande_id
            ? LigneCommande::where('commande_id', $livraison->commande_id)
                ->leftJoin('produits', 'produits.id', '=', 'lignes_commande.produit_id')
                ->get(['lignes_commande.*', 'produits.nom as nom_produit'])
            : [];

        return array_merge($livraison->toArray(), ['lignes' => $lignes]);
    }

    public function creer(Request $requete)
    {
        $donnees = $requete->validate([
            'commande_id' => ['nullable', 'integer'],
            'note_suivi' => ['nullable', 'string'],
        ]);

        if (! empty($donnees['commande_id'])) {
            $requete->user()->commandes()->findOrFail($donnees['commande_id']);
        }

        $livraison = Livraison::create([
            'utilisateur_id' => $requete->user()->id,
            'boutique_id' => $requete->user()->boutique_active_id,
            'commande_id' => $donnees['commande_id'] ?? null,
            'note_suivi' => $donnees['note_suivi'] ?? null,
            'statut' => 'en_attente',
        ]);

        return response()->json($livraison, 201);
    }

    public function modifier(Request $requete, int $id)
    {
        $livraison = Livraison::where('utilisateur_id', $requete->user()->id)->findOrFail($id);

        $donnees = $requete->validate([
            'statut' => ['sometimes', 'in:en_attente,en_cours,livree'],
            'note_suivi' => ['nullable', 'string'],
            'livree_le' => ['nullable', 'date'],
            // Réceptionner la commande liée dans le même geste (voir plus bas).
            'recevoir' => ['nullable', 'boolean'],
        ]);

        $livree = ($donnees['statut'] ?? null) === 'livree';

        // Date automatique à la livraison
        if ($livree && empty($donnees['livree_le'])) {
            $donnees['livree_le'] = Carbon::now();
        }

        $livraison->update(collect($donnees)->except('recevoir')->all());

        /* Le suivi de livraison et la réception de commande étaient deux gestes
         * sans lien : on pouvait marquer « Livrée » sans que le stock bouge, et
         * le commerçant se demandait pourquoi ses quantités ne montaient pas.
         * Désormais, marquer livrée signale la commande à réceptionner — et
         * `recevoir: true` fait les deux d'un coup (stock incrémenté). */
        $commande = $livraison->commande_id
            ? $requete->user()->commandes()->with('lignes')->find($livraison->commande_id)
            : null;
        $aRecevoir = $livree && $commande && $commande->statut !== 'recue';

        if ($aRecevoir && $requete->boolean('recevoir')) {
            DB::transaction(function () use ($requete, $commande) {
                foreach ($commande->lignes as $ligne) {
                    $requete->user()->produits()->where('id', $ligne->produit_id)->increment('stock', $ligne->quantite);
                }
                $commande->update(['statut' => 'recue']);
            });

            return array_merge($livraison->fresh()->toArray(), [
                'commande_recue' => true,
                'message' => "Livraison enregistrée et stock mis à jour pour {$commande->lignes->count()} produit(s)",
            ]);
        }

        return array_merge($livraison->fresh()->toArray(), [
            // L'interface propose alors « Ajouter au stock » sur la fiche livraison.
            'commande_a_recevoir' => $aRecevoir ? $commande->id : null,
        ]);
    }

    public function supprimer(Request $requete, int $id)
    {
        Livraison::where('utilisateur_id', $requete->user()->id)->findOrFail($id)->delete();

        return response()->json(['message' => 'Livraison supprimée']);
    }
}
