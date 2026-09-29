<?php

namespace App\Console\Commands;

use App\Models\Produit;
use App\Models\Vente;
use Illuminate\Console\Command;

/**
 * T2 — Reconstitue les champs Phase 6 (quantite_base, cout_marchandises,
 * prix_reference, prix_reel, remise) des ventes créées AVANT le
 * fractionnement, pour qu'elles entrent dans les analyses de marge et de
 * marchandage. Estimations marquées `reconstituee = true`. Idempotente : ne
 * touche que les ventes sans coût.
 */
class ReconstituerVentes extends Command
{
    protected $signature = 'ventes:reconstituer {--essai : Affiche sans écrire}';

    protected $description = 'Reconstitue coût et quantite_base des ventes antérieures à la Phase 6';

    public function handle(): int
    {
        $essai = (bool) $this->option('essai');
        $selection = Vente::whereNull('cout_marchandises');
        $total = $selection->count();

        if ($total === 0) {
            $this->info('Aucune vente à reconstituer.');

            return self::SUCCESS;
        }

        $this->info(($essai ? '[ESSAI] ' : '')."Reconstitution de {$total} vente(s)...");
        $faites = 0;
        $ignorees = 0;

        $selection->chunkById(200, function ($ventes) use (&$faites, &$ignorees, $essai) {
            foreach ($ventes as $vente) {
                // Produit possiblement supprimé (corbeille) -> withTrashed.
                $produit = Produit::withTrashed()->find($vente->produit_id);
                if (! $produit) {
                    $ignorees++;
                    continue;
                }

                $facteur = $produit->facteurAffichage();
                $quantite = max(1, (int) $vente->quantite);
                $qb = $quantite * $facteur;                                        // quantite_base = quantité × facteur d'affichage
                $cout = (int) round($quantite * (float) $produit->prix_achat);     // coût estimé au prix d'achat actuel
                $reference = (int) round((float) $produit->prix_vente);
                $totalReference = $reference * $quantite;
                $totalVente = (int) $vente->total;
                $prixReel = $quantite > 0 ? (int) round($totalVente / $quantite) : $reference;

                if (! $essai) {
                    $vente->forceFill([
                        'quantite_base' => $qb,
                        'cout_marchandises' => $cout,
                        'prix_reference' => $reference,
                        'prix_reel' => $prixReel,
                        'remise' => max(0, $totalReference - $totalVente),
                        'libelle_conditionnement' => $produit->libelleAffichage(),
                        'reconstituee' => true,
                    ])->save();
                }
                $faites++;
            }
        });

        $this->info(($essai ? '[ESSAI] ' : '')."Terminé : {$faites} reconstituée(s), {$ignorees} ignorée(s) (produit introuvable).");

        return self::SUCCESS;
    }
}
