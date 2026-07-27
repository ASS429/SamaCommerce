<?php

namespace App\Http\Controllers;

use App\Models\CaisseClosing;
use App\Models\Retour;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class CaisseController extends Controller
{
    /** Agrégats d'un ensemble de ventes par mode de paiement. */
    private function aggregate($sales): array
    {
        $paid = $sales->where('paid', true);
        return [
            'nb_ventes' => $sales->count(),
            'especes' => (float) $paid->where('payment_method', 'especes')->sum('total'),
            'wave' => (float) $paid->where('payment_method', 'wave')->sum('total'),
            'orange' => (float) $paid->where('payment_method', 'orange')->sum('total'),
            'credits' => (float) $sales->where('paid', false)->where('payment_method', 'credit')->sum('total'),
            'total_encaisse' => (float) $paid->sum('total'),
            'total_ca' => (float) $sales->sum('total'),
        ];
    }

    public function today(Request $request)
    {
        $sales = $request->user()->sales()->whereDate('created_at', Carbon::today())->get();
        $data = $this->aggregate($sales);
        $retours = Retour::where('user_id', $request->user()->id)->whereDate('created_at', Carbon::today())->get();
        $data['total_retours'] = (float) $retours->sum('refund_amount');
        $data['nb_retours'] = $retours->count();
        $data['net'] = $data['total_encaisse'] - $data['total_retours'];

        return response()->json($data);
    }

    public function close(Request $request)
    {
        $sales = $request->user()->sales()->whereDate('created_at', Carbon::today())->get();
        $a = $this->aggregate($sales);
        $retours = (float) Retour::where('user_id', $request->user()->id)->whereDate('created_at', Carbon::today())->sum('refund_amount');
        $net = $a['total_encaisse'] - $retours;

        $closing = CaisseClosing::updateOrCreate(
            ['user_id' => $request->user()->id, 'date' => Carbon::today()->toDateString()],
            [
                'total_especes' => $a['especes'], 'total_wave' => $a['wave'], 'total_orange' => $a['orange'],
                'total_credits' => $a['credits'], 'total_retours' => $retours, 'total_net' => $net,
                'nb_ventes' => $a['nb_ventes'], 'notes' => $request->input('notes'),
            ],
        );

        \App\Models\ActivityLog::record($request, 'caisse.cloture', 'Net '.number_format($net, 0, '', ' ').' FCFA — '.$a['nb_ventes'].' ventes');

        return response()->json($closing);
    }

    public function history(Request $request)
    {
        return CaisseClosing::where('user_id', $request->user()->id)->orderByDesc('date')->limit(30)->get();
    }

    public function weekly(Request $request)
    {
        $sales = $request->user()->sales()->where('created_at', '>=', Carbon::now()->subDays(7))->get();
        $result = [];
        for ($i = 6; $i >= 0; $i--) {
            $day = Carbon::today()->subDays($i);
            $ds = $day->toDateString();
            $of = $sales->filter(fn ($s) => Carbon::parse($s->created_at)->toDateString() === $ds);
            $a = $this->aggregate($of);
            $result[] = [
                'date' => $ds, 'nb_ventes' => $a['nb_ventes'], 'total_encaisse' => $a['total_encaisse'],
                'especes' => $a['especes'], 'wave' => $a['wave'], 'orange' => $a['orange'], 'credits' => $a['credits'],
            ];
        }

        return response()->json($result);
    }
}
