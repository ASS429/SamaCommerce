<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Paiement d'abonnement : déclaré par le commerçant (référence de la
 * transaction Wave ou Orange Money), puis validé ou refusé par
 * l'administrateur. Seul un paiement VALIDÉ ouvre une période payée
 * (`debut_le` → `fin_le`, bornes incluses).
 */
class PaiementAbonnement extends Modele
{
    protected $table = 'paiements_abonnement';

    protected $fillable = [
        'utilisateur_id', 'plan_code', 'periode', 'montant_attendu', 'montant_declare', 'moyen',
        'numero_payeur', 'reference', 'reference_cle', 'capture', 'statut', 'motif_refus', 'origine',
        'debut_le', 'fin_le', 'numero_recu', 'decide_par', 'decide_le',
    ];

    /** La photo du reçu ne voyage que sur demande (fiche du paiement). */
    protected $hidden = ['capture'];

    protected $casts = [
        'montant_attendu' => 'integer',
        'montant_declare' => 'integer',
        'debut_le' => 'date',
        'fin_le' => 'date',
        'decide_le' => 'datetime',
    ];

    public const MOYENS = ['wave' => 'Wave', 'orange' => 'Orange Money', 'especes' => 'Espèces', 'offert' => 'Offert'];

    public const MOTIFS_REFUS = [
        'Paiement introuvable', 'Montant incorrect', 'Référence déjà utilisée', 'Autre motif',
    ];

    /** Toutes les colonnes sauf la photo du reçu (listes : la photo pèse lourd). */
    public const COLONNES_LEGERES = [
        'id', 'utilisateur_id', 'plan_code', 'periode', 'montant_attendu', 'montant_declare', 'moyen',
        'numero_payeur', 'reference', 'reference_cle', 'statut', 'motif_refus', 'origine', 'debut_le', 'fin_le',
        'numero_recu', 'decide_par', 'decide_le', 'cree_le', 'modifie_le',
    ];

    /** Requête sans la photo, avec un indicateur « a une photo ». */
    public static function leger()
    {
        return static::query()
            ->select(array_map(fn ($c) => 'paiements_abonnement.'.$c, self::COLONNES_LEGERES))
            ->selectRaw('(paiements_abonnement.capture IS NOT NULL) AS a_capture');
    }

    public function aUneCapture(): bool
    {
        return array_key_exists('a_capture', $this->attributes)
            ? (bool) $this->attributes['a_capture']
            : $this->capture !== null;
    }

    public function utilisateur(): BelongsTo
    {
        return $this->belongsTo(Utilisateur::class, 'utilisateur_id');
    }

    public function plan(): Plan
    {
        return Plan::parCode($this->plan_code);
    }

    /** Référence telle que saisie : majuscules, espaces simplifiés. */
    public static function referenceAffichee(?string $reference): ?string
    {
        $propre = strtoupper(trim(preg_replace('/\s+/', ' ', (string) $reference)));

        return $propre === '' ? null : $propre;
    }

    /** Clé de doublon : « TX 8f3k-q2lm » et « TX8F3KQ2LM » désignent la même transaction. */
    public static function cleReference(?string $reference): ?string
    {
        $cle = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', (string) $reference));

        return $cle === '' ? null : $cle;
    }

    /** Une autre déclaration (non refusée) porte-t-elle déjà cette transaction ? */
    public static function referenceDejaUtilisee(string $moyen, ?string $cle, ?int $saufId = null): bool
    {
        return $cle !== null && static::query()
            ->where('moyen', $moyen)->where('reference_cle', $cle)->where('statut', '!=', 'refuse')
            ->when($saufId, fn ($q) => $q->where('id', '!=', $saufId))
            ->exists();
    }

    public function libelleMoyen(): string
    {
        return self::MOYENS[$this->moyen] ?? $this->moyen;
    }

    public function libelleFormule(): string
    {
        return $this->plan()->nom.' · '.($this->periode === 'an' ? '1 an' : '1 mois');
    }
}
