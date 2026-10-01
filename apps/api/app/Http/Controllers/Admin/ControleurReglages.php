<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controleur;
use App\Models\Plan;
use App\Models\ReglagesAbonnement;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Règles d'abonnement : essai, délai de grâce, remise annuelle, où payer, rappels. */
class ControleurReglages extends Controleur
{
    public function afficher()
    {
        return response()->json($this->publics(ReglagesAbonnement::courants()));
    }

    public function modifier(Request $requete)
    {
        $numero = ['sometimes', 'nullable', 'string', 'max:32', 'regex:/^[0-9 +().-]{7,32}$/'];
        $donnees = $requete->validate([
            'duree_essai_jours' => ['sometimes', 'integer', 'min:0', 'max:365'],
            'plan_essai' => ['sometimes', Rule::in(collect(Plan::catalogue())->filter(fn (Plan $p) => $p->estPayant())->keys()->all())],
            'delai_grace_jours' => ['sometimes', 'integer', 'min:0', 'max:60'],
            'mois_offerts_annuel' => ['sometimes', 'integer', 'min:0', 'max:11'],
            'numero_wave' => $numero,
            'numero_orange' => $numero,
            'nom_beneficiaire' => ['sometimes', 'nullable', 'string', 'max:120'],
            'reference_obligatoire' => ['sometimes', 'boolean'],
            'capture_autorisee' => ['sometimes', 'boolean'],
            'rappels' => ['sometimes', 'array'],
            'rappels.*' => [Rule::in(array_keys(ReglagesAbonnement::RAPPELS))],
            'message_relance' => ['sometimes', 'nullable', 'string', 'max:600'],
        ], [
            'numero_wave.regex' => 'Numéro Wave invalide.',
            'numero_orange.regex' => 'Numéro Orange Money invalide.',
        ]);

        $reglages = ReglagesAbonnement::courants();
        $reglages->update($donnees);
        ReglagesAbonnement::oublier();

        return response()->json(['message' => 'Réglages enregistrés.', 'reglages' => $this->publics(ReglagesAbonnement::courants())]);
    }

    private function publics(ReglagesAbonnement $r): array
    {
        return $r->only([
            'duree_essai_jours', 'plan_essai', 'delai_grace_jours', 'mois_offerts_annuel', 'numero_wave',
            'numero_orange', 'nom_beneficiaire', 'reference_obligatoire', 'capture_autorisee', 'rappels', 'message_relance',
        ]) + ['rappels_possibles' => ReglagesAbonnement::RAPPELS];
    }
}
