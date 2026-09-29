<?php

namespace App\Http\Controllers;

use App\Http\Resources\RessourceVente;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ControleurVente extends Controleur
{
    /** Liste des ventes du propriétaire, avec le nom du produit.
     *  Avec ?page=N : renvoie une page paginée {data, current_page, last_page, total} ;
     *  sinon : renvoie le tableau complet (rétro-compatible). */
    public function lister(Request $requete)
    {
        $selection = $requete->user()->ventes()
            ->select('ventes.*', 'produits.nom as nom_produit')
            ->join('produits', 'produits.id', '=', 'ventes.produit_id')
            ->orderByDesc('ventes.cree_le');

        if ($requete->filled('page')) {
            $pagination = $selection->paginate((int) $requete->integer('par_page', 20));
            $pagination->setCollection($pagination->getCollection()->map(fn ($v) => (new RessourceVente($v))->resolve($requete)));

            return $pagination; // T8 — enveloppe de pagination conservée, éléments normalisés
        }

        return RessourceVente::collection($selection->get());
    }

    /** Règles de validation d'une vente (partagées entre creer et synchroniser). */
    private function reglesVente(): array
    {
        return [
            'produit_id' => ['required', 'integer'],
            'conditionnement_id' => ['nullable', 'integer'],    // conditionnement de gros (null = détail)
            'quantite_base' => ['nullable', 'integer', 'min:1'], // quantité en unités de base (g/ml/pièce)
            'quantite' => ['nullable', 'integer', 'min:1'],      // historique : nb d'unités de vente
            'prix_reel' => ['nullable', 'integer', 'min:0'],     // prix négocié (FCFA / unité choisie)
            'moyen_paiement' => ['required', 'string'],
            // Rattachement au FICHIER clients : sans lui, l'historique d'achat et
            // le score de crédit se reconstruisent à partir du nom écrit, donc
            // « Awa », « awa » et « Awa Ndiaye » comptent pour trois personnes.
            'client_id' => ['nullable', 'integer'],
            'nom_client' => ['nullable', 'string', 'max:255'],
            'telephone_client' => ['nullable', 'string', 'max:32'],
            'date_echeance' => ['nullable', 'date'],
            'uuid_appareil' => ['nullable', 'uuid'], // T11 — idempotence hors ligne
        ];
    }

    public function creer(Request $requete)
    {
        $donnees = $requete->validate($this->reglesVente());
        $resultat = $this->enregistrerVente($requete, $donnees);

        if ($resultat['corps'] instanceof \App\Models\Vente) {
            return (new RessourceVente($resultat['corps']))->response()->setStatusCode($resultat['statut']);
        }

        return response()->json($resultat['corps'], $resultat['statut']);
    }

    /**
     * T11 — Synchronisation d'un lot de ventes réalisées hors ligne. IDEMPOTENTE :
     * chaque vente porte un uuid_appareil ; une vente déjà connue est ignorée
     * (jamais de doublon). Renvoie le détail par vente pour que le client purge
     * sa file locale.
     */
    public function synchroniser(Request $requete)
    {
        $charge = $requete->validate([
            'ventes' => ['required', 'array', 'min:1', 'max:100'],
            'ventes.*' => ['array'],
        ]);

        $synchronisees = [];
        $doublons = [];
        $echecs = [];

        foreach ($charge['ventes'] as $brute) {
            $uuid = $brute['uuid_appareil'] ?? null;
            $validateur = validator($brute, $this->reglesVente());
            if ($validateur->fails()) {
                $echecs[] = ['uuid_appareil' => $uuid, 'erreur' => $validateur->errors()->first()];
                continue;
            }

            try {
                $res = $this->enregistrerVente($requete, $validateur->validated());
                if ($res['statut'] === 201) {
                    $synchronisees[] = $uuid;
                } elseif (! empty($res['doublon'])) {
                    $doublons[] = $uuid;
                } else {
                    $echecs[] = ['uuid_appareil' => $uuid, 'erreur' => $res['corps']['erreur'] ?? 'Échec'];
                }
            } catch (\Throwable $e) {
                $echecs[] = ['uuid_appareil' => $uuid, 'erreur' => 'Produit introuvable ou données invalides'];
            }
        }

        static::perimerStatistiques($requete->user()->id);

        return response()->json([
            'synchronisees' => $synchronisees,
            'doublons' => $doublons, // déjà enregistrées : à purger côté client aussi
            'echecs' => $echecs,
        ]);
    }

    /**
     * Rattache la vente au FICHIER clients et renvoie [id, nom, téléphone].
     *
     * Trois cas, du plus fiable au moins fiable :
     *  1. `client_id` fourni → on vérifie qu'il appartient au commerçant (S4).
     *  2. Un nom est saisi et correspond déjà à une fiche → on la réutilise.
     *  3. Vente à CRÉDIT avec un nom inconnu → on CRÉE la fiche.
     *     Une dette doit toujours pointer vers quelqu'un d'identifié : c'est ce
     *     qui rend l'historique et le score de crédit exploitables. Les ventes
     *     comptant, elles, restent anonymes si le commerçant ne saisit rien.
     */
    private function resoudreClient(Request $requete, array $donnees): array
    {
        $proprietaire = $requete->user();
        $nom = trim((string) ($donnees['nom_client'] ?? ''));
        $telephone = $donnees['telephone_client'] ?? null;

        if (! empty($donnees['client_id'])) {
            $client = $proprietaire->clients()->find($donnees['client_id']);
            if ($client) {
                return [$client->id, $client->nom, $client->telephone ?: $telephone];
            }
        }

        if ($nom === '') {
            return [null, null, $telephone];
        }

        $existant = $proprietaire->clients()->whereRaw('LOWER(nom) = ?', [mb_strtolower($nom)])->first();
        if ($existant) {
            return [$existant->id, $existant->nom, $existant->telephone ?: $telephone];
        }

        if (($donnees['moyen_paiement'] ?? null) === 'credit') {
            $cree = $proprietaire->clients()->create([
                'nom' => $nom,
                'telephone' => $telephone,
                'boutique_id' => $proprietaire->boutique_active_id,
            ]);

            return [$cree->id, $cree->nom, $cree->telephone];
        }

        return [null, $nom, $telephone];
    }

    /**
     * Enregistre une vente (logique commune à creer et synchroniser). Renvoie
     * ['statut' => int, 'corps' => mixed, 'doublon' => bool].
     */
    private function enregistrerVente(Request $requete, array $donnees): array
    {
        // Idempotence : une vente déjà synchronisée (même uuid_appareil) est ignorée.
        if (! empty($donnees['uuid_appareil'])) {
            $existante = $requete->user()->ventes()->where('uuid_appareil', $donnees['uuid_appareil'])->first();
            if ($existante) {
                return ['statut' => 200, 'corps' => $existante, 'doublon' => true];
            }
        }

        return DB::transaction(function () use ($requete, $donnees) {
            $produit = $requete->user()->produits()->lockForUpdate()->findOrFail($donnees['produit_id']);
            $facteurAffichage = $produit->facteurAffichage();

            // Unité de vente : conditionnement de gros, sinon unité de détail (kg/L/pièce)
            if (! empty($donnees['conditionnement_id'])) {
                $conditionnement = \App\Models\Conditionnement::where('produit_id', $produit->id)->findOrFail($donnees['conditionnement_id']);
                $facteur = $conditionnement->facteur; $reference = $conditionnement->prix; $libelle = $conditionnement->libelle; $conditionnementId = $conditionnement->id;
            } else {
                $facteur = $facteurAffichage; $reference = (int) round((float) $produit->prix_vente); $libelle = $produit->libelleAffichage(); $conditionnementId = null;
            }

            // Quantité en unités de base (rétro-compat : quantite × facteur)
            $qb = $donnees['quantite_base'] ?? (($donnees['quantite'] ?? 1) * $facteur);
            if ($produit->stock < $qb) {
                return ['statut' => 400, 'corps' => ['erreur' => 'Stock insuffisant'], 'doublon' => false];
            }

            $prixReel = $donnees['prix_reel'] ?? $reference;

            // Plancher : un EMPLOYÉ ne peut pas vendre sous le prix minimum (par unité d'affichage). Le patron, si.
            if ($requete->attributes->get('est_employe') && $produit->prix_min !== null) {
                $parAffichage = (int) round($prixReel * $facteurAffichage / $facteur);
                if ($parAffichage < $produit->prix_min) {
                    return ['statut' => 422, 'corps' => ['erreur' => 'Prix sous le plancher autorisé ('.$produit->prix_min.' / '.$produit->libelleAffichage().')'], 'doublon' => false];
                }
            }

            // Calculs en entiers (arrondi au franc)
            $total = (int) round($qb * $prixReel / $facteur);
            $totalReference = (int) round($qb * $reference / $facteur);
            $coutMarchandises = (int) round($qb * ((float) $produit->prix_achat) / $facteurAffichage);
            $remise = $totalReference - $total;

            $acteur = $requete->attributes->get('utilisateur_reel') ?? $requete->user();
            $paye = $donnees['moyen_paiement'] !== 'credit';

            [$clientId, $nomClient, $telephoneClient] = $this->resoudreClient($requete, $donnees);

            $vente = $requete->user()->ventes()->create([
                'produit_id' => $produit->id,
                'boutique_id' => $requete->user()->boutique_active_id,
                'uuid_appareil' => $donnees['uuid_appareil'] ?? null,
                'quantite' => max(1, (int) round($qb / $facteur)),
                'total' => $total,
                'moyen_paiement' => $donnees['moyen_paiement'],
                'client_id' => $clientId,
                'nom_client' => $nomClient,
                'telephone_client' => $telephoneClient,
                'date_echeance' => $donnees['date_echeance'] ?? null,
                'paye' => $paye,
                'quantite_base' => $qb,
                'conditionnement_id' => $conditionnementId,
                'libelle_conditionnement' => $libelle,
                'prix_reference' => $reference,
                'prix_reel' => $prixReel,
                'remise' => $remise,
                'cout_marchandises' => $coutMarchandises,
                'vendu_par' => $acteur->id,
                'vendu_par_nom' => $acteur->identifiant ?? $acteur->nom_commerce,
            ]);

            $produit->decrement('stock', $qb);

            $detail = $produit->nom.' — '.number_format($total, 0, '', ' ').' FCFA'.($remise > 0 ? ' (remise '.number_format($remise, 0, '', ' ').')' : '').($paye ? '' : ' (crédit)');
            \App\Models\JournalActivite::consigner($requete, 'vente', $detail);

            static::perimerStatistiques($requete->user()->id); // T13 — périmer le cache des statistiques

            return ['statut' => 201, 'corps' => $vente, 'doublon' => false];
        });
    }

    /** Modifier une vente (quantité, paiement, règlement). */
    public function modifier(Request $requete, int $id)
    {
        $donnees = $requete->validate([
            'quantite' => ['sometimes', 'integer', 'min:1'],
            'moyen_paiement' => ['sometimes', 'string'],
            'paye' => ['sometimes', 'boolean'],
            'moyen_reglement' => ['nullable', 'string'],
        ]);

        return DB::transaction(function () use ($requete, $id, $donnees) {
            $vente = $requete->user()->ventes()->lockForUpdate()->findOrFail($id);

            // Ajustement du stock si la quantité change
            if (isset($donnees['quantite']) && $donnees['quantite'] !== $vente->quantite) {
                $produit = $requete->user()->produits()->findOrFail($vente->produit_id);
                $ecart = $donnees['quantite'] - $vente->quantite;
                if ($produit->stock < $ecart) {
                    return response()->json(['erreur' => 'Stock insuffisant'], 400);
                }
                $produit->decrement('stock', $ecart);
                $vente->quantite = $donnees['quantite'];
                $vente->total = (float) $produit->prix_vente * $donnees['quantite'];
            }

            $vente->fill(array_filter([
                'moyen_paiement' => $donnees['moyen_paiement'] ?? null,
                'moyen_reglement' => $donnees['moyen_reglement'] ?? null,
            ], fn ($v) => $v !== null));

            if (array_key_exists('paye', $donnees)) {
                $vente->paye = $donnees['paye'];
            }

            $vente->save();

            if (! empty($donnees['paye'])) {
                \App\Models\JournalActivite::consigner($requete, 'remboursement', 'Crédit remboursé ('.number_format((float) $vente->total, 0, '', ' ').' FCFA)');
            }

            static::perimerStatistiques($requete->user()->id); // T13

            return new RessourceVente($vente);
        });
    }

    public function supprimer(Request $requete, int $id)
    {
        $requete->user()->ventes()->findOrFail($id)->delete(); // T4 — corbeille
        static::perimerStatistiques($requete->user()->id); // T13

        return response()->json(['message' => 'Vente annulée']);
    }

    /** T4 — Corbeille des ventes annulées (récupérables). */
    public function corbeille(Request $requete)
    {
        return RessourceVente::collection(
            $requete->user()->ventes()
                ->onlyTrashed()
                ->select('ventes.*', 'produits.nom as nom_produit')
                ->join('produits', 'produits.id', '=', 'ventes.produit_id')
                ->orderByDesc('ventes.supprime_le')->get()
        );
    }

    /** T4 — Restaure une vente annulée par erreur. */
    public function restaurer(Request $requete, int $id)
    {
        $vente = $requete->user()->ventes()->onlyTrashed()->findOrFail($id);
        $vente->restore();
        \App\Models\JournalActivite::consigner($requete, 'vente.restaure', 'Vente #'.$vente->id.' restaurée');

        return new RessourceVente($vente);
    }
}
