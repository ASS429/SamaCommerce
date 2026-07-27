<?php

namespace App\Console\Commands;

use App\Models\Product;
use App\Models\Sale;
use Illuminate\Console\Command;

/**
 * T2 — Reconstitue les champs Phase 6 (quantite_base, cogs, prix_reference,
 * prix_reel, remise) des ventes créées AVANT le fractionnement, pour qu'elles
 * entrent dans les analyses de marge/marchandage. Estimations marquées
 * `backfilled = true`. Idempotent : ne touche que les ventes à cogs null.
 */
class BackfillSales extends Command
{
    protected $signature = 'sales:backfill {--dry-run : Affiche sans écrire}';

    protected $description = 'Reconstitue cogs/quantite_base des ventes pré-Phase 6';

    public function handle(): int
    {
        $dry = (bool) $this->option('dry-run');
        $query = Sale::whereNull('cogs');
        $total = $query->count();

        if ($total === 0) {
            $this->info('Aucune vente a reconstituer.');

            return self::SUCCESS;
        }

        $this->info(($dry ? '[DRY-RUN] ' : '')."Reconstitution de {$total} vente(s)...");
        $done = 0;
        $skipped = 0;

        $query->chunkById(200, function ($sales) use (&$done, &$skipped, $dry) {
            foreach ($sales as $sale) {
                // Produit possiblement supprime (soft delete) -> withTrashed.
                $product = Product::withTrashed()->find($sale->product_id);
                if (! $product) {
                    $skipped++;
                    continue;
                }

                $df = $product->displayFactor();
                $qty = max(1, (int) $sale->quantity);
                $qb = $qty * $df;                                   // quantite_base = quantite x facteur d'affichage
                $cogs = (int) round($qty * (float) $product->price_achat); // cout estime au prix d'achat actuel
                $reference = (int) round((float) $product->price);
                $referenceTotal = $reference * $qty;
                $total = (int) $sale->total;
                $prixReel = $qty > 0 ? (int) round($total / $qty) : $reference;

                if (! $dry) {
                    $sale->forceFill([
                        'quantite_base' => $qb,
                        'cogs' => $cogs,
                        'prix_reference' => $reference,
                        'prix_reel' => $prixReel,
                        'remise' => max(0, $referenceTotal - $total),
                        'unit_libelle' => $product->displayLabel(),
                        'backfilled' => true,
                    ])->save();
                }
                $done++;
            }
        });

        $this->info(($dry ? '[DRY-RUN] ' : '')."Termine : {$done} reconstituee(s), {$skipped} ignoree(s) (produit introuvable).");

        return self::SUCCESS;
    }
}
