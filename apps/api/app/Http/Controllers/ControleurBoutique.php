<?php

namespace App\Http\Controllers;

use App\Models\Boutique;
use App\Models\MembreBoutique;
use App\Models\Produit;
use App\Models\Scopes\CloisonnementBoutique;
use App\Models\Vente;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class ControleurBoutique extends Controleur
{
    public function lister(Request $requete)
    {
        $proprietaire = $requete->user();

        // Cette liste compte les articles et ventes de CHAQUE boutique, y compris
        // celles qui ne sont pas actives : le cloisonnement est levé sciemment.
        return $proprietaire->boutiques()->orderByDesc('est_principale')->orderBy('cree_le')->get()
            ->map(fn (Boutique $b) => array_merge($b->toArray(), [
                'nb_produits' => Produit::withoutGlobalScope(CloisonnementBoutique::class)->where('boutique_id', $b->id)->count(),
                'nb_ventes' => Vente::withoutGlobalScope(CloisonnementBoutique::class)->where('boutique_id', $b->id)->count(),
                'nb_membres' => MembreBoutique::where('boutique_rattachement_id', $b->id)->where('statut', 'acceptee')->count(),
            ]));
    }

    /**
     * Tableau de bord MULTI-BOUTIQUE : une ligne par point de vente, plus le
     * consolidé.
     *
     * C'est le seul écran qui regarde volontairement par-dessus le
     * cloisonnement — d'où les `withoutGlobalScope` explicites. Un commerçant
     * qui tient deux boutiques veut comparer ses points de vente sans devoir
     * basculer de l'un à l'autre et retenir les chiffres de tête.
     */
    public function tableauDeBord(Request $requete)
    {
        $proprietaire = $requete->user();
        $boutiques = $proprietaire->boutiques()->orderByDesc('est_principale')->orderBy('cree_le')->get();
        $aujourdhui = Carbon::today();
        $debutMois = Carbon::today()->startOfMonth();

        $lignes = $boutiques->map(function (Boutique $b) use ($aujourdhui, $debutMois) {
            $ventes = fn () => Vente::withoutGlobalScope(CloisonnementBoutique::class)->where('boutique_id', $b->id);
            $produits = Produit::withoutGlobalScope(CloisonnementBoutique::class)->where('boutique_id', $b->id);

            $duJour = (clone $ventes())->whereDate('cree_le', $aujourdhui)->get();
            $duMois = (clone $ventes())->where('cree_le', '>=', $debutMois)->where('paye', true)->sum('total');

            return [
                'id' => $b->id,
                'nom' => $b->nom,
                'emoji' => $b->emoji,
                'photo' => $b->photo,
                'est_principale' => (bool) $b->est_principale,
                'ca_jour' => (int) $duJour->where('paye', true)->sum('total'),
                'nb_ventes_jour' => $duJour->count(),
                'ca_mois' => (int) $duMois,
                'nb_produits' => (clone $produits)->count(),
                'stock_total' => (int) (clone $produits)->sum('stock'),
                'ruptures' => (clone $produits)->where('stock', '<=', 0)->count(),
                'stock_faible' => (clone $produits)->where('stock', '>', 0)->where('stock', '<=', 5)->count(),
                'credits_impayes' => (int) (clone $ventes())->where('moyen_paiement', 'credit')->where('paye', false)->sum('total'),
                'nb_membres' => MembreBoutique::where('boutique_rattachement_id', $b->id)->where('statut', 'acceptee')->count(),
            ];
        });

        return response()->json([
            'boutiques' => $lignes,
            'total' => [
                'ca_jour' => (int) $lignes->sum('ca_jour'),
                'nb_ventes_jour' => (int) $lignes->sum('nb_ventes_jour'),
                'ca_mois' => (int) $lignes->sum('ca_mois'),
                'nb_produits' => (int) $lignes->sum('nb_produits'),
                'ruptures' => (int) $lignes->sum('ruptures'),
                'credits_impayes' => (int) $lignes->sum('credits_impayes'),
                'nb_boutiques' => $lignes->count(),
            ],
            // La meilleure du jour : le seul classement qui intéresse au comptoir.
            'meilleure' => $lignes->sortByDesc('ca_jour')->first(),
        ]);
    }

    public function creer(Request $requete)
    {
        $donnees = $requete->validate([
            'nom' => ['required', 'string', 'max:255'],
            'telephone' => ['nullable', 'string', 'max:32'],
            'adresse' => ['nullable', 'string'],
            'emoji' => ['nullable', 'string', 'max:8'],
            'photo' => self::REGLES_PHOTO,
        ]);

        $proprietaire = $requete->user();
        // Limite du plan qui s'applique (essai et délai de grâce compris).
        \App\Services\Abonnements::exigerPlace($proprietaire, 'boutiques', $proprietaire->boutiques()->count(),
            'LIMITE_BOUTIQUES_ATTEINTE', fn (int $limite, $plan) => "Le plan {$plan->nom} permet au maximum {$limite} boutique(s).");

        $boutique = $proprietaire->boutiques()->create([
            'nom' => $donnees['nom'], 'telephone' => $donnees['telephone'] ?? null,
            'adresse' => $donnees['adresse'] ?? null, 'emoji' => $donnees['emoji'] ?? '🏪', 'est_principale' => false,
        ]);

        return response()->json($boutique, 201);
    }

    public function modifier(Request $requete, int $id)
    {
        $boutique = $requete->user()->boutiques()->findOrFail($id);
        $boutique->update($requete->validate([
            'nom' => ['sometimes', 'string', 'max:255'],
            'telephone' => ['nullable', 'string', 'max:32'],
            'adresse' => ['nullable', 'string'],
            'emoji' => ['nullable', 'string', 'max:8'],
            'photo' => self::REGLES_PHOTO,
        ]));

        if ($boutique->est_principale && $requete->filled('nom')) {
            $requete->user()->update(['nom_commerce' => $requete->input('nom')]);
        }

        return $boutique;
    }

    public function supprimer(Request $requete, int $id)
    {
        $boutique = $requete->user()->boutiques()->findOrFail($id);
        if ($boutique->est_principale) {
            return response()->json(['erreur' => 'Impossible de supprimer la boutique principale'], 400);
        }
        $boutique->delete();

        return response()->json(['message' => 'Boutique supprimée']);
    }

    /** Change la boutique active du propriétaire. */
    public function activer(Request $requete, int $id)
    {
        $boutique = $requete->user()->boutiques()->findOrFail($id);
        $requete->user()->update(['boutique_active_id' => $boutique->id]);

        return response()->json(['message' => 'Boutique active changée', 'boutique' => $boutique]);
    }

    public function statistiques(Request $requete, int $id)
    {
        $boutique = $requete->user()->boutiques()->findOrFail($id);

        /* On interroge une AUTRE boutique que l'active : il faut donc lever
         * explicitement le cloisonnement, sinon les deux conditions se
         * cumulent (`boutique_id = active AND boutique_id = demandée`) et tous
         * les compteurs des autres boutiques tombent à zéro. */
        $sansCloison = fn (string $modele) => $modele::withoutGlobalScope(CloisonnementBoutique::class)->where('boutique_id', $boutique->id);

        return response()->json([
            'boutique_id' => $boutique->id,
            'nb_produits' => $sansCloison(Produit::class)->count(),
            'nb_ventes' => $sansCloison(Vente::class)->count(),
            'ca_total' => (float) $sansCloison(Vente::class)->where('paye', true)->sum('total'),
            'nb_membres' => MembreBoutique::where('boutique_rattachement_id', $boutique->id)->where('statut', 'acceptee')->count(),
        ]);
    }
}
