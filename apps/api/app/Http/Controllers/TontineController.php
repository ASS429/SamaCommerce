<?php

namespace App\Http\Controllers;

use App\Models\Tontine;
use Illuminate\Http\Request;

class TontineController extends Controller
{
    public function index()
    {
        return Tontine::orderByDesc('created_date')->get();
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'type' => ['nullable', 'string', 'max:255'],
            'amount' => ['nullable', 'numeric', 'min:0'],
            'members' => ['nullable', 'integer', 'min:0'],
        ]);

        return response()->json(Tontine::create($data), 201);
    }
}
