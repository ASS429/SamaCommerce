<?php

namespace App\Http\Controllers;

use App\Models\CommandeItem;
use App\Models\RestockDelivery;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

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
                // Le suivi se fait par WhatsApp : le numéro doit remonter avec la ligne.
                'fournisseurs.phone as fournisseur_phone',
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
            // Réceptionner la commande liée dans le même geste (voir plus bas).
            'recevoir' => ['nullable', 'boolean'],
        ]);

        $livree = ($data['status'] ?? null) === 'livree';

        // Date automatique à la livraison
        if ($livree && empty($data['delivered_at'])) {
            $data['delivered_at'] = Carbon::now();
        }

        $liv->update(collect($data)->except('recevoir')->all());

        /* Le suivi de livraison et la réception de commande étaient deux gestes
         * sans lien : on pouvait marquer « Livrée » sans que le stock bouge, et
         * le commerçant se demandait pourquoi ses quantités ne montaient pas.
         * Désormais, marquer livrée signale la commande à réceptionner — et
         * `recevoir: true` fait les deux d'un coup (stock incrémenté). */
        $commande = $liv->commande_id
            ? $request->user()->restockOrders()->with('items')->find($liv->commande_id)
            : null;
        $aRecevoir = $livree && $commande && $commande->status !== 'recue';

        if ($aRecevoir && $request->boolean('recevoir')) {
            DB::transaction(function () use ($request, $commande) {
                foreach ($commande->items as $it) {
                    $request->user()->products()->where('id', $it->product_id)->increment('stock', $it->quantity);
                }
                $commande->update(['status' => 'recue']);
            });

            return array_merge($liv->fresh()->toArray(), [
                'commande_recue' => true,
                'message' => "Livraison enregistrée et stock mis à jour pour {$commande->items->count()} produit(s)",
            ]);
        }

        return array_merge($liv->fresh()->toArray(), [
            // L'UI propose alors « Ajouter au stock » sur la fiche livraison.
            'commande_a_recevoir' => $aRecevoir ? $commande->id : null,
        ]);
    }

    public function destroy(Request $request, int $id)
    {
        RestockDelivery::where('user_id', $request->user()->id)->findOrFail($id)->delete();

        return response()->json(['message' => 'Livraison supprimée']);
    }
}
