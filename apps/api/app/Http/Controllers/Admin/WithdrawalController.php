<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Withdrawal;
use Illuminate\Http\Request;

class WithdrawalController extends Controller
{
    public function index(Request $request)
    {
        return Withdrawal::where('admin_id', $request->user()->id)->orderByDesc('created_at')->get();
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'amount' => ['required', 'numeric', 'min:0'],
            'method' => ['required', 'string'],
        ]);

        $w = Withdrawal::create([
            'admin_id' => $request->user()->id,
            'amount' => $data['amount'],
            'method' => $data['method'],
            'status' => 'validé',
        ]);

        return response()->json(['message' => 'Demande de retrait enregistrée', 'withdrawal' => $w], 201);
    }
}
