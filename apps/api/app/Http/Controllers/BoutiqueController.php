<?php

namespace App\Http\Controllers;

use App\Models\Boutique;
use App\Models\BoutiqueMember;
use App\Models\Product;
use App\Models\Sale;
use App\Models\Scopes\BoutiqueScope;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

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

        // Cette liste compte les articles et ventes de CHAQUE boutique, y compris
        // celles qui ne sont pas actives : le cloisonnement est levé sciemment.
        return $owner->boutiques()->orderByDesc('is_primary')->orderBy('created_at')->get()
            ->map(fn (Boutique $b) => array_merge($b->toArray(), [
                'nb_produits' => Product::withoutGlobalScope(BoutiqueScope::class)->where('boutique_id', $b->id)->count(),
                'nb_ventes' => Sale::withoutGlobalScope(BoutiqueScope::class)->where('boutique_id', $b->id)->count(),
                'nb_membres' => BoutiqueMember::where('ref_boutique_id', $b->id)->where('status', 'accepted')->count(),
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
    public function dashboard(Request $request)
    {
        $owner = $request->user();
        $boutiques = $owner->boutiques()->orderByDesc('is_primary')->orderBy('created_at')->get();
        $aujourdhui = Carbon::today();
        $debutMois = Carbon::today()->startOfMonth();

        $lignes = $boutiques->map(function (Boutique $b) use ($aujourdhui, $debutMois) {
            $ventes = fn () => Sale::withoutGlobalScope(BoutiqueScope::class)->where('boutique_id', $b->id);
            $produits = Product::withoutGlobalScope(BoutiqueScope::class)->where('boutique_id', $b->id);

            $duJour = (clone $ventes())->whereDate('created_at', $aujourdhui)->get();
            $duMois = (clone $ventes())->where('created_at', '>=', $debutMois)->where('paid', true)->sum('total');

            return [
                'id' => $b->id,
                'name' => $b->name,
                'emoji' => $b->emoji,
                'photo' => $b->photo,
                'is_primary' => (bool) $b->is_primary,
                'ca_jour' => (int) $duJour->where('paid', true)->sum('total'),
                'nb_ventes_jour' => $duJour->count(),
                'ca_mois' => (int) $duMois,
                'nb_produits' => (clone $produits)->count(),
                'stock_total' => (int) (clone $produits)->sum('stock'),
                'ruptures' => (clone $produits)->where('stock', '<=', 0)->count(),
                'stock_faible' => (clone $produits)->where('stock', '>', 0)->where('stock', '<=', 5)->count(),
                'credits_impayes' => (int) (clone $ventes())->where('payment_method', 'credit')->where('paid', false)->sum('total'),
                'nb_membres' => BoutiqueMember::where('ref_boutique_id', $b->id)->where('status', 'accepted')->count(),
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

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:32'],
            'address' => ['nullable', 'string'],
            'emoji' => ['nullable', 'string', 'max:8'],
            'photo' => self::PHOTO_RULES,
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
            'photo' => self::PHOTO_RULES,
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

        /* On interroge une AUTRE boutique que l'active : il faut donc lever
         * explicitement le cloisonnement, sinon les deux conditions se
         * cumulent (`boutique_id = active AND boutique_id = demandée`) et tous
         * les compteurs des autres boutiques tombent à zéro. */
        $sansCloison = fn (string $model) => $model::withoutGlobalScope(BoutiqueScope::class)->where('boutique_id', $boutique->id);

        return response()->json([
            'boutique_id' => $boutique->id,
            'nb_produits' => $sansCloison(Product::class)->count(),
            'nb_ventes' => $sansCloison(Sale::class)->count(),
            'ca_total' => (float) $sansCloison(Sale::class)->where('paid', true)->sum('total'),
            'nb_membres' => BoutiqueMember::where('ref_boutique_id', $boutique->id)->where('status', 'accepted')->count(),
        ]);
    }
}
