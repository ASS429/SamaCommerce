<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use Illuminate\Http\Request;

class ActivityController extends Controller
{
    /** Journal d'activité du tenant (50 dernières actions), boutique courante. */
    public function index(Request $request)
    {
        $query = ActivityLog::where('owner_id', $request->user()->id);

        $query->orderByDesc('id');

        // T9 — pagination opt-in (?page=N) ; sinon 50 dernières (rétro-compatible).
        if ($request->filled('page')) {
            return $query->paginate((int) $request->integer('per_page', 30));
        }

        return $query->limit(50)->get();
    }
}
