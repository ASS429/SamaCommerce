<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controleur;
use App\Models\ParametreAdmin;
use Illuminate\Http\Request;

class ControleurParametres extends Controleur
{
    public function afficher(Request $requete)
    {
        return ParametreAdmin::firstOrCreate(['admin_id' => $requete->user()->id]);
    }

    public function modifier(Request $requete)
    {
        $parametres = ParametreAdmin::firstOrCreate(['admin_id' => $requete->user()->id]);

        $parametres->update($requete->validate([
            'nom_application' => ['nullable', 'string'],
            'email_contact' => ['nullable', 'string'],
            'fuseau_horaire' => ['nullable', 'string'],
            'prix_premium' => ['nullable', 'numeric'],
            'delai_grace' => ['nullable', 'integer'],
            'alertes_actives' => ['nullable', 'boolean'],
            'notifier_nouveaux_abonnes' => ['nullable', 'boolean'],
            'notifier_retards_paiement' => ['nullable', 'boolean'],
            'notifier_rapports' => ['nullable', 'boolean'],
            'sessions_multiples' => ['nullable', 'boolean'],
        ]));

        return response()->json(['message' => 'Paramètres mis à jour', 'parametres' => $parametres]);
    }
}
