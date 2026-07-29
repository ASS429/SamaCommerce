<?php

namespace App\Http\Controllers;

use App\Models\Client;
use App\Models\Sale;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class ClientController extends Controller
{
    /** Liste légère pour l'autocomplete de la vente. */
    public function forSale(Request $request)
    {

        return $request->user()->clients()
            ->orderBy('name')->get(['id', 'name', 'phone']);
    }

    public function index(Request $request)
    {
        $userId = $request->user()->id;
        $clients = Client::where('user_id', $userId)
            ->get();

        // Ventes du commerçant (liées par client_id OU par nom)
        $sales = Sale::where('user_id', $userId)->get(['client_id', 'client_name', 'total', 'paid', 'created_at']);

        $result = $clients->map(function (Client $c) use ($sales) {
            $mine = $sales->filter(fn ($s) => $s->client_id === $c->id || ($s->client_id === null && $s->client_name === $c->name));
            return array_merge($c->toArray(), [
                'nb_achats' => $mine->count(),
                'total_achats' => (float) $mine->sum('total'),
                'credits_ouverts' => $mine->where('paid', false)->count(),
                'credits_montant' => (float) $mine->where('paid', false)->sum('total'),
            ]);
        })->sortByDesc('total_achats')->values();

        // T9 — pagination opt-in (les agrégats étant calculés en PHP, on pagine la collection).
        if ($request->filled('page')) {
            $perPage = (int) $request->integer('per_page', 30);
            $page = max(1, (int) $request->integer('page', 1));

            return response()->json([
                'data' => $result->forPage($page, $perPage)->values(),
                'current_page' => $page,
                'last_page' => (int) max(1, ceil($result->count() / $perPage)),
                'total' => $result->count(),
            ]);
        }

        return $result;
    }

    public function show(Request $request, int $id)
    {
        $client = $request->user()->clients()->findOrFail($id);

        $achats = Sale::where('sales.user_id', $request->user()->id)
            ->where(fn ($q) => $q->where('sales.client_id', $client->id)
                ->orWhere(fn ($q2) => $q2->whereNull('sales.client_id')->where('sales.client_name', $client->name)))
            ->leftJoin('products', 'products.id', '=', 'sales.product_id')
            ->orderByDesc('sales.created_at')
            ->get(['sales.*', 'products.name as product_name']);

        return array_merge($client->toArray(), ['achats' => $achats]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:32'],
            'email' => ['nullable', 'string', 'max:255'],
            'address' => ['nullable', 'string'],
            'notes' => ['nullable', 'string'],
            'photo' => self::PHOTO_RULES,
        ]);

        $exists = $request->user()->clients()->whereRaw('LOWER(name) = ?', [mb_strtolower($data['name'])])->exists();
        if ($exists) {
            return response()->json(['error' => "Un client nommé « {$data['name']} » existe déjà"], 400);
        }

        $client = $request->user()->clients()->create(array_merge($data, [
            'boutique_id' => $request->user()->current_boutique_id,
        ]));

        // Rattache les ventes existantes au même nom
        Sale::where('user_id', $request->user()->id)->whereNull('client_id')
            ->where('client_name', $data['name'])->update(['client_id' => $client->id]);

        return response()->json($client, 201);
    }

    public function update(Request $request, int $id)
    {
        $client = $request->user()->clients()->findOrFail($id);
        $client->update($request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:32'],
            'email' => ['nullable', 'string', 'max:255'],
            'address' => ['nullable', 'string'],
            'notes' => ['nullable', 'string'],
            'photo' => self::PHOTO_RULES,
        ]));

        return $client;
    }

    public function destroy(Request $request, int $id)
    {
        $client = $request->user()->clients()->findOrFail($id);
        Sale::where('client_id', $client->id)->update(['client_id' => null]);
        $client->delete();

        return response()->json(['message' => 'Client supprimé']);
    }

    public function stats(Request $request, int $id)
    {
        $client = $request->user()->clients()->findOrFail($id);
        $sales = Sale::where('user_id', $request->user()->id)
            ->where(fn ($q) => $q->where('client_id', $client->id)
                ->orWhere(fn ($q2) => $q2->whereNull('client_id')->where('client_name', $client->name)))
            ->get();

        return response()->json([
            'nb_achats' => $sales->count(),
            'ca_total' => (float) $sales->sum('total'),
            'ca_encaisse' => (float) $sales->where('paid', true)->sum('total'),
            'credits_ouverts' => (float) $sales->where('paid', false)->sum('total'),
            'achats_30j' => $sales->where('created_at', '>=', Carbon::now()->subDays(30))->count(),
            'dernier_achat' => $sales->max('created_at'),
        ]);
    }
}
