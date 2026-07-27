<?php

namespace App\Http\Controllers;

use App\Models\Boutique;
use App\Models\BoutiqueMember;
use App\Models\Product;
use App\Models\Sale;
use Illuminate\Http\Request;

class BoutiqueController extends Controller
{
    private function limitForPlan(string $plan): int
    {
        return match ($plan) {
            'Premium' => 3,
            'Enterprise', 'Business' => 999,
            default => 1, // Free
        };
    }

    public function index(Request $request)
    {
        $owner = $request->user();

        return $owner->boutiques()->orderByDesc('is_primary')->orderBy('created_at')->get()
            ->map(fn (Boutique $b) => array_merge($b->toArray(), [
                'nb_produits' => Product::where('boutique_id', $b->id)->count(),
                'nb_ventes' => Sale::where('boutique_id', $b->id)->count(),
                'nb_membres' => BoutiqueMember::where('ref_boutique_id', $b->id)->where('status', 'accepted')->count(),
            ]));
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:32'],
            'address' => ['nullable', 'string'],
            'emoji' => ['nullable', 'string', 'max:8'],
        ]);

        $owner = $request->user();
        $limit = $this->limitForPlan($owner->plan);
        if ($owner->boutiques()->count() >= $limit) {
            return response()->json([
                'error' => 'Limite atteinte',
                'code' => 'BOUTIQUE_LIMIT_REACHED',
                'message' => "Le plan {$owner->plan} permet au maximum {$limit} boutique(s).",
            ], 400);
        }

        $boutique = $owner->boutiques()->create([
            'name' => $data['name'], 'phone' => $data['phone'] ?? null,
            'address' => $data['address'] ?? null, 'emoji' => $data['emoji'] ?? '🏪', 'is_primary' => false,
        ]);

        return response()->json($boutique, 201);
    }

    public function update(Request $request, int $id)
    {
        $boutique = $request->user()->boutiques()->findOrFail($id);
        $boutique->update($request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:32'],
            'address' => ['nullable', 'string'],
            'emoji' => ['nullable', 'string', 'max:8'],
        ]));

        if ($boutique->is_primary && $request->filled('name')) {
            $request->user()->update(['company_name' => $request->input('name')]);
        }

        return $boutique;
    }

    public function destroy(Request $request, int $id)
    {
        $boutique = $request->user()->boutiques()->findOrFail($id);
        if ($boutique->is_primary) {
            return response()->json(['error' => 'Impossible de supprimer la boutique principale'], 400);
        }
        $boutique->delete();

        return response()->json(['message' => 'Boutique supprimée']);
    }

    /** Change la boutique active du propriétaire. */
    public function switch(Request $request, int $id)
    {
        $boutique = $request->user()->boutiques()->findOrFail($id);
        $request->user()->update(['current_boutique_id' => $boutique->id]);

        return response()->json(['message' => 'Boutique active changée', 'boutique' => $boutique]);
    }

    public function stats(Request $request, int $id)
    {
        $boutique = $request->user()->boutiques()->findOrFail($id);

        return response()->json([
            'boutique_id' => $boutique->id,
            'nb_produits' => Product::where('boutique_id', $boutique->id)->count(),
            'nb_ventes' => Sale::where('boutique_id', $boutique->id)->count(),
            'ca_total' => (float) Sale::where('boutique_id', $boutique->id)->where('paid', true)->sum('total'),
            'nb_membres' => BoutiqueMember::where('ref_boutique_id', $boutique->id)->where('status', 'accepted')->count(),
        ]);
    }
}
