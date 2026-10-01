<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controleur;
use App\Models\Plan;
use App\Services\Abonnements;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Catalogue des plans : prix, limites et fonctionnalités, sans redéployer. */
class ControleurPlans extends Controleur
{
    public function lister()
    {
        return response()->json([
            'plans' => array_values(array_map(fn (Plan $p) => Abonnements::planPublic($p), Plan::catalogue())),
            'fonctionnalites' => Plan::FONCTIONNALITES,
        ]);
    }

    public function modifier(Request $requete, string $code)
    {
        $plan = Plan::where('code', $code)->firstOrFail();
        $limite = ['nullable', 'integer', 'min:0', 'max:1000000'];
        $donnees = $requete->validate([
            'nom' => ['sometimes', 'string', 'max:64'],
            'accroche' => ['sometimes', 'nullable', 'string', 'max:160'],
            'prix_mensuel' => ['sometimes', 'integer', 'min:0', 'max:10000000'],
            'sur_devis' => ['sometimes', 'boolean'],
            'prix_a_partir_de' => ['sometimes', 'nullable', 'integer', 'min:0', 'max:10000000'],
            'limites' => ['sometimes', 'array'],
            'limites.boutiques' => $limite,
            'limites.employes' => $limite,
            'limites.produits' => $limite,
            'limites.ia' => $limite,
            'fonctionnalites' => ['sometimes', 'array'],
            'fonctionnalites.*' => [Rule::in(array_keys(Plan::FONCTIONNALITES))],
        ]);

        // Le plan Gratuit reste gratuit : c'est lui qui accueille les comptes
        // dont l'abonnement a expiré.
        if ($plan->code === 'gratuit' && ((int) ($donnees['prix_mensuel'] ?? 0) > 0 || ($donnees['sur_devis'] ?? false))) {
            return response()->json(['erreur' => 'Le plan Gratuit ne peut pas devenir payant.'], 422);
        }

        $champs = collect($donnees)->except(['limites', 'fonctionnalites'])->all();
        foreach ($donnees['limites'] ?? [] as $cle => $valeur) {
            $champs[Plan::LIMITES[$cle]] = $valeur;
        }
        if (array_key_exists('fonctionnalites', $donnees)) {
            $champs['fonctionnalites'] = array_values(array_unique($donnees['fonctionnalites']));
        }
        $plan->update($champs);
        Plan::oublierCatalogue();

        return response()->json(['message' => "Plan {$plan->nom} mis à jour.", 'plan' => Abonnements::planPublic($plan->fresh())]);
    }
}
