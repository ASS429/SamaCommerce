<?php

namespace App\Http\Controllers;

use App\Models\Retour;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class ReturnController extends Controller
{
    public function index(Request $request)
    {
        $bid = $request->user()->current_boutique_id;

        return Retour::where('returns.user_id', $request->user()->id)
            ->when($bid, fn ($q) => $q->where(fn ($w) => $w->where('returns.boutique_id', $bid)->orWhereNull('returns.boutique_id')))
            ->join('products', 'products.id', '=', 'returns.product_id')
            ->orderByDesc('returns.created_at')->limit(100)
            ->get(['returns.*', 'products.name as product_name', 'products.price as product_price']);
    }

    public function stats(Request $request)
    {
        $rows = Retour::where('user_id', $request->user()->id)->get();
        $jour = $rows->filter(fn ($r) => Carbon::parse($r->created_at)->isToday());

        return response()->json([
            'nb_retours' => $rows->count(),
            'total_rembourse' => (float) $rows->sum('refund_amount'),
            'retours_jour' => $jour->count(),
            'rembourse_jour' => (float) $jour->sum('refund_amount'),
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'sale_id' => ['required', 'integer'],
            'quantity' => ['required', 'integer', 'min:1'],
            'reason' => ['nullable', 'string'],
            'refund_method' => ['nullable', 'in:avoir,especes,wave,orange'],
        ]);

        return DB::transaction(function () use ($request, $data) {
            $sale = $request->user()->sales()->lockForUpdate()->findOrFail($data['sale_id']);

            $dejaRendu = (int) Retour::where('sale_id', $sale->id)->sum('quantity');
            $maxReturnable = $sale->quantity - $dejaRendu;
            if ($data['quantity'] > $maxReturnable) {
                return response()->json(['error' => "Maximum {$maxReturnable} unité(s) retournable(s)"], 400);
            }

            $refund = $sale->quantity > 0 ? round(($sale->total / $sale->quantity) * $data['quantity'], 2) : 0;

            $retour = Retour::create([
                'sale_id' => $sale->id, 'product_id' => $sale->product_id,
                'user_id' => $request->user()->id, 'boutique_id' => $request->user()->current_boutique_id,
                'quantity' => $data['quantity'],
                'reason' => $data['reason'] ?? null, 'refund_method' => $data['refund_method'] ?? 'avoir',
                'refund_amount' => $refund,
            ]);

            // Recréditer le stock
            $request->user()->products()->where('id', $sale->product_id)->increment('stock', $data['quantity']);
            static::invalidateStats($request->user()->id); // T13 — périmer le cache stats

            // Mettre à jour la vente
            $newQty = $sale->quantity - $data['quantity'];
            if ($newQty === 0) {
                $sale->update(['quantity' => 0, 'total' => 0, 'payment_method' => 'retour']);
            } else {
                $sale->update(['quantity' => $newQty, 'total' => max(0, $sale->total - $refund)]);
            }

            return response()->json([
                'message' => "Retour enregistré — " . number_format($refund, 0, ',', ' ') . " F remboursés",
                'return' => $retour, 'stock_restitue' => $data['quantity'], 'refund_amount' => $refund,
            ], 201);
        });
    }
}
