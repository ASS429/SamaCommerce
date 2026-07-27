<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AdminTransfer;
use App\Models\User;
use App\Models\Withdrawal;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class AdminStatsController extends Controller
{
    private function premiumValides()
    {
        return User::where('plan', 'Premium')->where('upgrade_status', 'validé');
    }

    public function overview()
    {
        $today = Carbon::today();
        $monthStart = Carbon::now()->startOfMonth();

        $totalUsers = User::count();
        $activePremium = (clone $this->premiumValides())
            ->where(fn ($q) => $q->whereNull('expiration')->orWhereDate('expiration', '>=', $today))
            ->count();
        $revenues = (float) $this->premiumValides()->sum('amount');
        $pending = User::where('plan', 'Premium')->where('upgrade_status', 'en attente')->count();

        $prevUsers = User::where('created_at', '<', $monthStart)->count();
        $prevRevenues = (float) (clone $this->premiumValides())->where('created_at', '<', $monthStart)->sum('amount');

        return response()->json([
            'totalUsers' => $totalUsers,
            'activePremium' => $activePremium,
            'revenues' => $revenues,
            'pending' => $pending,
            'growth' => [
                'totalUsers' => ['current' => $totalUsers, 'previous' => $prevUsers],
                'activePremium' => ['current' => $activePremium, 'previous' => $activePremium],
                'revenues' => ['current' => $revenues, 'previous' => $prevRevenues],
            ],
        ]);
    }

    public function revenus(Request $request)
    {
        $period = strtolower($request->query('period', 'monthly'));
        $balance = (float) $this->premiumValides()->sum('amount');

        $q = $this->premiumValides();
        if ($period === 'daily') $q->whereDate('expiration', Carbon::today());
        elseif ($period === 'weekly') $q->whereBetween('expiration', [Carbon::now()->startOfWeek(), Carbon::now()->endOfWeek()]);
        elseif ($period === 'monthly') $q->whereBetween('expiration', [Carbon::now()->startOfMonth(), Carbon::now()->endOfMonth()]);
        $periodTotal = $period === 'all' ? $balance : (float) $q->sum('amount');

        $pending = (float) User::where('plan', 'Premium')->where('upgrade_status', 'en attente')->sum('amount');

        return response()->json(compact('balance', 'periodTotal', 'pending', 'period'));
    }

    public function transactions(Request $request)
    {
        $limit = (int) $request->integer('limit', 10);
        return User::where('plan', 'Premium')
            ->orderByRaw('expiration IS NULL, expiration DESC')
            ->limit($limit)
            ->get(['id', 'username', 'plan', 'amount', 'payment_method', 'upgrade_status', 'expiration', 'created_at']);
    }

    public function accounts(Request $request)
    {
        $adminId = $request->user()->id;
        $accounts = ['orange' => 0.0, 'wave' => 0.0, 'cash' => 0.0];

        foreach ($this->premiumValides()->get(['payment_method', 'amount']) as $u) {
            if ($u->payment_method && isset($accounts[$u->payment_method])) {
                $accounts[$u->payment_method] += (float) $u->amount;
            }
        }
        foreach (Withdrawal::where('admin_id', $adminId)->where('status', 'validé')->get() as $w) {
            if (isset($accounts[$w->method])) $accounts[$w->method] -= (float) $w->amount;
        }
        foreach (AdminTransfer::where('admin_id', $adminId)->get() as $t) {
            if (isset($accounts[$t->from_account])) $accounts[$t->from_account] -= (float) $t->amount;
            if (isset($accounts[$t->to_account])) $accounts[$t->to_account] += (float) $t->amount;
        }

        $total = array_sum($accounts);
        $entries = (float) (clone $this->premiumValides())->whereDate('created_at', Carbon::today())->sum('amount');
        $withdrawals = (float) Withdrawal::where('admin_id', $adminId)->where('status', 'validé')
            ->whereDate('created_at', Carbon::today())->sum('amount');

        return response()->json([
            'accounts' => $accounts, 'total' => $total,
            'entries' => $entries, 'withdrawals' => $withdrawals, 'net' => $entries - $withdrawals,
        ]);
    }

    public function accountDetails(Request $request, string $method)
    {
        $adminId = $request->user()->id;
        return response()->json([
            'subscriptions' => $this->premiumValides()->where('payment_method', $method)
                ->orderByRaw('expiration IS NULL, expiration DESC')->limit(50)
                ->get(['username', 'amount', 'payment_method', 'expiration', 'created_at']),
            'withdrawals' => Withdrawal::where('admin_id', $adminId)->where('status', 'validé')->where('method', $method)
                ->orderByDesc('created_at')->limit(50)->get(['amount', 'status', 'created_at']),
            'transfers' => AdminTransfer::where('admin_id', $adminId)
                ->where(fn ($q) => $q->where('from_account', $method)->orWhere('to_account', $method))
                ->orderByDesc('created_at')->limit(50)->get(),
        ]);
    }

    public function evolution()
    {
        $year = Carbon::now()->year;
        $rows = $this->premiumValides()->whereNotNull('expiration')
            ->whereYear('expiration', $year)->get(['expiration', 'amount']);

        $byMonth = [];
        foreach ($rows as $r) {
            $key = Carbon::parse($r->expiration)->format('Y-m');
            $byMonth[$key] = ($byMonth[$key] ?? 0) + (float) $r->amount;
        }
        ksort($byMonth);

        return response()->json(array_map(fn ($mois, $total) => compact('mois', 'total'),
            array_keys($byMonth), array_values($byMonth)));
    }
}
