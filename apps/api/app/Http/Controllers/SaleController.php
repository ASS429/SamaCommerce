<?php

namespace App\Http\Controllers;

use App\Http\Resources\SaleResource;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SaleController extends Controller
{
    /** Liste des ventes de l'utilisateur, avec le nom du produit.
     *  Avec ?page=N : renvoie une page paginée {data, current_page, last_page, total} ;
     *  sinon : renvoie le tableau complet (rétro-compatible). */
    public function index(Request $request)
    {
        $query = $request->user()->sales()
            ->select('sales.*', 'products.name as product_name')
            ->join('products', 'products.id', '=', 'sales.product_id')
            ->orderByDesc('sales.created_at');

        if ($request->filled('page')) {
            $paginator = $query->paginate((int) $request->integer('per_page', 20));
            $paginator->setCollection($paginator->getCollection()->map(fn ($s) => (new SaleResource($s))->resolve($request)));

            return $paginator; // T8 — enveloppe pagination conservée, items normalisés
        }

        return SaleResource::collection($query->get());
    }

    /** Règles de validation d'une vente (partagées store + sync). */
    private function saleRules(): array
    {
        return [
            'product_id' => ['required', 'integer'],
            'unit_id' => ['nullable', 'integer'],            // conditionnement de gros (null = détail)
            'quantite_base' => ['nullable', 'integer', 'min:1'], // quantité en unités de base (g/ml/pièce)
            'quantity' => ['nullable', 'integer', 'min:1'],  // legacy : nb d'unités de vente
            'prix_reel' => ['nullable', 'integer', 'min:0'],  // prix négocié (FCFA / unité choisie)
            'payment_method' => ['required', 'string'],
            // Rattachement au FICHIER clients : sans lui, l'historique d'achat et
            // le score de crédit se reconstruisent à partir du nom écrit, donc
            // « Awa », « awa » et « Awa Ndiaye » comptent pour trois personnes.
            'client_id' => ['nullable', 'integer'],
            'client_name' => ['nullable', 'string', 'max:255'],
            'client_phone' => ['nullable', 'string', 'max:32'],
            'due_date' => ['nullable', 'date'],
            'client_uuid' => ['nullable', 'uuid'], // T11 — idempotence hors-ligne
        ];
    }

    public function store(Request $request)
    {
        $data = $request->validate($this->saleRules());
        $result = $this->persistSale($request, $data);

        if ($result['body'] instanceof \App\Models\Sale) {
            return (new SaleResource($result['body']))->response()->setStatusCode($result['status']);
        }

        return response()->json($result['body'], $result['status']);
    }

    /**
     * T11 — Synchronisation d'un lot de ventes réalisées hors-ligne. IDEMPOTENT :
     * chaque vente porte un client_uuid ; une vente déjà connue est ignorée
     * (jamais de doublon). Renvoie le détail par vente pour que le client purge
     * sa file locale.
     */
    public function sync(Request $request)
    {
        $payload = $request->validate([
            'sales' => ['required', 'array', 'min:1', 'max:100'],
            'sales.*' => ['array'],
        ]);

        $synced = [];
        $duplicates = [];
        $failed = [];

        foreach ($payload['sales'] as $raw) {
            $uuid = $raw['client_uuid'] ?? null;
            $validator = validator($raw, $this->saleRules());
            if ($validator->fails()) {
                $failed[] = ['client_uuid' => $uuid, 'error' => $validator->errors()->first()];
                continue;
            }

            try {
                $res = $this->persistSale($request, $validator->validated());
                if ($res['status'] === 201) {
                    $synced[] = $uuid;
                } elseif (! empty($res['duplicate'])) {
                    $duplicates[] = $uuid;
                } else {
                    $failed[] = ['client_uuid' => $uuid, 'error' => $res['body']['error'] ?? 'Échec'];
                }
            } catch (\Throwable $e) {
                $failed[] = ['client_uuid' => $uuid, 'error' => 'Produit introuvable ou données invalides'];
            }
        }

        static::invalidateStats($request->user()->id);

        return response()->json([
            'synced' => $synced,
            'duplicates' => $duplicates, // déjà enregistrées : à purger côté client aussi
            'failed' => $failed,
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
    private function resolveClient(Request $request, array $data): array
    {
        $user = $request->user();
        $nom = trim((string) ($data['client_name'] ?? ''));
        $tel = $data['client_phone'] ?? null;

        if (! empty($data['client_id'])) {
            $client = $user->clients()->find($data['client_id']);
            if ($client) {
                return [$client->id, $client->name, $client->phone ?: $tel];
            }
        }

        if ($nom === '') {
            return [null, null, $tel];
        }

        $existant = $user->clients()->whereRaw('LOWER(name) = ?', [mb_strtolower($nom)])->first();
        if ($existant) {
            return [$existant->id, $existant->name, $existant->phone ?: $tel];
        }

        if (($data['payment_method'] ?? null) === 'credit') {
            $cree = $user->clients()->create([
                'name' => $nom,
                'phone' => $tel,
                'boutique_id' => $user->current_boutique_id,
            ]);

            return [$cree->id, $cree->name, $cree->phone];
        }

        return [null, $nom, $tel];
    }

    /**
     * Persiste une vente (logique unifiée store/sync). Renvoie
     * ['status' => int, 'body' => mixed, 'duplicate' => bool].
     */
    private function persistSale(Request $request, array $data): array
    {
        // Idempotence : une vente déjà synchronisée (même client_uuid) est ignorée.
        if (! empty($data['client_uuid'])) {
            $existing = $request->user()->sales()->where('client_uuid', $data['client_uuid'])->first();
            if ($existing) {
                return ['status' => 200, 'body' => $existing, 'duplicate' => true];
            }
        }

        return DB::transaction(function () use ($request, $data) {
            $product = $request->user()->products()->lockForUpdate()->findOrFail($data['product_id']);
            $displayFactor = $product->displayFactor();

            // Unité de vente : conditionnement de gros, sinon unité de détail (kg/L/pièce)
            if (! empty($data['unit_id'])) {
                $unit = \App\Models\ProductUnit::where('product_id', $product->id)->findOrFail($data['unit_id']);
                $factor = $unit->facteur; $reference = $unit->prix; $unitLabel = $unit->libelle; $unitId = $unit->id;
            } else {
                $factor = $displayFactor; $reference = (int) round((float) $product->price); $unitLabel = $product->displayLabel(); $unitId = null;
            }

            // Quantité en unités de base (rétro-compat : quantity × facteur)
            $qb = $data['quantite_base'] ?? (($data['quantity'] ?? 1) * $factor);
            if ($product->stock < $qb) {
                return ['status' => 400, 'body' => ['error' => 'Stock insuffisant'], 'duplicate' => false];
            }

            $prixReel = $data['prix_reel'] ?? $reference;

            // Plancher : un EMPLOYÉ ne peut pas vendre sous le prix minimum (par unité d'affichage). Le patron, si.
            if ($request->attributes->get('is_employee') && $product->prix_min !== null) {
                $perDisplay = (int) round($prixReel * $displayFactor / $factor);
                if ($perDisplay < $product->prix_min) {
                    return ['status' => 422, 'body' => ['error' => 'Prix sous le plancher autorisé ('.$product->prix_min.' / '.$product->displayLabel().')'], 'duplicate' => false];
                }
            }

            // Calculs en entiers (arrondi au franc)
            $total = (int) round($qb * $prixReel / $factor);
            $referenceTotal = (int) round($qb * $reference / $factor);
            $cogs = (int) round($qb * ((float) $product->price_achat) / $displayFactor);
            $remise = $referenceTotal - $total;

            $actor = $request->attributes->get('real_user') ?? $request->user();
            $paid = $data['payment_method'] !== 'credit';

            [$clientId, $clientName, $clientPhone] = $this->resolveClient($request, $data);

            $sale = $request->user()->sales()->create([
                'product_id' => $product->id,
                'boutique_id' => $request->user()->current_boutique_id,
                'client_uuid' => $data['client_uuid'] ?? null,
                'quantity' => max(1, (int) round($qb / $factor)),
                'total' => $total,
                'payment_method' => $data['payment_method'],
                'client_id' => $clientId,
                'client_name' => $clientName,
                'client_phone' => $clientPhone,
                'due_date' => $data['due_date'] ?? null,
                'paid' => $paid,
                'quantite_base' => $qb,
                'unit_id' => $unitId,
                'unit_libelle' => $unitLabel,
                'prix_reference' => $reference,
                'prix_reel' => $prixReel,
                'remise' => $remise,
                'cogs' => $cogs,
                'vendu_par' => $actor->id,
                'vendu_par_nom' => $actor->username ?? $actor->company_name,
            ]);

            $product->decrement('stock', $qb);

            $detail = $product->name.' — '.number_format($total, 0, '', ' ').' FCFA'.($remise > 0 ? ' (remise '.number_format($remise, 0, '', ' ').')' : '').($paid ? '' : ' (crédit)');
            \App\Models\ActivityLog::record($request, 'vente', $detail);

            static::invalidateStats($request->user()->id); // T13 — périmer le cache stats

            return ['status' => 201, 'body' => $sale, 'duplicate' => false];
        });
    }

    /** Modifier une vente (quantité, paiement, remboursement). */
    public function update(Request $request, int $id)
    {
        $data = $request->validate([
            'quantity' => ['sometimes', 'integer', 'min:1'],
            'payment_method' => ['sometimes', 'string'],
            'paid' => ['sometimes', 'boolean'],
            'repayment_method' => ['nullable', 'string'],
        ]);

        return DB::transaction(function () use ($request, $id, $data) {
            $sale = $request->user()->sales()->lockForUpdate()->findOrFail($id);

            // Ajustement du stock si la quantité change
            if (isset($data['quantity']) && $data['quantity'] !== $sale->quantity) {
                $product = $request->user()->products()->findOrFail($sale->product_id);
                $diff = $data['quantity'] - $sale->quantity;
                if ($product->stock < $diff) {
                    return response()->json(['error' => 'Stock insuffisant'], 400);
                }
                $product->decrement('stock', $diff);
                $sale->quantity = $data['quantity'];
                $sale->total = (float) $product->price * $data['quantity'];
            }

            $sale->fill(array_filter([
                'payment_method' => $data['payment_method'] ?? null,
                'repayment_method' => $data['repayment_method'] ?? null,
            ], fn ($v) => $v !== null));

            if (array_key_exists('paid', $data)) {
                $sale->paid = $data['paid'];
            }

            $sale->save();

            if (! empty($data['paid'])) {
                \App\Models\ActivityLog::record($request, 'remboursement', 'Crédit remboursé ('.number_format((float) $sale->total, 0, '', ' ').' FCFA)');
            }

            static::invalidateStats($request->user()->id); // T13

            return new SaleResource($sale);
        });
    }

    public function destroy(Request $request, int $id)
    {
        $request->user()->sales()->findOrFail($id)->delete(); // T4 — soft delete
        static::invalidateStats($request->user()->id); // T13

        return response()->json(['message' => 'Vente annulée']);
    }

    /** T4 — Corbeille des ventes annulées (récupérables). */
    public function trash(Request $request)
    {
        return SaleResource::collection(
            $request->user()->sales()
                ->onlyTrashed()
                ->select('sales.*', 'products.name as product_name')
                ->join('products', 'products.id', '=', 'sales.product_id')
                ->orderByDesc('sales.deleted_at')->get()
        );
    }

    /** T4 — Restaure une vente annulée par erreur. */
    public function restore(Request $request, int $id)
    {
        $sale = $request->user()->sales()->onlyTrashed()->findOrFail($id);
        $sale->restore();
        \App\Models\ActivityLog::record($request, 'vente.restaure', 'Vente #'.$sale->id.' restaurée');

        return new SaleResource($sale);
    }
}
