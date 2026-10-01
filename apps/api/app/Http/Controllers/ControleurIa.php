<?php

namespace App\Http\Controllers;

use App\Models\ConsommationIa;
use App\Services\Abonnements;
use App\Services\ClientIa;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class ControleurIa extends Controleur
{
    public function __construct(private ClientIa $ia) {}

    /**
     * Module A — Prévision de la demande et réapprovisionnement.
     * Pour chaque produit : demande quotidienne moyenne, jours avant rupture,
     * quantité conseillée à recommander (couverture ~14 jours).
     */
    public function reappro(Request $requete)
    {
        $proprietaire = $requete->user();
        // Quota de conseils IA du plan (402 au-delà). Compté après succès.
        Abonnements::exigerConseilIa($proprietaire);
        $produits = $proprietaire->produits()
            ->get();

        $depuis = Carbon::today()->subDays(30);
        $ventes = $proprietaire->ventes()->where('cree_le', '>=', $depuis)->get(['produit_id', 'quantite', 'quantite_base', 'cree_le']);

        // Agrégation [produit_id][date] = quantité vendue en unités de base
        $parProduit = [];
        foreach ($ventes as $v) {
            $jour = Carbon::parse($v->cree_le)->toDateString();
            $base = $v->quantite_base ?? $v->quantite; // rétro-compat
            $parProduit[$v->produit_id][$jour] = ($parProduit[$v->produit_id][$jour] ?? 0) + $base;
        }

        $resultat = [];
        foreach ($produits as $p) {
            $serie = [];
            for ($i = 29; $i >= 0; $i--) {
                $jour = Carbon::today()->subDays($i)->toDateString();
                $serie[] = (float) ($parProduit[$p->id][$jour] ?? 0);
            }

            $prevision = $this->ia->prevision([
                'produit_id' => $p->id,
                'stock_actuel_base' => (float) $p->stock,
                'historique_jour_base' => $serie,
            ]);

            if (! $prevision) {
                $moyenne = $this->moyennePonderee($serie);
                $joursRestants = $moyenne > 0 ? $p->stock / $moyenne : null;
                $prevision = [
                    'demande_moyenne_jour_base' => round($moyenne, 3),
                    'jours_avant_rupture' => $joursRestants !== null ? round($joursRestants, 1) : null,
                    'reassort_conseille_base' => round(max($moyenne * 14 - $p->stock, 0), 3),
                    'methode' => 'heuristique',
                ];
            }

            $facteur = $p->facteurAffichage();
            $resultat[] = [
                'produit_id' => $p->id,
                'nom' => $p->nom,
                'libelle_affichage' => $p->libelleAffichage(),
                'stock_affiche' => round($p->stock / $facteur, 2),
                'moyenne_jour_affichee' => round(($prevision['demande_moyenne_jour_base'] ?? 0) / $facteur, 3),
                'jours_avant_rupture' => $prevision['jours_avant_rupture'] ?? null,
                'a_commander_affiche' => round(($prevision['reassort_conseille_base'] ?? 0) / $facteur, 2),
                'methode' => $prevision['methode'] ?? 'heuristique',
            ];
        }

        // Tri par urgence (rupture la plus proche en premier, sans rupture en dernier)
        usort($resultat, function ($a, $b) {
            $ja = $a['jours_avant_rupture']; $jb = $b['jours_avant_rupture'];
            if ($ja === null && $jb === null) return 0;
            if ($ja === null) return 1;
            if ($jb === null) return -1;

            return $ja <=> $jb;
        });

        ConsommationIa::compter($proprietaire->id);

        return response()->json($resultat);
    }

    /**
     * Module B — Score de la vente à crédit.
     * Calcule l'historique du client (crédits passés, remboursés à temps,
     * retard moyen) et renvoie un score 0-100 + niveau de risque.
     */
    public function scoreCredit(Request $requete)
    {
        $donnees = $requete->validate([
            'montant' => ['required', 'numeric', 'min:0'],
            'date_echeance' => ['nullable', 'date'],
            'nom_client' => ['nullable', 'string'],
            'client_id' => ['nullable', 'integer'],
        ]);

        $proprietaire = $requete->user();
        Abonnements::exigerConseilIa($proprietaire);
        $joursAvantEcheance = ! empty($donnees['date_echeance'])
            ? max(0, (int) Carbon::today()->diffInDays(Carbon::parse($donnees['date_echeance']), false))
            : 15;

        $selection = $proprietaire->ventes()->where('moyen_paiement', 'credit');
        if (! empty($donnees['client_id'])) {
            $selection->where('client_id', $donnees['client_id']);
        } elseif (! empty($donnees['nom_client'])) {
            $selection->where('nom_client', $donnees['nom_client']);
        } else {
            $selection->whereRaw('1 = 0'); // pas de client identifié -> nouveau
        }
        $credits = $selection->get();

        $creditsPasses = $credits->count();
        $regles = $credits->where('paye', true);
        $aTemps = 0; $joursDeRetard = [];
        foreach ($regles as $v) {
            if ($v->date_echeance) {
                $retard = (int) Carbon::parse($v->date_echeance)->diffInDays(Carbon::parse($v->modifie_le), false);
                $retard <= 0 ? $aTemps++ : $joursDeRetard[] = $retard;
            } else {
                $aTemps++;
            }
        }
        $retardMoyen = count($joursDeRetard) ? array_sum($joursDeRetard) / count($joursDeRetard) : 0.0;

        $profil = [
            'montant' => (float) $donnees['montant'],
            'jours_avant_echeance' => $joursAvantEcheance,
            'credits_passes' => $creditsPasses,
            'rembourses_a_temps' => $aTemps,
            'retard_moyen_jours' => round($retardMoyen, 1),
        ];

        $score = $this->ia->scoreCredit($profil) ?? $this->scoreHeuristique($profil);

        ConsommationIa::compter($proprietaire->id);

        return response()->json($score);
    }

    // --- Heuristiques PHP (miroir du micro-service) ---

    private function moyennePonderee(array $historique): float
    {
        $fenetre = array_slice($historique, -14);
        $n = count($fenetre);
        if ($n === 0) {
            return 0.0;
        }
        $numerateur = 0; $denominateur = 0;
        foreach ($fenetre as $i => $v) {
            $poids = $i + 1;
            $numerateur += $v * $poids; $denominateur += $poids;
        }

        return $denominateur > 0 ? $numerateur / $denominateur : 0.0;
    }

    private function scoreHeuristique(array $p): array
    {
        $score = 60;
        if ($p['credits_passes'] > 0) {
            $taux = $p['rembourses_a_temps'] / $p['credits_passes'];
            $score += (int) ($taux * 35) - 10;
        }
        $score -= min((int) $p['retard_moyen_jours'], 25);
        $score -= intdiv(max(0, $p['jours_avant_echeance'] - 15), 5);
        if ($p['montant'] > 30000) {
            $score -= 5;
        }
        $score = max(0, min(100, $score));
        $risque = $score >= 70 ? 'vert' : ($score >= 45 ? 'orange' : 'rouge');

        return ['score' => $score, 'risque' => $risque, 'raisons' => $this->raisonsCredit($p), 'methode' => 'heuristique'];
    }

    private function raisonsCredit(array $p): array
    {
        $raisons = [];
        if ($p['credits_passes'] == 0) {
            $raisons[] = 'Nouveau client, aucun historique de crédit';
        } else {
            $raisons[] = "{$p['rembourses_a_temps']}/{$p['credits_passes']} crédits remboursés à temps";
            if ($p['retard_moyen_jours'] > 0) {
                $raisons[] = 'Retard moyen passé : '.round($p['retard_moyen_jours']).' jours';
            }
        }
        if ($p['jours_avant_echeance'] > 15) {
            $raisons[] = "Échéance longue ({$p['jours_avant_echeance']} jours)";
        }

        return $raisons;
    }
}
