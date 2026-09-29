<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class ControleurFournisseur extends Controleur
{
    public function lister(Request $requete)
    {

        return $requete->user()->fournisseurs()
            ->orderBy('nom')->get();
    }

    public function creer(Request $requete)
    {
        $donnees = $requete->validate([
            'nom' => ['required', 'string', 'max:255'],
            'telephone' => ['nullable', 'string', 'max:32'],
            'email' => ['nullable', 'string', 'max:255'],
            'adresse' => ['nullable', 'string'],
            'notes' => ['nullable', 'string'],
            'photo' => self::REGLES_PHOTO,
        ]);

        return response()->json($requete->user()->fournisseurs()->create(array_merge($donnees, [
            'boutique_id' => $requete->user()->boutique_active_id,
        ])), 201);
    }

    public function modifier(Request $requete, int $id)
    {
        $fournisseur = $requete->user()->fournisseurs()->findOrFail($id);
        $fournisseur->update($requete->validate([
            'nom' => ['sometimes', 'string', 'max:255'],
            'telephone' => ['nullable', 'string', 'max:32'],
            'email' => ['nullable', 'string', 'max:255'],
            'adresse' => ['nullable', 'string'],
            'notes' => ['nullable', 'string'],
            'photo' => self::REGLES_PHOTO,
        ]));

        return $fournisseur;
    }

    public function supprimer(Request $requete, int $id)
    {
        $requete->user()->fournisseurs()->findOrFail($id)->delete();

        return response()->json(['message' => 'Fournisseur supprimé']);
    }

    /**
     * Message WhatsApp de réapprovisionnement (produits sous le seuil).
     *
     * Le message est lu par un fournisseur pressé : une ligne = un produit, une
     * quantité, une unité. Les pictogrammes portent le sens même en diagonale.
     */
    public function messageReappro(Request $requete, int $id)
    {
        $fournisseur = $requete->user()->fournisseurs()->findOrFail($id);
        $proprietaire = $requete->user();
        $boutique = $proprietaire->nom_commerce ?: 'Sama Commerce';
        $seuil = max(1, (int) ($requete->query('seuil') ?: 5));
        // Couverture visée : on remonte chaque référence à ~3 semaines de stock.
        $cible = max($seuil * 4, 20);

        $faibles = $proprietaire->produits()
            ->where('stock', '<=', $seuil)->orderBy('stock')
            ->get(['nom', 'stock', 'unite_base']);

        $lignes = $faibles->count()
            ? $faibles->map(function ($p) use ($cible) {
                [$libelle, $facteur] = \App\Models\Produit::AFFICHAGE[$p->unite_base] ?? \App\Models\Produit::AFFICHAGE['piece'];
                $manque = max(1, (int) ceil(($cible - $p->stock) / $facteur));
                $reste = round($p->stock / $facteur, 2);

                return "• {$p->nom} × {$manque} {$libelle} (reste {$reste})";
            })->implode("\n")
            : '• (à préciser)';

        $date = $requete->query('date');
        $message = implode("\n", array_filter([
            '📋 *DEMANDE DE RÉAPPROVISIONNEMENT*',
            "🚚 {$fournisseur->nom}",
            '📅 ' . now()->format('d/m/Y'),
            '',
            $lignes,
            '',
            '🗓️ Livraison souhaitée : ' . ($date ?: 'à confirmer'),
            '',
            'Merci de confirmer disponibilité et prix 🙏',
            '',
            "🏪 *{$boutique}*",
            $proprietaire->telephone ? "📞 {$proprietaire->telephone}" : null,
        ], fn ($l) => $l !== null));

        // Numéro au format international attendu par wa.me (voir outils/whatsapp.ts
        // côté web : même normalisation, indicatif Sénégal par défaut).
        $chiffres = preg_replace('/\D+/', '', (string) $fournisseur->telephone);
        if ($chiffres !== '' && strlen($chiffres) <= 9) {
            $chiffres = '221' . ltrim($chiffres, '0');
        }

        return response()->json([
            'fournisseur' => $fournisseur,
            'message' => $message,
            'produits_faibles' => $faibles,
            'url_whatsapp' => 'https://wa.me/' . $chiffres . '?text=' . rawurlencode($message),
        ]);
    }
}
