<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class FournisseurController extends Controller
{
    public function index(Request $request)
    {
        $bid = $request->user()->current_boutique_id;

        return $request->user()->fournisseurs()
            ->when($bid, fn ($q) => $q->where(fn ($w) => $w->where('boutique_id', $bid)->orWhereNull('boutique_id')))
            ->orderBy('name')->get();
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:32'],
            'email' => ['nullable', 'string', 'max:255'],
            'address' => ['nullable', 'string'],
            'notes' => ['nullable', 'string'],
        ]);

        return response()->json($request->user()->fournisseurs()->create(array_merge($data, [
            'boutique_id' => $request->user()->current_boutique_id,
        ])), 201);
    }

    public function update(Request $request, int $id)
    {
        $f = $request->user()->fournisseurs()->findOrFail($id);
        $f->update($request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:32'],
            'email' => ['nullable', 'string', 'max:255'],
            'address' => ['nullable', 'string'],
            'notes' => ['nullable', 'string'],
        ]));

        return $f;
    }

    public function destroy(Request $request, int $id)
    {
        $request->user()->fournisseurs()->findOrFail($id)->delete();

        return response()->json(['message' => 'Fournisseur supprimé']);
    }

    /** Message WhatsApp de réapprovisionnement (produits sous le seuil). */
    public function reapproMessage(Request $request, int $id)
    {
        $f = $request->user()->fournisseurs()->findOrFail($id);
        $boutique = $request->user()->company_name ?: 'Sama Commerce';

        $faibles = $request->user()->products()->where('stock', '<=', 5)->orderBy('stock')->get(['name', 'stock']);
        $lignes = $faibles->count()
            ? $faibles->map(fn ($p) => "- {$p->name} × " . max(1, 20 - $p->stock) . ' unités')->implode("\n")
            : '(Préciser les produits et quantités)';

        $message = "Bonjour {$f->name} 👋\n\nBesoin de réapprovisionner :\n\n{$lignes}\n\n"
            . "📅 Date souhaitée : " . ($request->query('date') ?: 'À confirmer') . "\n\n"
            . "Merci de confirmer disponibilité et prix.\n\n— {$boutique}";

        return response()->json([
            'fournisseur' => $f,
            'message' => $message,
            'produits_faibles' => $faibles,
            'whatsapp_url' => 'https://wa.me/' . preg_replace('/\s+/', '', (string) $f->phone) . '?text=' . rawurlencode($message),
        ]);
    }
}
