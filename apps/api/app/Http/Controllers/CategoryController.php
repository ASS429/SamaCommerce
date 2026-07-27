<?php

namespace App\Http\Controllers;

use App\Http\Resources\CategoryResource;
use Illuminate\Http\Request;

class CategoryController extends Controller
{
    public function index(Request $request)
    {
        return CategoryResource::collection($request->user()->categories()->orderBy('id')->get());
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'emoji' => ['nullable', 'string', 'max:16'],
            'couleur' => ['nullable', 'string', 'max:32'],
            'negociable' => ['nullable', 'boolean'],
        ]);

        $category = $request->user()->categories()->create([
            'name' => trim($data['name']),
            'emoji' => $data['emoji'] ?? '🏷️',
            'couleur' => $data['couleur'] ?? null,
            'negociable' => $data['negociable'] ?? false,
        ]);

        return (new CategoryResource($category))->response()->setStatusCode(201);
    }

    public function update(Request $request, int $id)
    {
        $category = $request->user()->categories()->findOrFail($id);
        $category->update($request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'emoji' => ['nullable', 'string', 'max:16'],
            'couleur' => ['nullable', 'string', 'max:32'],
            'negociable' => ['nullable', 'boolean'],
        ]));

        return new CategoryResource($category);
    }

    public function destroy(Request $request, int $id)
    {
        $category = $request->user()->categories()->findOrFail($id);

        if ($category->products()->count() > 0) {
            return response()->json(['error' => 'Impossible de supprimer : catégorie avec produits.'], 400);
        }

        $category->delete();

        return response()->json(['success' => true, 'message' => 'Catégorie supprimée avec succès']);
    }
}
