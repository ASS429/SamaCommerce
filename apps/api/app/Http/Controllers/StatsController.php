<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class StatsController extends Controller
{
    public function ventesParCategorie(Request $request)
    {
        // Cloisonnement par boutique (les agrégats passent par le query builder,
        // hors de portée de BoutiqueScope).
        $bid = $request->user()->current_boutique_id;

        return DB::table('sales as s')
            ->join('products as p', 'p.id', '=', 's.product_id')
            ->join('categories as c', 'c.id', '=', 'p.category_id')
            ->where('s.user_id', $request->user()->id)
            ->when($bid, fn ($q) => $q->where('s.boutique_id', $bid))
            ->select('c.name as categorie',
                DB::raw('SUM(s.quantity) as total_quantite'),
                DB::raw('SUM(s.quantity * p.price) as total_montant'))
            ->groupBy('c.name')
            ->orderByDesc('total_quantite')
            ->get();
    }

    public function ventesParJour(Request $request)
    {
        // Cloisonnement par boutique (les agrégats passent par le query builder,
        // hors de portée de BoutiqueScope).
        $bid = $request->user()->current_boutique_id;

        return $this->tenantCachedStats($request, 'ventes-par-jour', fn () => DB::table('sales as s')
            ->join('products as p', 'p.id', '=', 's.product_id')
            ->where('s.user_id', $request->user()->id)
            ->when($bid, fn ($q) => $q->where('s.boutique_id', $bid))
            ->select(DB::raw('DATE(s.created_at) as date'),
                DB::raw('SUM(s.quantity) as total_quantite'),
                DB::raw('SUM(s.quantity * p.price) as total_montant'))
            ->groupBy(DB::raw('DATE(s.created_at)'))
            ->orderBy('date')
            ->get());
    }

    public function paiements(Request $request)
    {
        // Cloisonnement par boutique (les agrégats passent par le query builder,
        // hors de portée de BoutiqueScope).
        $bid = $request->user()->current_boutique_id;

        return DB::table('sales as s')
            ->join('products as p', 'p.id', '=', 's.product_id')
            ->where('s.user_id', $request->user()->id)
            ->when($bid, fn ($q) => $q->where('s.boutique_id', $bid))
            ->select('s.payment_method',
                DB::raw('COUNT(*) as total_ventes'),
                DB::raw('SUM(s.quantity * p.price) as total_montant'))
            ->groupBy('s.payment_method')
            ->get();
    }

    public function topProduits(Request $request)
    {
        // Cloisonnement par boutique (les agrégats passent par le query builder,
        // hors de portée de BoutiqueScope).
        $bid = $request->user()->current_boutique_id;

        return DB::table('sales as s')
            ->join('products as p', 'p.id', '=', 's.product_id')
            ->where('s.user_id', $request->user()->id)
            ->when($bid, fn ($q) => $q->where('s.boutique_id', $bid))
            ->select('p.name as produit',
                DB::raw('SUM(s.quantity) as total_quantite'),
                DB::raw('SUM(s.quantity * p.price) as total_montant'))
            ->groupBy('p.name')
            ->orderByDesc('total_quantite')
            ->limit(10)
            ->get();
    }

    public function stockFaible(Request $request)
    {
        // Cloisonnement par boutique (les agrégats passent par le query builder,
        // hors de portée de BoutiqueScope).
        $bid = $request->user()->current_boutique_id;

        $seuil = (int) $request->integer('seuil', 5);

        return DB::table('products')
            ->where('user_id', $request->user()->id)
            ->when($bid, fn ($q) => $q->where('boutique_id', $bid))
            ->where('stock', '<=', $seuil)
            ->select('id', 'name as produit', 'stock')
            ->orderBy('stock')
            ->get();
    }

    /** Marge brute par catégorie : SUM(qte × (prix vente − prix achat)). */
    public function margeParCategorie(Request $request)
    {
        // Cloisonnement par boutique (les agrégats passent par le query builder,
        // hors de portée de BoutiqueScope).
        $bid = $request->user()->current_boutique_id;

        return $this->tenantCachedStats($request, 'marge-categorie', fn () => DB::table('sales as s')
            ->join('products as p', 'p.id', '=', 's.product_id')
            ->leftJoin('categories as c', 'c.id', '=', 'p.category_id')
            ->where('s.user_id', $request->user()->id)
            ->when($bid, fn ($q) => $q->where('s.boutique_id', $bid))
            ->where('s.paid', true)
            ->select(
                DB::raw("COALESCE(c.name, 'Sans catégorie') as categorie"),
                DB::raw('SUM(s.quantity * p.price) as ca'),
                DB::raw('SUM(s.quantity * (p.price - p.price_achat)) as marge'),
            )
            ->groupBy('c.name')
            ->orderByDesc('marge')
            ->get());
    }

    /** Rotation des stocks : quantités vendues vs stock restant, par produit. */
    public function rotationStock(Request $request)
    {
        // Cloisonnement par boutique (les agrégats passent par le query builder,
        // hors de portée de BoutiqueScope).
        $bid = $request->user()->current_boutique_id;

        return $this->tenantCachedStats($request, 'rotation-stock', fn () => DB::table('products as p')
            ->leftJoin('sales as s', 's.product_id', '=', 'p.id')
            ->where('p.user_id', $request->user()->id)
            ->when($bid, fn ($q) => $q->where('p.boutique_id', $bid))
            ->select('p.name as produit', 'p.stock', DB::raw('COALESCE(SUM(s.quantity), 0) as vendus'))
            ->groupBy('p.id', 'p.name', 'p.stock')
            ->orderByDesc('vendus')
            ->limit(15)
            ->get());
    }

    /** Marchandage & marge réelle : marge (total − COGS), remise consentie, par vendeur. */
    public function marchandage(Request $request)
    {
        // Cloisonnement par boutique (les agrégats passent par le query builder,
        // hors de portée de BoutiqueScope).
        $bid = $request->user()->current_boutique_id;

        $uid = $request->user()->id;
        $base = DB::table('sales')->where('user_id', $uid)->when($bid, fn ($q) => $q->where('boutique_id', $bid))->whereNotNull('cogs');

        $g = (clone $base)->selectRaw('COALESCE(SUM(total),0) ca, COALESCE(SUM(cogs),0) cogs, COALESCE(SUM(remise),0) remise, COUNT(*) nb')->first();
        $marge = (int) ($g->ca - $g->cogs);

        $vendeurs = (clone $base)
            ->selectRaw("COALESCE(vendu_par_nom,'—') vendeur, COUNT(*) nb, COALESCE(SUM(total),0) ca, COALESCE(SUM(total - cogs),0) marge, COALESCE(SUM(remise),0) remise")
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
    public function meilleursClients(Request $request)
    {
        // Cloisonnement par boutique (les agrégats passent par le query builder,
        // hors de portée de BoutiqueScope).
        $bid = $request->user()->current_boutique_id;

        return $this->tenantCachedStats($request, 'meilleurs-clients', fn () => DB::table('clients as cl')
            ->leftJoin('sales as s', 's.client_id', '=', 'cl.id')
            ->where('cl.user_id', $request->user()->id)
            ->when($bid, fn ($q) => $q->where('cl.boutique_id', $bid))
            ->select('cl.name as client', 'cl.phone', DB::raw('COUNT(s.id) as nb_achats'), DB::raw('COALESCE(SUM(s.total), 0) as total'))
            ->groupBy('cl.id', 'cl.name', 'cl.phone')
            ->orderByDesc('total')
            ->limit(10)
            ->get());
    }
}
