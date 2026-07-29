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
            'photo' => self::PHOTO_RULES,
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
            'photo' => self::PHOTO_RULES,
        ]));

        return $f;
    }

    public function destroy(Request $request, int $id)
    {
        $request->user()->fournisseurs()->findOrFail($id)->delete();

        return response()->json(['message' => 'Fournisseur supprimé']);
    }

    /**
     * Message WhatsApp de réapprovisionnement (produits sous le seuil).
     *
     * Le message est lu par un fournisseur pressé : une ligne = un produit, une
     * quantité, une unité. Les pictogrammes portent le sens même en diagonale.
     */
    public function reapproMessage(Request $request, int $id)
    {
        $f = $request->user()->fournisseurs()->findOrFail($id);
        $user = $request->user();
        $boutique = $user->company_name ?: 'Sama Commerce';
        $seuil = max(1, (int) ($request->query('seuil') ?: 5));
        // Couverture visée : on remonte chaque référence à ~3 semaines de stock.
        $cible = max($seuil * 4, 20);

        $faibles = $user->products()
            ->where('stock', '<=', $seuil)->orderBy('stock')
            ->get(['name', 'stock', 'unite_base']);

        $lignes = $faibles->count()
            ? $faibles->map(function ($p) use ($cible) {
                [$label, $facteur] = \App\Models\Product::DISPLAY[$p->unite_base] ?? \App\Models\Product::DISPLAY['piece'];
                $manque = max(1, (int) ceil(($cible - $p->stock) / $facteur));
                $reste = round($p->stock / $facteur, 2);

                return "• {$p->name} × {$manque} {$label} (reste {$reste})";
            })->implode("\n")
            : '• (à préciser)';

        $date = $request->query('date');
        $message = implode("\n", array_filter([
            '📋 *DEMANDE DE RÉAPPROVISIONNEMENT*',
            "🚚 {$f->name}",
            '📅 ' . now()->format('d/m/Y'),
            '',
            $lignes,
            '',
            '🗓️ Livraison souhaitée : ' . ($date ?: 'à confirmer'),
            '',
            'Merci de confirmer disponibilité et prix 🙏',
            '',
            "🏪 *{$boutique}*",
            $user->phone ? "📞 {$user->phone}" : null,
        ], fn ($l) => $l !== null));

        // Numéro au format international attendu par wa.me (voir lib/whatsapp.ts
        // côté web : même normalisation, indicatif Sénégal par défaut).
        $digits = preg_replace('/\D+/', '', (string) $f->phone);
        if ($digits !== '' && strlen($digits) <= 9) {
            $digits = '221' . ltrim($digits, '0');
        }

        return response()->json([
            'fournisseur' => $f,
            'message' => $message,
            'produits_faibles' => $faibles,
            'whatsapp_url' => 'https://wa.me/' . $digits . '?text=' . rawurlencode($message),
        ]);
    }
}
