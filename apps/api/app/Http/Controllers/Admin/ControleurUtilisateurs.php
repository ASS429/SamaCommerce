<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controleur;
use App\Models\Utilisateur;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class ControleurUtilisateurs extends Controleur
{
    public function lister()
    {
        return Utilisateur::orderByDesc('id')->get();
    }

    public function creer(Request $requete)
    {
        $donnees = $requete->validate([
            'identifiant' => ['required', 'string', 'unique:utilisateurs,identifiant'],
            'nom_commerce' => ['nullable', 'string'],
            'telephone' => ['nullable', 'string'],
            'plan' => ['nullable', 'in:Gratuit,Premium'],
            'moyen_paiement' => ['nullable', 'string'],
        ]);

        $utilisateur = Utilisateur::create([
            'identifiant' => $donnees['identifiant'],
            'mot_de_passe' => Hash::make('password'),
            'nom_commerce' => $donnees['nom_commerce'] ?? null,
            'telephone' => $donnees['telephone'] ?? null,
            'plan' => $donnees['plan'] ?? 'Gratuit',
            'moyen_paiement' => $donnees['moyen_paiement'] ?? null,
            'statut_demande_premium' => ($donnees['plan'] ?? 'Gratuit') === 'Premium' ? 'en attente' : 'validé',
        ]);

        return response()->json($utilisateur, 201);
    }

    public function bloquer(int $id)
    {
        $utilisateur = Utilisateur::findOrFail($id);
        $utilisateur->update(['statut' => 'Bloqué']);
        return $utilisateur;
    }

    public function activer(int $id)
    {
        $utilisateur = Utilisateur::findOrFail($id);
        $utilisateur->update(['statut' => 'Actif', 'statut_paiement' => 'À jour']);
        return $utilisateur;
    }

    public function supprimer(int $id)
    {
        Utilisateur::findOrFail($id)->delete();
        return response()->json(['message' => 'Utilisateur supprimé']);
    }

    public function relancer(int $id)
    {
        $utilisateur = Utilisateur::findOrFail($id);
        return response()->json(['message' => "Rappel envoyé à {$utilisateur->identifiant}"]);
    }

    public function validerPassagePremium(int $id)
    {
        $utilisateur = Utilisateur::findOrFail($id);
        $utilisateur->update(['plan' => 'Premium', 'statut_demande_premium' => 'validé']);
        return $utilisateur;
    }

    public function refuserPassagePremium(int $id)
    {
        $utilisateur = Utilisateur::findOrFail($id);
        $utilisateur->update(['plan' => 'Gratuit', 'statut_demande_premium' => 'rejeté']);
        return $utilisateur;
    }
}
