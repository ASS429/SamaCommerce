<?php

namespace App\Http\Controllers;

use App\Models\CommandeItem;
use App\Models\RestockOrder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CommandeController extends Controller
{
    public function index(Request $request)
    {
        $bid = $request->user()->current_boutique_id;

        return RestockOrder::where('restock_orders.user_id', $request->user()->id)
            ->when($bid, fn ($q) => $q->where(fn ($w) => $w->where('restock_orders.boutique_id', $bid)->orWhereNull('restock_orders.boutique_id')))
            ->leftJoin('fournisseurs', 'fournisseurs.id', '=', 'restock_orders.fournisseur_id')
            ->withCount('items')
            ->orderByDesc('restock_orders.created_at')
            ->get(['restock_orders.*', 'fournisseurs.name as fournisseur_name', 'fournisseurs.phone as fournisseur_phone']);
    }

    public function show(Request $request, int $id)
    {
        $cmd = RestockOrder::where('user_id', $request->user()->id)->with(['fournisseur', 'items.product:id,name,stock'])->findOrFail($id);

        return $cmd;
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            // S4 — fournisseur et produits doivent appartenir au tenant.
            'fournisseur_id' => ['nullable', 'integer', $this->tenantExists($request, 'fournisseurs')],
            'notes' => ['nullable', 'string'],
            'expected_date' => ['nullable', 'date'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer', $this->tenantExists($request, 'products')],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
            'items.*.prix_unitaire' => ['required', 'numeric', 'min:0'],
        ]);

        return DB::transaction(function () use ($request, $data) {
            $total = collect($data['items'])->sum(fn ($it) => $it['quantity'] * $it['prix_unitaire']);
            $cmd = RestockOrder::create([
                'user_id' => $request->user()->id,
                'boutique_id' => $request->user()->current_boutique_id,
                'fournisseur_id' => $data['fournisseur_id'] ?? null,
                'total' => $total, 'notes' => $data['notes'] ?? null,
                'expected_date' => $data['expected_date'] ?? null, 'status' => 'en_attente',
            ]);
            foreach ($data['items'] as $it) {
                CommandeItem::create(['commande_id' => $cmd->id] + $it);
            }

            return response()->json($cmd->load('items'), 201);
        });
    }

    public function update(Request $request, int $id)
    {
        $cmd = RestockOrder::where('user_id', $request->user()->id)->findOrFail($id);
        $cmd->update($request->validate([
            'status' => ['sometimes', 'in:en_attente,recue'],
            'notes' => ['nullable', 'string'],
            'expected_date' => ['nullable', 'date'],
            'fournisseur_id' => ['nullable', 'integer', $this->tenantExists($request, 'fournisseurs')],
        ]));

        return $cmd;
    }

    /** Réception : recrédite le stock des produits commandés et passe en "reçue". */
    public function recevoir(Request $request, int $id)
    {
        return DB::transaction(function () use ($request, $id) {
            $cmd = RestockOrder::where('user_id', $request->user()->id)->with('items')->findOrFail($id);
            foreach ($cmd->items as $it) {
                $request->user()->products()->where('id', $it->product_id)->increment('stock', $it->quantity);
            }
            $cmd->update(['status' => 'recue']);

            return response()->json(['commande' => $cmd, 'message' => "Stock mis à jour pour {$cmd->items->count()} produit(s)"]);
        });
    }

    public function destroy(Request $request, int $id)
    {
        RestockOrder::where('user_id', $request->user()->id)->findOrFail($id)->delete();

        return response()->json(['message' => 'Commande supprimée']);
    }
}
