<?php

namespace App\Http\Controllers;

use App\Services\IaClient;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class IaController extends Controller
{
    public function __construct(private IaClient $ia) {}

    /**
     * Module A — Prévision de la demande & réapprovisionnement.
     * Pour chaque produit : demande quotidienne moyenne, jours avant rupture,
     * quantité conseillée à recommander (couverture ~14 jours).
     */
    public function reappro(Request $request)
    {
        $user = $request->user();
        $bid = $user->current_boutique_id;
        $products = $user->products()
            ->get();

        $since = Carbon::today()->subDays(30);
        $sales = $user->sales()->where('created_at', '>=', $since)->get(['product_id', 'quantity', 'quantite_base', 'created_at']);

        // Agrégation [product_id][date] = quantité vendue en unités de base
        $byProd = [];
        foreach ($sales as $s) {
            $d = Carbon::parse($s->created_at)->toDateString();
            $base = $s->quantite_base ?? $s->quantity; // rétro-compat
            $byProd[$s->product_id][$d] = ($byProd[$s->product_id][$d] ?? 0) + $base;
        }

        $out = [];
        foreach ($products as $p) {
            $series = [];
            for ($i = 29; $i >= 0; $i--) {
                $d = Carbon::today()->subDays($i)->toDateString();
                $series[] = (float) ($byProd[$p->id][$d] ?? 0);
            }

            $res = $this->ia->forecast([
                'product_id' => $p->id,
                'current_stock_base' => (float) $p->stock,
                'history_daily_base' => $series,
            ]);

            if (! $res) {
                $avg = $this->weightedAvg($series);
                $daysLeft = $avg > 0 ? $p->stock / $avg : null;
                $res = [
                    'avg_daily_demand_base' => round($avg, 3),
                    'days_until_stockout' => $daysLeft !== null ? round($daysLeft, 1) : null,
                    'recommended_reorder_base' => round(max($avg * 14 - $p->stock, 0), 3),
                    'method' => 'heuristic',
                ];
            }

            $df = $p->displayFactor();
            $out[] = [
                'product_id' => $p->id,
                'name' => $p->name,
                'display_label' => $p->displayLabel(),
                'stock_display' => round($p->stock / $df, 2),
                'avg_daily_display' => round(($res['avg_daily_demand_base'] ?? 0) / $df, 3),
                'days_until_stockout' => $res['days_until_stockout'] ?? null,
                'reorder_display' => round(($res['recommended_reorder_base'] ?? 0) / $df, 2),
                'method' => $res['method'] ?? 'heuristic',
            ];
        }

        // Tri par urgence (rupture la plus proche en premier, sans rupture en dernier)
        usort($out, function ($a, $b) {
            $av = $a['days_until_stockout']; $bv = $b['days_until_stockout'];
            if ($av === null && $bv === null) return 0;
            if ($av === null) return 1;
            if ($bv === null) return -1;

            return $av <=> $bv;
        });

        return response()->json($out);
    }

    /**
     * Module B — Scoring de la vente à crédit.
     * Calcule l'historique du client (crédits passés, remboursés à temps,
     * retard moyen) et renvoie un score 0-100 + niveau de risque.
     */
    public function creditScore(Request $request)
    {
        $data = $request->validate([
            'amount' => ['required', 'numeric', 'min:0'],
            'due_date' => ['nullable', 'date'],
            'client_name' => ['nullable', 'string'],
            'client_id' => ['nullable', 'integer'],
        ]);

        $user = $request->user();
        $dueInDays = ! empty($data['due_date'])
            ? max(0, (int) Carbon::today()->diffInDays(Carbon::parse($data['due_date']), false))
            : 15;

        $q = $user->sales()->where('payment_method', 'credit');
        if (! empty($data['client_id'])) {
            $q->where('client_id', $data['client_id']);
        } elseif (! empty($data['client_name'])) {
            $q->where('client_name', $data['client_name']);
        } else {
            $q->whereRaw('1 = 0'); // pas de client identifié -> nouveau
        }
        $credits = $q->get();

        $pastCredits = $credits->count();
        $repaid = $credits->where('paid', true);
        $onTime = 0; $lateDays = [];
        foreach ($repaid as $s) {
            if ($s->due_date) {
                $late = (int) Carbon::parse($s->due_date)->diffInDays(Carbon::parse($s->updated_at), false);
                $late <= 0 ? $onTime++ : $lateDays[] = $late;
            } else {
                $onTime++;
            }
        }
        $avgLate = count($lateDays) ? array_sum($lateDays) / count($lateDays) : 0.0;

        $payload = [
            'amount' => (float) $data['amount'],
            'due_in_days' => $dueInDays,
            'past_credits' => $pastCredits,
            'past_repaid_on_time' => $onTime,
            'avg_days_late' => round($avgLate, 1),
        ];

        $res = $this->ia->creditScore($payload) ?? $this->creditHeuristic($payload);

        return response()->json($res);
    }

    // --- Heuristiques PHP (miroir du micro-service) ---

    private function weightedAvg(array $history): float
    {
        $window = array_slice($history, -14);
        $n = count($window);
        if ($n === 0) {
            return 0.0;
        }
        $num = 0; $den = 0;
        foreach ($window as $i => $v) {
            $w = $i + 1;
            $num += $v * $w; $den += $w;
        }

        return $den > 0 ? $num / $den : 0.0;
    }

    private function creditHeuristic(array $r): array
    {
        $score = 60;
        if ($r['past_credits'] > 0) {
            $ratio = $r['past_repaid_on_time'] / $r['past_credits'];
            $score += (int) ($ratio * 35) - 10;
        }
        $score -= min((int) $r['avg_days_late'], 25);
        $score -= intdiv(max(0, $r['due_in_days'] - 15), 5);
        if ($r['amount'] > 30000) {
            $score -= 5;
        }
        $score = max(0, min(100, $score));
        $risk = $score >= 70 ? 'green' : ($score >= 45 ? 'amber' : 'red');

        return ['score' => $score, 'risk' => $risk, 'reasons' => $this->creditReasons($r), 'method' => 'heuristic'];
    }

    private function creditReasons(array $r): array
    {
        $reasons = [];
        if ($r['past_credits'] == 0) {
            $reasons[] = 'Nouveau client, aucun historique de crédit';
        } else {
            $reasons[] = "{$r['past_repaid_on_time']}/{$r['past_credits']} crédits remboursés à temps";
            if ($r['avg_days_late'] > 0) {
                $reasons[] = 'Retard moyen passé : '.round($r['avg_days_late']).' jours';
            }
        }
        if ($r['due_in_days'] > 15) {
            $reasons[] = "Échéance longue ({$r['due_in_days']} jours)";
        }

        return $reasons;
    }
}
