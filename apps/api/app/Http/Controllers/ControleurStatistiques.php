<?php

namespace App\Http\Controllers;

use App\Models\Produit;
use App\Models\Vente;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class ControleurStatistiques extends Controleur
{
    /**
     * Indicateurs de l'écran Chiffres : encaissé et en attente depuis le début
     * du jour, de la semaine, du mois et depuis toujours ; crédits remboursés et
     * impayés. L'écran les calculait en téléchargeant TOUT l'historique des
     * ventes (plus d'un mégaoctet au bout de quelques mois).
     *
     * Les débuts de période viennent du téléphone (`?jour=…&semaine=…&mois=…`,
     * instants ISO 8601) : « aujourd'hui » est celui de son fuseau horaire.
     * Mêmes ventes que la liste (boutique active, corbeille exclue).
     */
    public function indicateurs(Request $requete)
    {
        $donnees = $requete->validate([
            'jour' => ['nullable', 'date'],
            'semaine' => ['nullable', 'date'],
            'mois' => ['nullable', 'date'],
        ]);
        $maintenant = Carbon::now();
        $debut = fn (string $periode, Carbon $defaut) => isset($donnees[$periode]) ? Carbon::parse($donnees[$periode]) : $defaut;
        $periodes = [
            'jour' => $debut('jour', $maintenant->copy()->startOfDay()),
            'semaine' => $debut('semaine', $maintenant->copy()->subDays(7)),
            'mois' => $debut('mois', $maintenant->copy()->subMonth()),
            'tout' => null,
        ];
        // Sommes payées / non payées d'un ensemble de ventes, en une requête.
        $sommes = function (callable $filtre) use ($requete): array {
            $lignes = $filtre($requete->user()->ventes()->join('produits', 'produits.id', '=', 'ventes.produit_id'))
                ->toBase()
                ->selectRaw('ventes.paye as paye, SUM(ventes.total) as somme')
                ->groupBy('ventes.paye')
                ->get();
            $resultat = ['paye' => 0, 'impaye' => 0];
            foreach ($lignes as $ligne) {
                $resultat[(bool) $ligne->paye ? 'paye' : 'impaye'] += (int) round((float) $ligne->somme);
            }

            return $resultat;
        };

        $encaisse = $attente = [];
        foreach ($periodes as $periode => $depuis) {
            $somme = $sommes(fn ($q) => $depuis ? $q->where('ventes.cree_le', '>=', $depuis->copy()->setTimezone(config('app.timezone'))) : $q);
            $encaisse[$periode] = $somme['paye'];
            $attente[$periode] = $somme['impaye'];
        }
        $credits = $sommes(fn ($q) => $q->where('ventes.moyen_paiement', 'credit'));

        return response()->json([
            'encaisse' => $encaisse,
            'attente' => $attente,
            'credits' => ['rembourses' => $credits['paye'], 'impayes' => $credits['impaye']],
        ]);
    }

    public function ventesParCategorie(Request $requete)
    {
        // Cloisonnement par boutique (les agrégats passent par le constructeur
        // de requêtes, hors de portée de CloisonnementBoutique).
        $bid = $requete->user()->boutique_active_id;

        return DB::table('ventes as v')
            ->join('produits as p', 'p.id', '=', 'v.produit_id')
            ->join('categories as c', 'c.id', '=', 'p.categorie_id')
            ->where('v.utilisateur_id', $requete->user()->id)
            ->when($bid, fn ($q) => $q->where('v.boutique_id', $bid))
            ->select('c.nom as categorie',
                DB::raw('SUM(v.quantite) as total_quantite'),
                DB::raw('SUM(v.quantite * p.prix_vente) as total_montant'))
            ->groupBy('c.nom')
            ->orderByDesc('total_quantite')
            ->get();
    }

    public function ventesParJour(Request $requete)
    {
        // Cloisonnement par boutique (les agrégats passent par le constructeur
        // de requêtes, hors de portée de CloisonnementBoutique).
        $bid = $requete->user()->boutique_active_id;

        return $this->statistiquesEnCache($requete, 'ventes-par-jour', fn () => DB::table('ventes as v')
            ->join('produits as p', 'p.id', '=', 'v.produit_id')
            ->where('v.utilisateur_id', $requete->user()->id)
            ->when($bid, fn ($q) => $q->where('v.boutique_id', $bid))
            ->select(DB::raw('DATE(v.cree_le) as date'),
                DB::raw('SUM(v.quantite) as total_quantite'),
                DB::raw('SUM(v.quantite * p.prix_vente) as total_montant'))
            ->groupBy(DB::raw('DATE(v.cree_le)'))
            ->orderBy('date')
            ->get());
    }

    public function paiements(Request $requete)
    {
        // Cloisonnement par boutique (les agrégats passent par le constructeur
        // de requêtes, hors de portée de CloisonnementBoutique).
        $bid = $requete->user()->boutique_active_id;

        return DB::table('ventes as v')
            ->join('produits as p', 'p.id', '=', 'v.produit_id')
            ->where('v.utilisateur_id', $requete->user()->id)
            ->when($bid, fn ($q) => $q->where('v.boutique_id', $bid))
            ->select('v.moyen_paiement',
                DB::raw('COUNT(*) as total_ventes'),
                DB::raw('SUM(v.quantite * p.prix_vente) as total_montant'))
            ->groupBy('v.moyen_paiement')
            ->get();
    }

    public function meilleursProduits(Request $requete)
    {
        // Cloisonnement par boutique (les agrégats passent par le constructeur
        // de requêtes, hors de portée de CloisonnementBoutique).
        $bid = $requete->user()->boutique_active_id;

        return DB::table('ventes as v')
            ->join('produits as p', 'p.id', '=', 'v.produit_id')
            ->where('v.utilisateur_id', $requete->user()->id)
            ->when($bid, fn ($q) => $q->where('v.boutique_id', $bid))
            ->select('p.nom as produit',
                DB::raw('SUM(v.quantite) as total_quantite'),
                DB::raw('SUM(v.quantite * p.prix_vente) as total_montant'))
            ->groupBy('p.nom')
            ->orderByDesc('total_quantite')
            ->limit(10)
            ->get();
    }

    public function stockFaible(Request $requete)
    {
        // Cloisonnement par boutique (les agrégats passent par le constructeur
        // de requêtes, hors de portée de CloisonnementBoutique).
        $bid = $requete->user()->boutique_active_id;

        $seuil = (int) $requete->integer('seuil', 5);

        return DB::table('produits')
            ->where('utilisateur_id', $requete->user()->id)
            ->when($bid, fn ($q) => $q->where('boutique_id', $bid))
            ->where('stock', '<=', $seuil)
            ->select('id', 'nom as produit', 'stock')
            ->orderBy('stock')
            ->get();
    }

    /** Marge brute par catégorie : SUM(qté × (prix de vente − prix d'achat)). */
    public function margeParCategorie(Request $requete)
    {
        // Cloisonnement par boutique (les agrégats passent par le constructeur
        // de requêtes, hors de portée de CloisonnementBoutique).
        $bid = $requete->user()->boutique_active_id;

        return $this->statistiquesEnCache($requete, 'marge-categorie', fn () => DB::table('ventes as v')
            ->join('produits as p', 'p.id', '=', 'v.produit_id')
            ->leftJoin('categories as c', 'c.id', '=', 'p.categorie_id')
            ->where('v.utilisateur_id', $requete->user()->id)
            ->when($bid, fn ($q) => $q->where('v.boutique_id', $bid))
            ->where('v.paye', true)
            ->select(
                DB::raw("COALESCE(c.nom, 'Sans catégorie') as categorie"),
                DB::raw('SUM(v.quantite * p.prix_vente) as ca'),
                DB::raw('SUM(v.quantite * (p.prix_vente - p.prix_achat)) as marge'),
            )
            ->groupBy('c.nom')
            ->orderByDesc('marge')
            ->get());
    }

    /** Rotation des stocks : quantités vendues face au stock restant, par produit. */
    public function rotationStock(Request $requete)
    {
        // Cloisonnement par boutique (les agrégats passent par le constructeur
        // de requêtes, hors de portée de CloisonnementBoutique).
        $bid = $requete->user()->boutique_active_id;

        return $this->statistiquesEnCache($requete, 'rotation-stock', fn () => DB::table('produits as p')
            ->leftJoin('ventes as v', 'v.produit_id', '=', 'p.id')
            ->where('p.utilisateur_id', $requete->user()->id)
            ->when($bid, fn ($q) => $q->where('p.boutique_id', $bid))
            ->select('p.nom as produit', 'p.stock', DB::raw('COALESCE(SUM(v.quantite), 0) as vendus'))
            ->groupBy('p.id', 'p.nom', 'p.stock')
            ->orderByDesc('vendus')
            ->limit(15)
            ->get());
    }

    /** Marchandage et marge réelle : marge (total − coût), remise consentie, par vendeur. */
    public function marchandage(Request $requete)
    {
        // Cloisonnement par boutique (les agrégats passent par le constructeur
        // de requêtes, hors de portée de CloisonnementBoutique).
        $bid = $requete->user()->boutique_active_id;

        $uid = $requete->user()->id;
        $base = DB::table('ventes')->where('utilisateur_id', $uid)->when($bid, fn ($q) => $q->where('boutique_id', $bid))->whereNotNull('cout_marchandises');

        $g = (clone $base)->selectRaw('COALESCE(SUM(total),0) ca, COALESCE(SUM(cout_marchandises),0) cout, COALESCE(SUM(remise),0) remise, COUNT(*) nb')->first();
        $marge = (int) ($g->ca - $g->cout);

        $vendeurs = (clone $base)
            ->selectRaw("COALESCE(vendu_par_nom,'—') vendeur, COUNT(*) nb, COALESCE(SUM(total),0) ca, COALESCE(SUM(total - cout_marchandises),0) marge, COALESCE(SUM(remise),0) remise")
            ->groupBy('vendu_par_nom')->orderByDesc('ca')->get();

        return response()->json([
            'ca' => (int) $g->ca,
            'marge' => $marge,
            'remise_totale' => (int) $g->remise,
            'nb' => (int) $g->nb,
            'taux_marge' => $g->ca > 0 ? round($marge * 100 / $g->ca, 1) : 0,
            'par_vendeur' => $vendeurs,
        ]);
    }

    /** Meilleurs clients par chiffre d'affaires. */
    public function meilleursClients(Request $requete)
    {
        // Cloisonnement par boutique (les agrégats passent par le constructeur
        // de requêtes, hors de portée de CloisonnementBoutique).
        $bid = $requete->user()->boutique_active_id;

        return $this->statistiquesEnCache($requete, 'meilleurs-clients', fn () => DB::table('clients as cl')
            ->leftJoin('ventes as v', 'v.client_id', '=', 'cl.id')
            ->where('cl.utilisateur_id', $requete->user()->id)
            ->when($bid, fn ($q) => $q->where('cl.boutique_id', $bid))
            ->select('cl.nom as client', 'cl.telephone', DB::raw('COUNT(v.id) as nb_achats'), DB::raw('COALESCE(SUM(v.total), 0) as total'))
            ->groupBy('cl.id', 'cl.nom', 'cl.telephone')
            ->orderByDesc('total')
            ->limit(10)
            ->get());
    }

    /**
     * Les trois chiffres de l'en-tête d'accueil, agrégés EN BASE.
     *
     * POURQUOI. Le front téléchargeait TOUT l'historique des ventes puis
     * filtrait en JavaScript, à chaque changement d'écran. Mesuré en
     * production : 34 Ko pour 75 ventes, soit ~450 octets par vente. À 20
     * ventes par jour, la même navigation coûterait 3,3 Mo au bout d'un an —
     * sur de la data mobile sénégalaise, facturée à l'utilisateur.
     * Ici, la réponse pèse quelques dizaines d'octets et ne grossit jamais.
     *
     * DROITS. La route n'élargit RIEN : un employé qui n'a pas « vente » ne
     * peut pas lister les ventes aujourd'hui, il ne doit donc pas découvrir la
     * recette du jour par ce biais. Les champs auxquels il n'a pas droit sont
     * renvoyés à `null` — et non à 0, qui se confondrait avec « aucune vente ».
     */
    public function resumeJour(Request $requete)
    {
        $proprietaire = $requete->user();
        // Dakar est à UTC+0 : la date UTC est bien la journée du commerçant.
        // (Le front comparait déjà `cree_le` en UTC — même découpage.)
        $aujourdhui = now()->toDateString();

        $peutVoirVentes = $this->autorise($requete, 'vente');
        $peutVoirStock = $this->autorise($requete, 'stock') || $peutVoirVentes;

        $ca = null;
        $articles = null;
        if ($peutVoirVentes) {
            // Eloquent et NON DB::table : le cloisonnement par boutique ne
            // s'applique qu'aux modèles (piège documenté dans CloisonnementBoutique).
            $ligne = Vente::query()
                ->where('utilisateur_id', $proprietaire->id)
                ->whereDate('cree_le', $aujourdhui)
                ->selectRaw('COALESCE(SUM(CASE WHEN paye THEN total ELSE 0 END), 0) as ca')
                ->selectRaw('COALESCE(SUM(quantite), 0) as articles')
                ->first();

            $ca = (int) $ligne->ca;
            $articles = (int) $ligne->articles;
        }

        $stock = null;
        if ($peutVoirStock) {
            $stock = (int) Produit::query()->where('utilisateur_id', $proprietaire->id)->sum('stock');
        }

        return response()->json([
            'date' => $aujourdhui,
            'ca' => $ca,
            'articles' => $articles,
            'stock' => $stock,
        ]);
    }

    /** Le propriétaire a tout ; l'employé, seulement ses permissions. */
    private function autorise(Request $requete, string $permission): bool
    {
        if (! $requete->attributes->get('est_employe', false)) {
            return true;
        }

        return ! empty(($requete->attributes->get('permissions') ?? [])[$permission]);
    }
}
