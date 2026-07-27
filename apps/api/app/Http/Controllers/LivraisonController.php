<?php

namespace App\Http\Controllers;

use App\Models\CommandeItem;
use App\Models\RestockDelivery;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class LivraisonController extends Controller
{
    public function index(Request $request)
    {
        return RestockDelivery::where('restock_deliveries.user_id', $request->user()->id)
            ->leftJoin('restock_orders', 'restock_orders.id', '=', 'restock_deliveries.commande_id')
            ->leftJoin('fournisseurs', 'fournisseurs.id', '=', 'restock_orders.fournisseur_id')
            ->orderByDesc('restock_deliveries.created_at')
            ->get([
                'restock_deliveries.*',
                'restock_orders.status as commande_status',
                'restock_orders.total as commande_total',
                'restock_orders.expected_date',
                'fournisseurs.name as fournisseur_name',
            ]);
    }

    public function show(Request $request, int $id)
    {
        $liv = RestockDelivery::where('user_id', $request->user()->id)->with('commande.fournisseur')->findOrFail($id);
        $items = $liv->commande_id
            ? CommandeItem::where('commande_id', $liv->commande_id)
                ->leftJoin('products', 'products.id', '=', 'commande_items.product_id')
                ->get(['commande_items.*', 'products.name as product_name'])
            : [];

        return array_merge($liv->toArray(), ['items' => $items]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'commande_id' => ['nullable', 'integer'],
            'tracking_note' => ['nullable', 'string'],
        ]);

        if (! empty($data['commande_id'])) {
            $request->user()->restockOrders()->findOrFail($data['commande_id']);
        }

        $liv = RestockDelivery::create([
            'user_id' => $request->user()->id,
            'commande_id' => $data['commande_id'] ?? null,
            'tracking_note' => $data['tracking_note'] ?? null,
            'status' => 'en_attente',
        ]);

        return response()->json($liv, 201);
    }

    public function update(Request $request, int $id)
    {
        $liv = RestockDelivery::where('user_id', $request->user()->id)->findOrFail($id);

        $data = $request->validate([
            'status' => ['sometimes', 'in:en_attente,en_cours,livree'],
            'tracking_note' => ['nullable', 'string'],
            'delivered_at' => ['nullable', 'date'],
        ]);

        // Date automatique à la livraison
        if (($data['status'] ?? null) === 'livree' && empty($data['delivered_at'])) {
            $data['delivered_at'] = Carbon::now();
        }

        $liv->update($data);

        return $liv;
    }

    public function destroy(Request $request, int $id)
    {
        RestockDelivery::where('user_id', $request->user()->id)->findOrFail($id)->delete();

        return response()->json(['message' => 'Livraison supprimée']);
    }
}
