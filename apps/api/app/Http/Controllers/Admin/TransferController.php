<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AdminTransfer;
use Illuminate\Http\Request;

class TransferController extends Controller
{
    public function index(Request $request)
    {
        return AdminTransfer::where('admin_id', $request->user()->id)->orderByDesc('created_at')->get();
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'from' => ['required', 'string', 'different:to'],
            'to' => ['required', 'string'],
            'amount' => ['required', 'numeric', 'min:0'],
        ]);

        $t = AdminTransfer::create([
            'admin_id' => $request->user()->id,
            'from_account' => $data['from'],
            'to_account' => $data['to'],
            'amount' => $data['amount'],
        ]);

        return response()->json(['message' => 'Transfert enregistré', 'transfer' => $t], 201);
    }
}
