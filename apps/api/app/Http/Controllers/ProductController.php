<?php

namespace App\Http\Controllers;

use App\Http\Resources\ProductResource;
use App\Models\Product;
use Illuminate\Http\Request;

class ProductController extends Controller
{
    public function index(Request $request)
    {
        $query = $request->user()->products()->with('units');
        $query->orderByDesc('id');

        // T9 — pagination opt-in (?page=N) ; sinon tableau complet (rétro-compatible).
        if ($request->filled('page')) {
            $paginator = $query->paginate((int) $request->integer('per_page', 30));
            $paginator->setCollection($paginator->getCollection()->map(fn ($p) => (new ProductResource($p))->resolve($request)));

            return $paginator; // T8 — enveloppe pagination conservée, items normalisés
        }

        return ProductResource::collection($query->get());
    }

    public function show(Request $request, int $id)
    {
        return new ProductResource($request->user()->products()->with('units')->findOrFail($id));
    }

    public function store(Request $request)
    {
        $data = $this->validatePayload($request);

        $product = $request->user()->products()->create([
            'name' => $data['name'],
            'boutique_id' => $request->user()->current_boutique_id,
            'category_id' => $data['category_id'] ?? null,
            'scent' => $data['scent'] ?? null,
            'barcode' => $data['barcode'] ?? null,
            'price' => $data['price'] ?? 0,
            'price_achat' => $data['price_achat'] ?? 0,
            'stock' => $data['stock'] ?? 0,
            'unite_base' => $data['unite_base'] ?? 'piece',
            'prix_min' => $data['prix_min'] ?? null,
            'negociable' => $data['negociable'] ?? null,
            'photo' => $data['photo'] ?? null,
        ]);

        $this->syncUnits($product, $data['units'] ?? null);

        \App\Models\ActivityLog::record($request, 'produit.ajout', $product->name);

        return (new ProductResource($product->load('units')))->response()->setStatusCode(201);
    }

    public function update(Request $request, int $id)
    {
        $product = $request->user()->products()->findOrFail($id);
        $data = $this->validatePayload($request, true);

        $product->update(collect($data)->except('units')->all());
        $this->syncUnits($product, $data['units'] ?? null);

        return new ProductResource($product->load('units'));
    }

    public function destroy(Request $request, int $id)
    {
        $product = $request->user()->products()->findOrFail($id);
        \App\Models\ActivityLog::record($request, 'produit.suppr', $product->name);
        $product->delete(); // T4 — soft delete (corbeille)

        return response()->json(['message' => 'Produit supprimé']);
    }

    /** T4 — Corbeille : produits supprimés (récupérables). */
    public function trash(Request $request)
    {
        return ProductResource::collection(
            $request->user()->products()->onlyTrashed()->with('units')->orderByDesc('deleted_at')->get()
        );
    }

    /** T4 — Restaure un produit supprimé. */
    public function restore(Request $request, int $id)
    {
        $product = $request->user()->products()->onlyTrashed()->findOrFail($id);
        $product->restore();
        \App\Models\ActivityLog::record($request, 'produit.restaure', $product->name);

        return new ProductResource($product->load('units'));
    }

    private function validatePayload(Request $request, bool $partial = false): array
    {
        $req = $partial ? 'sometimes' : 'nullable';

        return $request->validate([
            'name' => [$partial ? 'sometimes' : 'required', 'string', 'max:255'],
            // S4 — la catégorie doit appartenir au tenant (pas de fuite cross-tenant).
            'category_id' => ['nullable', 'integer', $this->tenantExists($request, 'categories')],
            'scent' => ['nullable', 'string'],
            'barcode' => ['nullable', 'string', 'max:64'],
            'price' => [$req, 'numeric', 'min:0'],
            'price_achat' => [$req, 'numeric', 'min:0'],
            'stock' => [$req, 'integer', 'min:0'],
            'unite_base' => ['nullable', 'in:piece,g,ml'],
            'prix_min' => ['nullable', 'integer', 'min:0'],
            'negociable' => ['nullable', 'boolean'],
            'photo' => self::PHOTO_RULES,
            'units' => ['nullable', 'array'],
            'units.*.libelle' => ['required_with:units', 'string', 'max:64'],
            'units.*.facteur' => ['required_with:units', 'integer', 'min:1'],
            'units.*.prix' => ['required_with:units', 'integer', 'min:0'],
        ]);
    }

    /** Remplace les conditionnements de gros du produit (null = ne pas toucher). */
    private function syncUnits(Product $product, ?array $units): void
    {
        if ($units === null) {
            return;
        }
        $product->units()->delete();
        foreach ($units as $u) {
            $product->units()->create([
                'libelle' => $u['libelle'],
                'facteur' => (int) $u['facteur'],
                'prix' => (int) $u['prix'],
            ]);
        }
    }
}
