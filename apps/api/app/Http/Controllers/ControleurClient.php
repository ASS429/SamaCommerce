<?php

namespace App\Http\Controllers;

use App\Models\Client;
use App\Models\Vente;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class ControleurClient extends Controleur
{
    /** Liste légère pour l'autocomplétion de la vente. */
    public function pourVente(Request $requete)
    {

        return $requete->user()->clients()
            ->orderBy('nom')->get(['id', 'nom', 'telephone']);
    }

    public function lister(Request $requete)
    {
        $proprietaireId = $requete->user()->id;
        $clients = Client::where('utilisateur_id', $proprietaireId)
            ->get();

        // Ventes du commerçant (liées par client_id OU par nom)
        $ventes = Vente::where('utilisateur_id', $proprietaireId)->get(['client_id', 'nom_client', 'total', 'paye', 'cree_le']);

        $resultat = $clients->map(function (Client $c) use ($ventes) {
            $siennes = $ventes->filter(fn ($v) => $v->client_id === $c->id || ($v->client_id === null && $v->nom_client === $c->nom));
            return array_merge($c->toArray(), [
                'nb_achats' => $siennes->count(),
                'total_achats' => (float) $siennes->sum('total'),
                'credits_ouverts' => $siennes->where('paye', false)->count(),
                'montant_credits' => (float) $siennes->where('paye', false)->sum('total'),
            ]);
        })->sortByDesc('total_achats')->values();

        // T9 — pagination sur demande (les agrégats étant calculés en PHP, on pagine la collection).
        if ($requete->filled('page')) {
            $parPage = (int) $requete->integer('par_page', 30);
            $page = max(1, (int) $requete->integer('page', 1));

            return response()->json([
                'data' => $resultat->forPage($page, $parPage)->values(),
                'current_page' => $page,
                'last_page' => (int) max(1, ceil($resultat->count() / $parPage)),
                'total' => $resultat->count(),
            ]);
        }

        return $resultat;
    }

    public function afficher(Request $requete, int $id)
    {
        $client = $requete->user()->clients()->findOrFail($id);

        $achats = Vente::where('ventes.utilisateur_id', $requete->user()->id)
            ->where(fn ($q) => $q->where('ventes.client_id', $client->id)
                ->orWhere(fn ($q2) => $q2->whereNull('ventes.client_id')->where('ventes.nom_client', $client->nom)))
            ->leftJoin('produits', 'produits.id', '=', 'ventes.produit_id')
            ->orderByDesc('ventes.cree_le')
            ->get(['ventes.*', 'produits.nom as nom_produit']);

        return array_merge($client->toArray(), ['achats' => $achats]);
    }

    public function creer(Request $requete)
    {
        $donnees = $requete->validate([
            'nom' => ['required', 'string', 'max:255'],
            'telephone' => ['nullable', 'string', 'max:32'],
            'email' => ['nullable', 'string', 'max:255'],
            'adresse' => ['nullable', 'string'],
            'notes' => ['nullable', 'string'],
            'photo' => self::REGLES_PHOTO,
        ]);

        $existe = $requete->user()->clients()->whereRaw('LOWER(nom) = ?', [mb_strtolower($donnees['nom'])])->exists();
        if ($existe) {
            return response()->json(['erreur' => "Un client nommé « {$donnees['nom']} » existe déjà"], 400);
        }

        $client = $requete->user()->clients()->create(array_merge($donnees, [
            'boutique_id' => $requete->user()->boutique_active_id,
        ]));

        // Rattache les ventes existantes au même nom
        Vente::where('utilisateur_id', $requete->user()->id)->whereNull('client_id')
            ->where('nom_client', $donnees['nom'])->update(['client_id' => $client->id]);

        return response()->json($client, 201);
    }

    public function modifier(Request $requete, int $id)
    {
        $client = $requete->user()->clients()->findOrFail($id);
        $client->update($requete->validate([
            'nom' => ['sometimes', 'string', 'max:255'],
            'telephone' => ['nullable', 'string', 'max:32'],
            'email' => ['nullable', 'string', 'max:255'],
            'adresse' => ['nullable', 'string'],
            'notes' => ['nullable', 'string'],
            'photo' => self::REGLES_PHOTO,
        ]));

        return $client;
    }

    public function supprimer(Request $requete, int $id)
    {
        $client = $requete->user()->clients()->findOrFail($id);
        Vente::where('client_id', $client->id)->update(['client_id' => null]);
        $client->delete();

        return response()->json(['message' => 'Client supprimé']);
    }

    public function statistiques(Request $requete, int $id)
    {
        $client = $requete->user()->clients()->findOrFail($id);
        $ventes = Vente::where('utilisateur_id', $requete->user()->id)
            ->where(fn ($q) => $q->where('client_id', $client->id)
                ->orWhere(fn ($q2) => $q2->whereNull('client_id')->where('nom_client', $client->nom)))
            ->get();

        return response()->json([
            'nb_achats' => $ventes->count(),
            'ca_total' => (float) $ventes->sum('total'),
            'ca_encaisse' => (float) $ventes->where('paye', true)->sum('total'),
            'credits_ouverts' => (float) $ventes->where('paye', false)->sum('total'),
            'achats_30j' => $ventes->where('cree_le', '>=', Carbon::now()->subDays(30))->count(),
            'dernier_achat' => $ventes->max('cree_le'),
        ]);
    }
}
