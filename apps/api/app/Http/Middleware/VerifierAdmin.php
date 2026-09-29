<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class VerifierAdmin
{
    public function handle(Request $requete, Closure $suite): Response
    {
        if (! $requete->user() || $requete->user()->role !== 'admin') {
            return response()->json(['erreur' => 'Accès réservé aux administrateurs'], 403);
        }

        return $suite($requete);
    }
}
