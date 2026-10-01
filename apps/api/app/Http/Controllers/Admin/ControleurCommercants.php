<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\ControleurAbonnement;
use App\Http\Controllers\Controleur;
use App\Models\MembreBoutique;
use App\Models\PaiementAbonnement;
use App\Models\Plan;
use App\Models\Utilisateur;
use App\Services\Abonnements;
use App\Services\EtatAbonnement;
use App\Services\RappelsAbonnement;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Les commerçants vus par l'administrateur : plan qui s'applique, échéance,
 * dernière activité, et fiche détaillée (utilisation, paiements, relance).
 */
class ControleurCommercants extends Controleur
{
    public const FILTRES = ['tous', 'essai', 'payants', 'bientot', 'expires', 'bloques', 'attente'];

    public function lister(Request $requete)
    {
        $filtre = in_array($requete->query('filtre'), self::FILTRES, true) ? $requete->query('filtre') : 'tous';
        $recherche = mb_strtolower(trim((string) $requete->query('recherche', '')));

        $lignes = $this->comptes()->map(fn (Utilisateur $u) => $this->ligne($u));

        $compteurs = collect(self::FILTRES)->mapWithKeys(fn ($f) => [$f => $lignes->filter(fn ($l) => $this->correspond($l, $f))->count()]);

        $visibles = $lignes
            ->filter(fn ($l) => $this->correspond($l, $filtre))
            ->filter(fn ($l) => $recherche === '' || str_contains(mb_strtolower($l['nom_commerce'].' '.$l['identifiant'].' '.$l['telephone']), $recherche))
            ->values();

        return response()->json(['commercants' => $visibles, 'compteurs' => $compteurs]);
    }

    public function afficher(int $id)
    {
        $compte = $this->comptes()->firstWhere('id', $id) ?? abort(404, 'Commerçant introuvable.');
        $etat = Abonnements::etat($compte);

        return response()->json($this->ligne($compte, $etat) + [
            'etat' => Abonnements::versTableau($etat),
            'utilisation' => Abonnements::utilisation($compte),
            'paiements' => PaiementAbonnement::leger()->where('utilisateur_id', $compte->id)
                ->latest('cree_le')->limit(50)->get()
                ->map(fn ($p) => ControleurAbonnement::paiementPublic($p))->values(),
            'relance' => [
                'texte' => RappelsAbonnement::texte($compte, $etat),
                'lien_whatsapp' => RappelsAbonnement::lienWhatsApp($compte, $etat),
            ],
        ]);
    }

    /** « Offrir des jours » : prolonge (ou ouvre) une période, sans paiement. */
    public function offrir(Request $requete, int $id)
    {
        $donnees = $requete->validate([
            'jours' => ['required', 'integer', 'min:1', 'max:366'],
            'plan' => ['nullable', Rule::in($this->codesPayants())],
        ]);
        $compte = Utilisateur::where('role', '!=', 'admin')->findOrFail($id);
        $etat = Abonnements::etat($compte);
        $plan = Plan::parCode($donnees['plan'] ?? ($etat->planPaye ?? $etat->planEssai ?? Plan::parCode('essentiel'))->code);

        $paiement = Abonnements::enregistrerGeste($compte, $requete->user(), $plan, (int) $donnees['jours'], 'mois', 'offert', 0);

        return response()->json([
            'message' => "{$donnees['jours']} jour(s) de {$plan->nom} offert(s).",
            'paiement' => ControleurAbonnement::paiementPublic($paiement),
        ], 201);
    }

    /** « Changer de plan » : paiement reçu hors application (espèces…) ou plan offert. */
    public function changerPlan(Request $requete, int $id)
    {
        $donnees = $requete->validate([
            'plan' => ['required', Rule::in($this->codesPayants())],
            'periode' => ['required', 'in:mois,an'],
            'moyen' => ['required', 'in:especes,wave,orange,offert'],
            'montant' => ['nullable', 'integer', 'min:0', 'max:10000000'],
        ]);
        $compte = Utilisateur::where('role', '!=', 'admin')->findOrFail($id);
        $plan = Plan::parCode($donnees['plan']);
        $montant = $donnees['moyen'] === 'offert' ? 0 : ($donnees['montant'] ?? Abonnements::montantAttendu($plan, $donnees['periode']));

        $paiement = Abonnements::enregistrerGeste($compte, $requete->user(), $plan, null, $donnees['periode'], $donnees['moyen'], $montant);

        return response()->json([
            'message' => "Plan {$plan->nom} enregistré.",
            'paiement' => ControleurAbonnement::paiementPublic($paiement),
        ], 201);
    }

    /** @return string[] */
    private function codesPayants(): array
    {
        return collect(Plan::catalogue())->filter(fn (Plan $p) => $p->estPayant())->keys()->all();
    }

    /**
     * Les commerçants : tous les comptes sauf l'administrateur et les comptes
     * d'employés (rattachés à la boutique d'un autre).
     *
     * @return Collection<int, Utilisateur>
     */
    private function comptes(): Collection
    {
        $employes = MembreBoutique::where('statut', 'acceptee')->whereNotNull('membre_id')->pluck('membre_id');

        return Utilisateur::query()
            ->where('role', '!=', 'admin')
            ->whereNotIn('id', $employes)
            ->orderByDesc('cree_le')->orderByDesc('id')
            ->get();
    }

    private function ligne(Utilisateur $compte, ?EtatAbonnement $etat = null): array
    {
        $etat ??= Abonnements::etat($compte);
        $jours = $etat->joursRestants();
        $enAttente = PaiementAbonnement::where('utilisateur_id', $compte->id)->where('statut', 'en_attente')->exists();
        $derniereActivite = DB::table('personal_access_tokens')
            ->where('tokenable_id', $compte->id)->max('last_used_at');

        $statut = match (true) {
            $compte->statut === 'Bloqué' => 'bloque',
            $enAttente => 'attente',
            $etat->source === 'grace' => 'expire',
            in_array($etat->source, ['essai', 'paye'], true) && $jours !== null && $jours <= 7 => $etat->source === 'essai' ? 'essai_fin' : 'bientot',
            $etat->source === 'essai' => 'essai',
            $etat->source === 'paye' => 'actif',
            default => 'gratuit',
        };

        return [
            'id' => $compte->id,
            'nom_commerce' => $compte->nom_commerce,
            'identifiant' => $compte->identifiant,
            'telephone' => $compte->telephone,
            'statut_compte' => $compte->statut,
            'cree_le' => $compte->cree_le?->toIso8601String(),
            'derniere_activite' => $derniereActivite ? Carbon::parse($derniereActivite)->toIso8601String() : null,
            'plan' => $etat->plan->code,
            'plan_nom' => $etat->plan->nom,
            'source' => $etat->source,
            'statut' => $statut,
            'jours_restants' => $jours,
            'echeance' => ($etat->source === 'essai' ? $etat->essaiJusquAu : ($etat->source === 'grace' ? $etat->graceJusquAu : $etat->finLe))?->toDateString(),
            'fin_le' => $etat->finLe?->toDateString(),
            'description' => ControleurPaiements::descriptionEtat($etat),
            'paiement_en_attente' => $enAttente,
        ];
    }

    private function correspond(array $ligne, string $filtre): bool
    {
        return match ($filtre) {
            'essai' => in_array($ligne['statut'], ['essai', 'essai_fin'], true) || ($ligne['source'] === 'essai' && $ligne['statut'] === 'attente'),
            'payants' => in_array($ligne['source'], ['paye', 'grace'], true),
            'bientot' => in_array($ligne['statut'], ['bientot', 'essai_fin'], true),
            'expires' => $ligne['statut'] === 'expire',
            'bloques' => $ligne['statut'] === 'bloque',
            'attente' => $ligne['paiement_en_attente'],
            default => true,
        };
    }
}
